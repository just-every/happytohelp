import type {Env} from '../../platform/env'
import type {Run} from './types'
import {updateRun} from './run-store'
/** Reviewed children that never acquired a job have no native effects to
 * reverse. Record that fact so undo can reach the already committed children. */
export async function skipUnstartedUndo(env:Env,run:Run,ordinal:number){
 const progress=await env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(reversed),0) checkpoint,
 (SELECT COUNT(*) FROM move_in_batches WHERE run_id=?1 AND ordinal<>?2 AND state<>'undone') remaining,
 (SELECT json_extract(plan_json,'$.counts') FROM move_in_runs WHERE id=?1) counts
 FROM ik_provenance WHERE job_id IN (SELECT kit_job_id FROM move_in_batches WHERE run_id=?1)`).bind(run.id,ordinal).first<any>()
 const state=progress.remaining?'undoing':'undone'
 await updateRun(env,run,{state,cursor:progress.checkpoint,error:null,report_json:JSON.stringify({state,checkpoint:progress.checkpoint,total:progress.total,counts:JSON.parse(progress.counts)})},[
  env.DB.prepare("UPDATE move_in_batches SET state='undone',checkpoint=0 WHERE run_id=? AND ordinal=? AND kit_job_id IS NULL").bind(run.id,ordinal)
 ])
}
