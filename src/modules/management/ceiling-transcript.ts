import type {Env} from '../../platform/env'
import {CEILING_PREFIX} from '../ai-support/reply-ceiling'

/** Operator-only transcript events for visitor messages whose automatic AI reply a daily ceiling skipped. */
export async function ceilingTranscripts(env:Env,conversation:any,bucketIds:string[]){
 const events=new Map<string,any[]>()
 if(!bucketIds.length)return events
 const rows=(await env.DB.prepare(`SELECT g.id,g.error,g.created_at,coalesce(m.bucket_id,m.conversation_id) bucket_id FROM ai_generations g JOIN messages m ON m.id=g.source_last_message_id AND m.conversation_id=g.conversation_id
  WHERE g.project_id=? AND g.conversation_id=? AND g.state='failed' AND g.error LIKE ? AND coalesce(m.bucket_id,m.conversation_id) IN (SELECT value FROM json_each(?))
  ORDER BY g.created_at,g.id`).bind(conversation.project_id,conversation.id,CEILING_PREFIX+'%',JSON.stringify(bucketIds)).all<{id:string;error:string;created_at:string;bucket_id:string}>()).results
 for(const row of rows){if(!events.has(row.bucket_id))events.set(row.bucket_id,[]);events.get(row.bucket_id)!.push({id:`ai-ceiling:${row.id}`,type:'AI_REPLY_SKIPPED',payload:{reason:row.error.slice(CEILING_PREFIX.length).trim()},conversation_id:conversation.id,bucket_id:row.bucket_id,created_at:row.created_at,agent:null,agent_id:null,contact:null,contact_id:null})}
 return events
}
export async function ceilingTranscript(env:Env,conversation:any,bucketId:string){return (await ceilingTranscripts(env,conversation,[bucketId])).get(bucketId)||[]}
