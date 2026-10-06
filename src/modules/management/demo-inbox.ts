import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { id, serverSecret } from '../../platform/db'
import { scope } from './common'
import { ensureDemoInboxRich } from './demo-inbox-rich'
import { ensureDemoInboxAi } from './demo-inbox-ai'
import { upgradeDemoInbox } from './demo-inbox-upgrade'
import { demoInboxName, demoStories, demoInboxContentVersion } from './demo-inbox-content'

export const demoInbox = new Hono<AppEnv>()

demoInbox.post('/demo-inbox', async c => {
  const actor = await scope(c)
  if (actor.role !== 'owner') throw new HTTPException(403, { message: 'Only a project owner can create a demo inbox.' })
  const ownerKey = await hashToken(`demo-inbox:${actor.id}`)
  const previous = (await c.env.DB.prepare(`SELECT p.id, p.name, s.settings_json FROM projects p
    JOIN project_settings s ON s.project_id=p.id
    WHERE json_extract(s.settings_json,'$.demo_owner_key')=?`).bind(ownerKey).all<any>()).results
  const existing = previous.find(p => !JSON.parse(p.settings_json).deleted_at)
  if (existing) {
    const member = await c.env.DB.prepare("SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role='owner'").bind(existing.id, actor.id).first()
    if (!member) throw new HTTPException(409, { message: 'Your demo inbox exists but you no longer own it.' })
    const upgraded = await upgradeDemoInbox(c.env, existing.id, actor.id)
    await ensureDemoInboxAi(c.env, existing.id)
    const added = await ensureDemoInboxRich(c.env, existing.id, actor.id)
    return c.json({ id: existing.id, name: existing.name, reused: true, upgraded, added })
  }

  // A deterministic generation key makes concurrent creation idempotent. Deleted
  // projects retain their history; a later explicit request creates a fresh demo.
  const projectId = `demo-${ownerKey.slice(0, 32)}-${previous.length}`
  const creationId = id(), now = Date.now()
  const settings = JSON.stringify({ is_demo: true, demo_content_version: demoInboxContentVersion, demo_owner_key: ownerKey, demo_creation_id: creationId,
    brand_name: 'Northstar Outfitters (fictional demo)', is_enabled: false, is_available: false,
    is_contact_tracking_enabled: false, demo_notice: 'Fictional sample conversations. No messages were sent and no AI was run.' })
  const fresh = "EXISTS(SELECT 1 FROM project_settings WHERE project_id=? AND json_extract(settings_json,'$.demo_creation_id')=?)"
  const statements = [
    c.env.DB.prepare('INSERT OR IGNORE INTO projects(id,name,widget_key,allowed_origin,created_at,verification_secret) VALUES(?,?,?,?,?,?)').bind(projectId,demoInboxName,id(),'https://demo.invalid',now,serverSecret()),
    c.env.DB.prepare('INSERT OR IGNORE INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?)').bind(projectId,settings,now),
    c.env.DB.prepare(`INSERT INTO memberships(project_id,user_id,role) SELECT ?,?,'owner' WHERE ${fresh}`).bind(projectId,actor.id,projectId,creationId),
  ]
  for (const [index, story] of demoStories.entries()) {
    const contactId = `${projectId}-contact-${story.key}`, conversationId = `${projectId}-${story.key}`
    const started = now - (demoStories.length - index) * 3600000
    const finished = started + (story.messages.length - 1) * 60000
    statements.push(c.env.DB.prepare(`INSERT INTO contacts(id,project_id,name,email,external_id,metadata_json,created_at)
      SELECT ?,?,?,?,?,?,? WHERE ${fresh}`).bind(contactId,projectId,`${story.name} (demo)`,`${story.key}@northstar.example`,story.key,JSON.stringify({is_demo:true,description:`Fictional demo contact. ${story.subject}.`}),started,projectId,creationId))
    statements.push(c.env.DB.prepare(`INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,assigned_to,resolved_at,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE ${fresh}`).bind(conversationId,projectId,contactId,story.messages.length,`${conversationId}-message-${story.messages.length-1}`,'assigned' in story?actor.id:null,'resolved' in story?finished:null,started,finished,projectId,creationId))
    for (const [messageIndex, [role, content]] of story.messages.entries()) {
      statements.push(c.env.DB.prepare(`INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE ${fresh}`).bind(`${conversationId}-message-${messageIndex}`,projectId,conversationId,`demo:${messageIndex}`,role==='contact'?contactId:actor.id,role,content,messageIndex+1,started+messageIndex*60000,projectId,creationId))
    }
  }
  // One D1 transaction creates complete transcripts. No admission hooks, outbox,
  // notification jobs, AI generations or provider requests are scheduled.
  await c.env.DB.batch(statements)
  await ensureDemoInboxAi(c.env, projectId)
  await ensureDemoInboxRich(c.env, projectId, actor.id)
  const saved = await c.env.DB.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(projectId).first<{settings_json:string}>()
  return c.json({ id: projectId, name: demoInboxName, reused: JSON.parse(saved!.settings_json).demo_creation_id !== creationId }, 201)
})
