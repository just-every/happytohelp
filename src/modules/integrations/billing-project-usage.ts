import type {Env} from '../../platform/env'
import {recordUsageDebit} from './billing-usage'

/** A context job can issue separate analysis, insight, and summary requests. */
export async function settleContextUsage(env:Env,jobId:string){
 const job=await env.DB.prepare('SELECT project_id,state,provider_started,started_at FROM context_jobs WHERE id=?').bind(jobId).first<any>()
 if(!job||['queued','running'].includes(job.state))return
 const events=await env.DB.prepare("SELECT id,kind,payload FROM context_job_events WHERE job_id=? AND kind IN ('agent_start','cost_update','usage') ORDER BY id").bind(jobId).all<any>()
 const requests=new Map<string,any>();let aggregate:any=null
 for(const event of events.results){
  const payload=JSON.parse(event.payload)
  if(event.kind==='usage'){aggregate=payload;continue}
  const requestId=typeof payload.request_id==='string'&&payload.request_id?payload.request_id:null
  if(event.kind==='agent_start'){
   // Legacy traces without request identity remain explicit unresolved starts.
   if(!requestId){requests.set(`unidentified:${event.id}`,null)}
   else if(!requests.has(requestId))requests.set(requestId,null)
  }else if(requestId)requests.set(requestId,payload.usage??null)
 }
 // Aggregate usage is usable only when there are no identified request rounds.
 if(!requests.size&&job.provider_started)requests.set('aggregate',aggregate)
 for(const [requestId,usage] of requests)await recordUsageDebit(env,{projectId:job.project_id,attemptId:`context:${jobId}`,requestId,usage,createdAt:job.started_at??undefined})
}

/** A started image dispatch with token-only usage is unpriced, never free. */
export async function settleBrandUsage(env:Env,generationId:string){
 const row=await env.DB.prepare('SELECT project_id,state,started_at,usage_json FROM brand_generations WHERE id=?').bind(generationId).first<any>()
 if(!row||!row.started_at||['queued','running'].includes(row.state))return
 await recordUsageDebit(env,{projectId:row.project_id,attemptId:`brand:${generationId}`,requestId:'image',usage:row.usage_json?JSON.parse(row.usage_json):null,createdAt:row.started_at})
}

/** Only new durable evidence or a changed explicit conversion policy needs replay. */
export async function reconcileProjectUsage(env:Env){
 for(const [source,table,version,settle] of [
  ['context','context_jobs',"CAST(COALESCE((SELECT MAX(id) FROM context_job_events e WHERE e.job_id=j.id),0) AS TEXT)",settleContextUsage],
  ['brand','brand_generations',"COALESCE(j.usage_json,'null')",settleBrandUsage]
 ] as const){
  const fingerprint=`${version}||':'||COALESCE(CAST(a.usd_conversion_rate AS TEXT),'null')`
  const rows=await env.DB.prepare(`SELECT j.id,${fingerprint} fingerprint FROM ${table} j LEFT JOIN billing_accounts a ON a.project_id=j.project_id LEFT JOIN billing_project_usage_checkpoints b ON b.source=? AND b.source_id=j.id WHERE j.state NOT IN ('queued','running') AND (b.source_id IS NULL OR b.fingerprint!=${fingerprint}) ORDER BY j.id LIMIT 100`).bind(source).all<{id:string;fingerprint:string}>()
  for(const row of rows.results){
   await settle(env,row.id)
   await env.DB.prepare('INSERT INTO billing_project_usage_checkpoints(source,source_id,fingerprint) VALUES(?,?,?) ON CONFLICT(source,source_id) DO UPDATE SET fingerprint=excluded.fingerprint').bind(source,row.id,row.fingerprint).run()
  }
 }
}
