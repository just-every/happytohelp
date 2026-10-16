import type {Actor,Env} from '../../platform/env'
import {hashToken} from '../../platform/auth'
import {analysisInterval,collectActions,trackEvents} from './collector'
import {enqueueContextJob} from './jobs'
import {visitorMonitoring,widgetMonitoringPolicy} from './widget-policy'
/** Called only after native session authentication; scope is rechecked against the durable conversation. */
export async function handleContextWidgetAction(env:Env,actor:Actor,conversationId:string,action:string,data:any){
 if(actor.role!=='contact'||!actor.contactId)throw new Error('Contact session required')
 const conversation=await env.DB.prepare('SELECT id FROM conversations WHERE id=? AND project_id=? AND contact_id=?').bind(conversationId,actor.projectId,actor.contactId).first()
 if(!conversation)throw new Error('Conversation scope denied')
 const subject=actor.contactId
 if(action==='contextConsent'){
  if(data?.consent!==undefined){
   if(typeof data.consent!=='boolean')throw new Error('Boolean consent required')
   const policy=await widgetMonitoringPolicy(env,actor.projectId)
   if(data.consent&&!policy.enabled)throw new Error('Proactive help is disabled')
   await env.DB.prepare('INSERT INTO context_subjects(project_id,subject_id,consent,bot_enabled,help_types) VALUES(?,?,?,?,?) ON CONFLICT(project_id,subject_id) DO UPDATE SET consent=excluded.consent,bot_enabled=excluded.bot_enabled,help_types=excluded.help_types').bind(actor.projectId,subject,data.consent?1:0,data.consent?1:0,JSON.stringify(policy.helpTypes)).run()
  }
  return {monitoring:await visitorMonitoring(env,actor.projectId,subject)}
 }
 if(action==='pingAction'){
  const policy=await widgetMonitoringPolicy(env,actor.projectId)
  if(!policy.enabled||!policy.ready)return {job:{reason:'configuration_required'}}
  // A settled activity burst can become due after its last collector request.
  // Check the cheap schedule before constructing a packet or reserving AI work.
  const collector=await env.DB.prepare('SELECT c.*,s.consent,s.bot_enabled FROM context_collectors c JOIN context_subjects s ON s.project_id=c.project_id AND s.subject_id=c.subject_id WHERE c.project_id=? AND c.subject_id=?').bind(actor.projectId,subject).first<any>()
  if(!collector?.consent||!collector.bot_enabled)return {job:{reason:'consent_or_bot_disabled'}}
  if(collector.actions_count-collector.analysis_actions<analysisInterval(collector.analysis_since_insight))return {job:{reason:'awaiting_activity'}}
  if(collector.job_id||collector.last_run_at>Date.now()-4000)return {job:{reason:'schedule_gate'}}
  return {job:await enqueueContextJob(env,actor.projectId,subject,'monitoring',policy.model!,true)}
 }
 if(action==='collector'){
  if(!Array.isArray(data)||data.length>100)throw new Error('Invalid collector batch')
  const policy=await widgetMonitoringPolicy(env,actor.projectId)
  if(!policy.enabled)return {accepted:0,reason:'monitoring_disabled'}
  const rows=await Promise.all(data.map(async(row:any)=>Array.isArray(row)?{localId:await hashToken(JSON.stringify(row)),action:row[1]}:row))
  const result=await collectActions(env,actor.projectId,subject,rows)
  const job=result.accepted&&policy.ready?await enqueueContextJob(env,actor.projectId,subject,'monitoring',policy.model!,true):{reason:result.accepted?'configuration_required':result.reason}
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
 if(action==='insights'){
  const monitoring=await visitorMonitoring(env,actor.projectId,subject)
  const policy=await widgetMonitoringPolicy(env,actor.projectId)
  if(!monitoring.enabled||!policy.ready)return {insights:[],monitoring}
  const rows=(await env.DB.prepare(`SELECT id,help_type,content,buttons FROM context_insights i WHERE project_id=? AND subject_id=? AND dismissed_at IS NULL AND NOT EXISTS(SELECT 1 FROM message_authorship a WHERE a.source_kind='insight' AND a.source_id=i.id AND a.kind='visitor') ORDER BY created_at DESC LIMIT 3`).bind(actor.projectId,subject).all<any>()).results
  return {monitoring,insights:rows.map(row=>({...row,ai:{...policy.assistant,type:row.help_type},metadata:{buttons:JSON.parse(row.buttons)}}))}
 }
 if(action==='dismissInsight'){
  const id=typeof data==='string'?data:data?.id
  await env.DB.prepare('UPDATE context_insights SET dismissed_at=COALESCE(dismissed_at,?) WHERE id=? AND project_id=? AND subject_id=?').bind(Date.now(),id,actor.projectId,subject).run()
  return {dismissed:true}
 }
 return null
}
