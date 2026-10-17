import type { Env } from '../platform/env'
import { canonicalActorJson } from '../modules/ai-support/repository'
import { assistant, company, tradeInbox } from './team'
import { stories, type Story } from './stories'
import { tagId, type People } from './workspaces'
import type { InboxKey } from './team'

const MINUTE = 60000, HOUR = 3600000

/** Conversations as admission would have left them: messages with authorship, tracking, resolutions with ratings for
 * closed ones, Fern's conversations and generations, AI drafts waiting for review, tags, notes and the owner's reads. */
export function conversationStatements(env: Env, people: People, projects: Record<InboxKey, string>, fernId: string, now: number) {
  const db = env.DB, statements: D1PreparedStatement[] = []
  const fernProfile = JSON.stringify({ name: assistant.name, model: assistant.model, prompt: assistant.prompt })
  const generation = (id: string, story: Story, conversationId: string, kind: 'reply' | 'suggestions', revision: number, lastMessageId: string | null, actor: unknown, at: number, result: unknown) =>
    db.prepare(`INSERT OR IGNORE INTO ai_generations(id,project_id,conversation_id,state,source_revision,source_context_revision,source_last_message_id,actor_json,model,ai_id,ai_profile_json,kind,instruction,options_json,created_at,updated_at,error,output_json)
      VALUES(?,?,?,'completed',?,0,?,?,?,?,?,?,'','{}',?,?,NULL,?)`).bind(id, projects[story.inbox], conversationId, revision, lastMessageId, canonicalActorJson(actor), assistant.model, fernId, fernProfile, kind,
      new Date(at).toISOString(), new Date(at + 4000).toISOString(), JSON.stringify({ result, usage: null }))

  for (const story of stories) {
    const projectId = projects[story.inbox], contactId = `demo-contact-${story.key}`, conversationId = `demo-conv-${story.key}`
    const started = now - story.start * HOUR, time = (offset: number) => Math.round(started + offset * MINUTE)
    const last = story.msgs.length - 1, lastAt = time(story.msgs[last][0])
    const aiOnly = !story.agent && story.msgs.some(([, who]) => who === 'ai')
    const resolvedAt = story.state === 'solved' ? lastAt + (aiOnly ? 10 : 3) * MINUTE : null
    const assignee = story.agent ? people[story.agent] : null
    const messageId = (index: number) => `${conversationId}-m${index}`
    statements.push(
      db.prepare('INSERT OR IGNORE INTO contacts(id,project_id,name,email,external_id,created_at,is_verified,metadata_json) VALUES(?,?,?,?,NULL,?,0,?)').bind(contactId, projectId, story.name, story.email, started,
        JSON.stringify({ ...(story.about ? { description: story.about } : {}), ...(story.phone ? { phone: story.phone } : {}) })),
      db.prepare('INSERT OR IGNORE INTO conversations(id,project_id,contact_id,revision,last_message_id,assigned_to,resolved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(conversationId, projectId, contactId, story.msgs.length, messageId(last), assignee?.id ?? null, resolvedAt, started, resolvedAt ?? lastAt))
    for (const [index, [offset, who, content]] of story.msgs.entries()) {
      const at = time(offset), id = messageId(index), person = who === 'c' || who === 'ai' ? null : people[who]
      const actor = who === 'c' ? contactId : who === 'ai' ? fernId : person!.id, role = who === 'c' ? 'contact' : who === 'ai' ? 'ai' : person!.role
      statements.push(db.prepare('INSERT OR IGNORE INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at,content_raw) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, projectId, conversationId, `demo:${index}`, actor, role, content, index + 1, at, who === 'c' && story.via === 'email' ? content : null))
      let source: [string, string | null, string | null, string | null] = who === 'c' ? ['visitor', null, null, null] : ['human', 'composer', actor, null]
      if (who === 'ai') {
        const generationId = `${conversationId}-g${index}`
        statements.push(generation(generationId, story, conversationId, 'reply', index, messageId(index - 1), { id: contactId, projectId, role: 'contact' }, at - 3000, { response: content }))
        source = ['ai', 'generation', generationId, null]
      } else if (who !== 'c' && story.assisted && index === story.msgs.findIndex(([, w]) => w !== 'c' && w !== 'ai')) {
        const generationId = `${conversationId}-d${index}`
        statements.push(generation(generationId, story, conversationId, 'suggestions', index, messageId(index - 1), { id: person!.id, projectId, role: person!.role }, at - 60000,
          { user_goal: '', responses: [{ button: 'Suggested reply', icon: 'message-circle', response: content, use_when: '', evidence_ids: [] }], missing_information: [] }))
        source = ['assisted', 'ai-draft', generationId, '0']
      }
      // Each reply was emailed to the customer as admission would have recorded it (the conversation shows "Email sent").
      if (who !== 'c') statements.push(db.prepare("INSERT OR IGNORE INTO email_deliveries(id,project_id,recipient,subject,intent_hash,state,provider_id,error,created_at,updated_at) VALUES(?,?,?,?,?,'sent',?,NULL,?,?)")
        .bind(`message:${id}:notification`, projectId, story.email, `New reply from ${story.inbox === 'trade' ? tradeInbox.name : company.name}`, `demo:${id}`, `demo-seed-${id}`, at + 2000, at + 2000))
      statements.push(db.prepare('INSERT OR IGNORE INTO message_authorship(message_id,project_id,kind,source_kind,source_id,source_part,recorded_at) VALUES(?,?,?,?,?,?,?)').bind(id, projectId, ...source, at))
    }
    statements.push(db.prepare('INSERT OR IGNORE INTO conversation_tracking(conversation_id,project_id,initial_history_complete,cycle_history_complete,cycle_start_revision,cycle_start_at,cycle_epoch,first_resolved_at) VALUES(?,?,1,1,?,?,0,?)')
      .bind(conversationId, projectId, resolvedAt ? story.msgs.length : 0, resolvedAt ?? started, resolvedAt))
    if (aiOnly) statements.push(db.prepare('INSERT OR IGNORE INTO conversation_ai(conversation_id,ai_id) VALUES(?,?)').bind(conversationId, fernId))
    if (resolvedAt) {
      const resolutionId = `${conversationId}-r1`, outcome = aiOnly ? 'ai' : story.assisted ? 'assisted' : 'human'
      statements.push(db.prepare('INSERT OR IGNORE INTO conversation_resolutions(id,project_id,conversation_id,contact_id,ordinal,resolved_at,resolved_revision,cycle_start_revision,outcome,evidence_json) VALUES(?,?,?,?,1,?,?,0,?,?)')
        .bind(resolutionId, projectId, conversationId, contactId, resolvedAt, story.msgs.length, outcome, JSON.stringify({ historyComplete: true })))
      if (story.rating) {
        const [value, comment] = story.rating, ratedAt = resolvedAt + 20 * MINUTE
        statements.push(
          db.prepare('INSERT OR IGNORE INTO conversation_ratings(resolution_id,value,comment,updated_at,revision) VALUES(?,?,?,?,1)').bind(resolutionId, value, comment, ratedAt),
          db.prepare('INSERT OR IGNORE INTO conversation_rating_history(id,resolution_id,value,comment,created_at,revision) VALUES(?,?,?,?,?,1)').bind(`${resolutionId}-h1`, resolutionId, value, comment, ratedAt))
      }
    }
    if (assignee) {
      const firstReply = story.msgs.find(([, who]) => who === story.agent)?.[0] ?? story.msgs[0][0]
      const event = `${conversationId}-assigned`
      statements.push(db.prepare("INSERT OR IGNORE INTO context_tracked_events(id,project_id,subject_id,local_id,type,payload,created_at) VALUES(?,?,?,?,'AGENT_ASSIGNED',?,?)")
        .bind(event, projectId, contactId, event, JSON.stringify({ conversation_id: conversationId, bucket_id: conversationId, agent_id: assignee.id, name: assignee.name, is_ai: false, role: 'Support' }), time(firstReply) - MINUTE))
    }
    for (const tag of story.tags ?? []) statements.push(db.prepare('INSERT OR IGNORE INTO conversation_tags(project_id,conversation_id,tag_id) VALUES(?,?,?)').bind(projectId, conversationId, tagId(story.inbox, tag)))
    if (story.note) {
      const [by, offset, content] = story.note
      statements.push(db.prepare('INSERT OR IGNORE INTO conversation_notes(id,conversation_id,user_id,content,created_at) VALUES(?,?,?,?,?)').bind(`${conversationId}-note`, conversationId, people[by].id, content, time(offset)))
    }
    if (story.draft) {
      const draft = story.draft, reviewer = assignee ?? people.owner
      const responses = [{ button: draft.button, icon: draft.icon, response: draft.response, use_when: '', evidence_ids: [] as string[] }]
      if (draft.alternative) responses.push({ button: draft.alternative.button, icon: draft.alternative.icon, response: draft.alternative.response, use_when: draft.alternative.when, evidence_ids: [] })
      statements.push(generation(`${conversationId}-draft`, story, conversationId, 'suggestions', story.msgs.length, messageId(last), { id: reviewer.id, projectId, role: reviewer.role }, lastAt + 30000,
        { user_goal: draft.goal, responses, missing_information: draft.missing ?? [] }))
    }
    if (!story.unread) statements.push(db.prepare('INSERT OR IGNORE INTO conversation_reads(conversation_id,user_id,revision) VALUES(?,?,?)').bind(conversationId, people.owner.id, story.msgs.length))
  }
  return statements
}
