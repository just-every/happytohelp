import type { Env } from '../../platform/env'
import { id } from '../../platform/db'
import { demoStories, demoStoryBaselineMessageCounts } from './demo-inbox-content'

/** Append new story material only while every original field remains untouched.
 * The guarded update and inserts share one transaction, so operator writes win
 * cleanly instead of having their history overwritten by onboarding content. */
export async function upgradeDemoInbox(env: Env, projectId: string, ownerId: string) {
  let upgraded = 0
  for (const story of demoStories) {
    const baselineCount = demoStoryBaselineMessageCounts[story.key]
    if (story.messages.length <= baselineCount) continue
    const conversationId = `${projectId}-${story.key}`, contactId = `${projectId}-contact-${story.key}`
    const conversation = await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND project_id=?').bind(conversationId,projectId).first<any>()
    if (!conversation || conversation.revision !== baselineCount) continue
    const nonce = id(), newTail = `${conversationId}-v2-${nonce}-${story.messages.length-1}`
    const conditions = ['id=?','project_id=?','contact_id=?','revision=?','last_message_id=?','assigned_to IS ?',
      'updated_at=?','resolved_at IS ?','(SELECT count(*) FROM messages WHERE conversation_id=conversations.id)=?']
    const values: any[] = [conversationId,projectId,contactId,baselineCount,`${conversationId}-message-${baselineCount-1}`,
      'assigned' in story?ownerId:null,conversation.created_at+(baselineCount-1)*60000,
      'resolved' in story?conversation.created_at+(baselineCount-1)*60000:null,baselineCount]
    for (const [index,[role,content]] of story.messages.slice(0,baselineCount).entries()) {
      conditions.push('EXISTS(SELECT 1 FROM messages WHERE conversation_id=conversations.id AND id=? AND revision=? AND local_id=? AND actor_id=? AND actor_role=? AND content=? AND created_at=?)')
      values.push(`${conversationId}-message-${index}`,index+1,`demo:${index}`,role==='contact'?contactId:ownerId,role,content,conversation.created_at+index*60000)
    }
    const finished = conversation.created_at+(story.messages.length-1)*60000
    const statements = [env.DB.prepare(`UPDATE conversations SET revision=?,last_message_id=?,updated_at=?,resolved_at=? WHERE ${conditions.join(' AND ')}`)
      .bind(story.messages.length,newTail,finished,'resolved' in story?finished:null,...values)]
    for (let index=baselineCount; index<story.messages.length; index++) {
      const [role,content] = story.messages[index]
      statements.push(env.DB.prepare(`INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=? AND last_message_id=?)`)
        .bind(`${conversationId}-v2-${nonce}-${index}`,projectId,conversationId,`demo:v2:${index}`,role==='contact'?contactId:ownerId,role,content,index+1,conversation.created_at+index*60000,conversationId,newTail))
    }
    const result = await env.DB.batch(statements)
    upgraded += Number(result[0].meta.changes || 0)
  }
  return upgraded
}
