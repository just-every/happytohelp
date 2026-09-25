import type {Actor,Env} from '../../platform/env'
import {hashToken} from '../../platform/auth'
import {collectActions,trackEvents} from './collector'
import {enqueueContextJob} from './jobs'
/** Called only after native session authentication; scope is rechecked against the durable conversation. */
export async function handleContextWidgetAction(env:Env,actor:Actor,conversationId:string,action:string,data:any){
 if(actor.role!=='contact'||!actor.contactId)throw new Error('Contact session required')
 const conversation=await env.DB.prepare('SELECT id FROM conversations WHERE id=? AND project_id=? AND contact_id=?').bind(conversationId,actor.projectId,actor.contactId).first()
 if(!conversation)throw new Error('Conversation scope denied')
 const subject=actor.contactId
 if(action==='collector'){
  if(!Array.isArray(data)||data.length>100)throw new Error('Invalid collector batch')
  const rows=await Promise.all(data.map(async(row:any)=>Array.isArray(row)?{localId:await hashToken(JSON.stringify(row)),action:row[1]}:row))
  const result=await collectActions(env,actor.projectId,subject,rows)
  const job=result.accepted&&typeof env.CONTEXT_MODEL==='string'?await enqueueContextJob(env,actor.projectId,subject,'monitoring',env.CONTEXT_MODEL):{reason:result.accepted?'configuration_required':result.reason}
  return {...result,job}
 }
 if(action==='saveEvents'){
  if(!Array.isArray(data)||data.length>100)throw new Error('Invalid event batch')
  const bucket=await env.DB.prepare(`SELECT id FROM (
   SELECT coalesce(bucket_id,conversation_id) AS id,created_at FROM messages WHERE conversation_id=?
   UNION ALL SELECT id,created_at FROM conversation_buckets WHERE conversation_id=?
  ) ORDER BY created_at DESC,id DESC LIMIT 1`).bind(conversationId,conversationId).first<{id:string}>()
  // Public telemetry reports visits only. Assignment and insight usage require a
  // trusted server writer; accepting their display fields would forge history.
  const events=await Promise.all(data.filter((event:any)=>event?.type==='PAGE_VIEW').map(async(event:any)=>{
   const url=typeof event.payload==='string'?event.payload:event.payload?.url
   if(typeof url!=='string'||!url.trim()||url.length>10000||(!/^https?:\/\//i.test(url)&&!/^\/(?!\/)/.test(url)))throw new Error('Invalid page visit')
   if(event.localId!==undefined&&(typeof event.localId!=='string'||!event.localId||event.localId.length>200))throw new Error('Invalid tracked event identity')
   const payload={url,conversation_id:conversationId,bucket_id:bucket?.id||conversationId}
   // Both supplied identities and content identities belong to the trusted
   // conversation/bucket. Ignored client context cannot perturb deduplication.
   const localId=await hashToken(JSON.stringify({type:'PAGE_VIEW',conversation_id:conversationId,bucket_id:payload.bucket_id,identity:event.localId??payload}))
   return {type:'PAGE_VIEW',localId,payload}
  }))
  return {counts:await trackEvents(env,actor.projectId,subject,events)}
 }
 if(action==='insights')return {insights:(await env.DB.prepare('SELECT id,help_type,content,buttons FROM context_insights WHERE project_id=? AND subject_id=? AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 3').bind(actor.projectId,subject).all()).results}
 if(action==='dismissInsight'){
  const id=typeof data==='string'?data:data?.id
  await env.DB.prepare('UPDATE context_insights SET dismissed_at=COALESCE(dismissed_at,?) WHERE id=? AND project_id=? AND subject_id=?').bind(Date.now(),id,actor.projectId,subject).run()
  return {dismissed:true}
 }
 return null
}
