import type { Env } from '../../platform/env'
import { id } from '../../platform/db'
import { demoRichStories } from './demo-inbox-rich-content'

export const demoRichSeedVersion = 3

/** Add separate histories once, retaining every existing conversation and later
 * owner edit/deletion. The marker and all data commit in one D1 transaction. */
export async function ensureDemoInboxRich(env: Env, projectId: string, ownerId: string) {
  const owner = await env.DB.prepare('SELECT name FROM users WHERE id=?').bind(ownerId).first<{name: string}>()
  if (!owner) throw new Error('Demo inbox owner does not exist')
  const nonce = id(), now = Date.now(), minute = 60000
  const fresh = "EXISTS(SELECT 1 FROM project_settings WHERE project_id=? AND json_extract(settings_json,'$.demo_rich_seed_nonce')=?)"
  const statements = [env.DB.prepare(`UPDATE project_settings SET settings_json=json_set(settings_json,
    '$.demo_rich_seed_version',?,'$.demo_rich_seed_nonce',?),updated_at=?
    WHERE project_id=? AND json_extract(settings_json,'$.is_demo')=1
    AND json_type(settings_json,'$.demo_rich_seed_version') IS NULL
    AND json_type(settings_json,'$.demo_rich_seed_nonce') IS NULL`)
    .bind(demoRichSeedVersion,nonce,now,projectId)]
  for (const story of demoRichStories) {
    const conversationId = `${projectId}-${story.key}`, contactId = `${projectId}-contact-${story.key}`
    const recentStart = now - 60 * minute, earlierStart = recentStart - 2 * 24 * 60 * minute
    const earlierBucket = `${conversationId}-earlier`
    const messages = [...story.earlier.messages, ...story.recent.messages]
    const finished = recentStart + story.recent.messages.at(-1)![0] * minute
    statements.push(env.DB.prepare(`INSERT INTO contacts(id,project_id,name,email,external_id,metadata_json,created_at)
      SELECT ?,?,?,?,?,?,? WHERE ${fresh}`).bind(contactId,projectId,`${story.name} (demo)`,`${story.key}@northstar.example`,story.key,
      JSON.stringify({is_demo:true,description:`Fictional demo contact. ${story.subject}.`}),earlierStart,projectId,nonce))
    statements.push(env.DB.prepare(`INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,assigned_to,resolved_at,created_at,updated_at)
      SELECT ?,?,?,?,?,?,NULL,?,? WHERE ${fresh}`).bind(conversationId,projectId,contactId,messages.length,
      `${conversationId}-message-${messages.length-1}`,story.assigned?ownerId:null,earlierStart,finished,projectId,nonce))
    statements.push(env.DB.prepare(`INSERT INTO conversation_buckets(id,conversation_id,created_at,metadata_json)
      SELECT ?,?,?,? WHERE ${fresh}`).bind(earlierBucket,conversationId,earlierStart,JSON.stringify({is_demo:true}),projectId,nonce))
    let revision = 0
    for (const [sessionIndex,session] of [story.earlier,story.recent].entries()) {
      const started = sessionIndex === 0 ? earlierStart : recentStart
      const bucketId = sessionIndex === 0 ? earlierBucket : conversationId
      for (const [offset,role,content] of session.messages) {
        const messageIndex = revision++
        statements.push(env.DB.prepare(`INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at,bucket_id)
          SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${fresh}`).bind(`${conversationId}-message-${messageIndex}`,projectId,conversationId,
          `demo:v3:${messageIndex}`,role==='contact'?contactId:ownerId,role,content,revision,started+offset*minute,
          sessionIndex===0?earlierBucket:null,projectId,nonce))
      }
      for (const [index,[offset,path]] of session.visits.entries()) {
        const eventId = `${conversationId}-visit-${sessionIndex}-${index}`
        statements.push(env.DB.prepare(`INSERT INTO context_tracked_events(id,project_id,subject_id,local_id,type,payload,created_at)
          SELECT ?,?,?,?,'PAGE_VIEW',?,? WHERE ${fresh}`).bind(eventId,projectId,contactId,eventId,
          JSON.stringify({conversation_id:conversationId,bucket_id:bucketId,url:`https://northstar.example${path}`}),started+offset*minute,projectId,nonce))
      }
    }
    for (const [index,[offset,content]] of story.notes.entries()) {
      statements.push(env.DB.prepare(`INSERT INTO conversation_notes(id,conversation_id,user_id,content,created_at)
        SELECT ?,?,?,?,? WHERE ${fresh}`).bind(`${conversationId}-note-${index}`,conversationId,ownerId,content,recentStart+offset*minute,projectId,nonce))
    }
    if (story.assigned) {
      const eventId = `${conversationId}-assigned`
      statements.push(env.DB.prepare(`INSERT INTO context_tracked_events(id,project_id,subject_id,local_id,type,payload,created_at)
        SELECT ?,?,?,?,'AGENT_ASSIGNED',?,? WHERE ${fresh}`).bind(eventId,projectId,contactId,eventId,
        JSON.stringify({conversation_id:conversationId,bucket_id:conversationId,agent_id:ownerId,name:owner.name,is_ai:false,role:'Support'}),recentStart+8*minute,projectId,nonce))
    }
  }
  const result = await env.DB.batch(statements)
  return Number(result[0].meta.changes || 0) ? demoRichStories.length : 0
}
