import type {Env} from '../../../platform/env'
import type {Configuration} from './configuration'
import {stepIds,stepLabels,stepPaths,providerObservationMs,type Probe,type Receipt,type StepId} from './types'

export async function startCheck(env:Env,config:Configuration,id:StepId) {
 const token=crypto.randomUUID(),now=Date.now()
 // A per-step lease bounds repeated clicks and stops late concurrent replies from replacing newer observations.
 const result=await env.DB.prepare(`INSERT INTO activation_receipts(project_id,step_id,state,fingerprint,checked_at,detail,receipt_ref,check_token)
  VALUES(?,?,'checking',?,?,'Checking current configuration…',NULL,?)
  ON CONFLICT(project_id,step_id) DO UPDATE SET state='checking',fingerprint=excluded.fingerprint,checked_at=excluded.checked_at,detail=excluded.detail,receipt_ref=NULL,check_token=excluded.check_token
  WHERE activation_receipts.state<>'checking' OR activation_receipts.checked_at<?`).bind(config.projectId,id,config.fingerprints[id],now,token,now-60000).run()
 return result.meta.changes?token:null
}
export async function finishCheck(env:Env,config:Configuration,id:StepId,token:string,probe:Probe) {
 await env.DB.prepare('UPDATE activation_receipts SET state=?,checked_at=?,detail=?,receipt_ref=? WHERE project_id=? AND step_id=? AND check_token=? AND fingerprint=?')
  .bind(probe.state,Date.now(),probe.detail,probe.receiptRef||null,config.projectId,id,token,config.fingerprints[id]).run()
}
export async function activationSnapshot(env:Env,config:Configuration) {
 const rows=(await env.DB.prepare('SELECT * FROM activation_receipts WHERE project_id=?').bind(config.projectId).all<Receipt>()).results
 const now=Date.now()
 const steps=await Promise.all(stepIds.map(async id=>{
  const row=rows.find(row=>row.step_id===id)
  const base={id,label:stepLabels[id],actionHref:`/projects/${config.projectId}/${stepPaths[id]}`}
  if(!row)return {...base,state:'not_checked',checkedAt:null,detail:'Not checked yet.',receiptRef:null}
  const changed=row.fingerprint!==config.fingerprints[id]
  const stale=row.state==='done'&&['model_key','sender_dns'].includes(id)&&now-row.checked_at>providerObservationMs
  const interrupted=row.state==='checking'&&now-row.checked_at>60000
  if(changed||stale||interrupted) {
   const detail=changed?'Configuration changed since this observation. Check again.':stale?'Provider validation is older than 15 minutes. Check again to confirm current status.':'The check did not finish. Its outcome is unknown; check status again.'
   await env.DB.prepare("UPDATE activation_receipts SET state='unknown',detail=? WHERE project_id=? AND step_id=? AND check_token=?").bind(detail,config.projectId,id,row.check_token).run()
   return {...base,state:'unknown',checkedAt:new Date(row.checked_at).toISOString(),detail,receiptRef:null}
  }
  return {...base,state:row.state,checkedAt:new Date(row.checked_at).toISOString(),detail:row.detail,receiptRef:row.receipt_ref,
   ...(id==='published_article'&&config.article?{actionHref:`/projects/${config.projectId}/articles/${config.article.id}`}:{})}
 }))
 return {projectId:config.projectId,total:8,done:steps.filter(step=>step.state==='done').length,steps,checkedAt:rows.length?new Date(Math.max(...rows.map(row=>row.checked_at))).toISOString():null}
}
