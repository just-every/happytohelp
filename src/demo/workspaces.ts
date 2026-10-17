import type { Env } from '../platform/env'
import { serverSecret } from '../platform/db'
import { workspaceDefaults } from '../modules/management/provisioning'
import { tagKey } from '../modules/move-in/readers/common'
import { articles, categories } from './help-center'
import { assistant, company, mailboxes, ownerName, savedReplies, tags, teammates, tradeInbox, type AgentKey, type InboxKey } from './team'

export type Owner = { id: string; projectId: string }
export type People = Record<AgentKey, { id: string; role: 'owner' | 'admin' | 'operator'; name: string }>
export const userId = (key: Exclude<AgentKey, 'owner'>) => `demo-user-${key}`
export const tagId = (inbox: InboxKey, name: string) => `demo-tag-${inbox}-${tagKey(name).replace(/[^a-z0-9]+/g, '-')}`

/** The claimed workspace becomes Fernwood Home, with its team, Fern, mailbox, saved replies, tags and help center;
 * Fernwood Trade is provisioned like any new workspace. Fixed ids and INSERT OR IGNORE keep a rerun a no-op. */
export async function seedWorkspaces(env: Env, owner: Owner, at: number): Promise<{ people: People; projects: Record<InboxKey, string>; fernId: string }> {
  const db = env.DB, projects: Record<InboxKey, string> = { home: owner.projectId, trade: tradeInbox.id }
  const people = { owner: { id: owner.id, role: 'owner', name: ownerName } } as People
  for (const mate of teammates) people[mate.key] = { id: userId(mate.key), role: mate.role, name: mate.name }
  const tradeExists = await db.prepare('SELECT 1 FROM projects WHERE id=?').bind(tradeInbox.id).first()
  const settings = await db.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(owner.projectId).first<{ settings_json: string }>()
  const starter = JSON.parse(settings?.settings_json || '{}').default_visitor_ai_id as string | undefined
  const fernId = starter && await db.prepare('SELECT 1 FROM ai_profiles WHERE id=? AND project_id=?').bind(starter, owner.projectId).first() ? starter : 'demo-ai-fern'

  const statements: D1PreparedStatement[] = [
    db.prepare('UPDATE projects SET name=?,allowed_origin=? WHERE id=?').bind(company.name, company.website, owner.projectId),
    db.prepare(`UPDATE project_settings SET settings_json=json_set(settings_json,'$.primary_color',?,'$.default_visitor_ai_id',?,'$.default_responder',?,'$.default_verified_user_ai_id',?),updated_at=? WHERE project_id=?`).bind(company.colour, fernId, fernId, fernId, at, owner.projectId),
    db.prepare('UPDATE users SET name=? WHERE id=?').bind(ownerName, owner.id),
    db.prepare('INSERT INTO user_settings(user_id,timezone) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET timezone=excluded.timezone').bind(owner.id, company.timezone),
    fernId === starter
      ? db.prepare('UPDATE ai_profiles SET name=?,role=?,prompt=? WHERE id=?').bind(assistant.name, assistant.role, assistant.prompt, fernId)
      : db.prepare('INSERT OR IGNORE INTO ai_profiles(id,project_id,name,role,prompt,model,is_enabled,is_animated,avatar_url,created_at) VALUES(?,?,?,?,?,?,1,0,NULL,?)').bind(fernId, owner.projectId, assistant.name, assistant.role, assistant.prompt, assistant.model, at),
  ]
  if (!tradeExists) {
    const defaults = workspaceDefaults(env, { projectId: tradeInbox.id, name: tradeInbox.name, website: tradeInbox.website, ownerEmail: '' })
    statements.push(
      db.prepare('INSERT OR IGNORE INTO projects(id,name,widget_key,allowed_origin,created_at,verification_secret) VALUES(?,?,?,?,?,?)').bind(tradeInbox.id, tradeInbox.name, crypto.randomUUID(), tradeInbox.website, at - 200 * 86400000, serverSecret()),
      db.prepare('INSERT OR IGNORE INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?)').bind(tradeInbox.id, JSON.stringify({ primary_color: tradeInbox.colour }), at),
      db.prepare("INSERT OR IGNORE INTO memberships(project_id,user_id,role) VALUES(?,?,'owner')").bind(tradeInbox.id, owner.id),
      ...defaults.statements)
  }
  for (const mate of teammates) {
    statements.push(
      db.prepare('INSERT OR IGNORE INTO users(id,email,name,created_at) VALUES(?,?,?,?)').bind(userId(mate.key), mate.email, mate.name, at - 180 * 86400000),
      db.prepare('INSERT OR IGNORE INTO user_settings(user_id,timezone) VALUES(?,?)').bind(userId(mate.key), company.timezone))
    for (const inbox of mate.inboxes) statements.push(db.prepare('INSERT OR IGNORE INTO memberships(project_id,user_id,role) VALUES(?,?,?)').bind(projects[inbox], userId(mate.key), mate.role))
  }
  for (const inbox of ['home', 'trade'] as const) {
    const mail = mailboxes[inbox]
    statements.push(db.prepare(`INSERT INTO email_settings(project_id,from_name,from_address,inbound_address,is_enabled,updated_at) VALUES(?,?,?,?,1,?)
      ON CONFLICT(project_id) DO UPDATE SET from_name=excluded.from_name,from_address=excluded.from_address,inbound_address=excluded.inbound_address,is_enabled=1,updated_at=excluded.updated_at`).bind(projects[inbox], mail.fromName, mail.fromAddress, mail.inbound, at))
    for (const name of tags) statements.push(db.prepare('INSERT OR IGNORE INTO workspace_tags(id,project_id,name,normalized_name) VALUES(?,?,?,?)').bind(tagId(inbox, name), projects[inbox], name, tagKey(name)))
  }
  for (const [index, reply] of savedReplies.entries()) {
    const written = at - (40 - index) * 86400000
    statements.push(db.prepare('INSERT OR IGNORE INTO macros(id,project_id,title,content,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(`demo-macro-${index}`, projects[reply.inbox], reply.title, reply.content, people[reply.by].id, written, written))
  }
  for (const [position, category] of categories.entries()) statements.push(db.prepare('INSERT OR IGNORE INTO knowledge_categories(id,project_id,parent_id,name,slug,summary,is_published,position) VALUES(?,?,NULL,?,?,?,1,?)').bind(`demo-kc-${category.key}`, owner.projectId, category.name, category.key, category.summary, position))
  for (const [position, article] of articles.entries()) {
    statements.push(
      db.prepare("INSERT OR IGNORE INTO knowledge_articles(id,project_id,category_id,slug,title,content,summary,status,updated_at,position) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(`demo-ka-${article.key}`, owner.projectId, `demo-kc-${article.category}`, article.key, article.title, article.content, article.summary, article.draft ? 'draft' : 'published', at - (30 - position) * 86400000, position),
      db.prepare('INSERT OR IGNORE INTO knowledge_article_categories(article_id,category_id) VALUES(?,?)').bind(`demo-ka-${article.key}`, `demo-kc-${article.category}`))
  }
  statements.push(db.prepare('INSERT OR IGNORE INTO public_project_aliases(slug,project_id) VALUES(?,?)').bind(company.helpSlug, owner.projectId))
  await db.batch(statements)
  return { people, projects, fernId }
}
