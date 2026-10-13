import type {Env} from '../../../platform/env'
import type {Configuration} from './configuration'
import type {Probe,Receipt,StepId} from './types'

/** A check that has not finished within this lease reads as interrupted and may be started again. */
export const checkLeaseMs=60000

export async function readReceipts(env:Env,projectId:string) {
 return (await env.DB.prepare('SELECT * FROM activation_receipts WHERE project_id=?').bind(projectId).all<Receipt>()).results
}
export async function startCheck(env:Env,config:Configuration,id:StepId) {
 const token=crypto.randomUUID(),now=Date.now()
 // A per-step lease bounds repeated clicks and stops late concurrent replies from replacing newer observations.
 const result=await env.DB.prepare(`INSERT INTO activation_receipts(project_id,step_id,state,fingerprint,checked_at,detail,receipt_ref,check_token,observation_json)
  VALUES(?,?,'checking',?,?,'Checking current configuration…',NULL,?,NULL)
  ON CONFLICT(project_id,step_id) DO UPDATE SET state='checking',fingerprint=excluded.fingerprint,checked_at=excluded.checked_at,detail=excluded.detail,receipt_ref=NULL,check_token=excluded.check_token,observation_json=NULL
  WHERE activation_receipts.state<>'checking' OR activation_receipts.checked_at<?`).bind(config.projectId,id,config.fingerprints[id],now,token,now-checkLeaseMs).run()
 return result.meta.changes?token:null
}
/** `observedUnder` is the configuration the observation describes when the check itself changed it (an adopted sender). */
export async function finishCheck(env:Env,config:Configuration,id:StepId,token:string,probe:Probe,observedUnder:Configuration=config) {
 await env.DB.prepare('UPDATE activation_receipts SET state=?,checked_at=?,detail=?,receipt_ref=?,observation_json=?,fingerprint=? WHERE project_id=? AND step_id=? AND check_token=? AND fingerprint=?')
  .bind(probe.state,Date.now(),probe.detail,probe.receiptRef||null,probe.observation?JSON.stringify(probe.observation):null,observedUnder.fingerprints[id],config.projectId,id,token,config.fingerprints[id]).run()
}
