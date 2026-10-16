import type {Env} from '../../platform/env'
// @ts-ignore Retained correction/retraction policy.
import * as version from './profiles/version.js'
// @ts-ignore Retained evidence validation.
import * as validation from './profiles/validation.js'
export function currentGuard(env:Env,job:any){const visitorMonitoring=JSON.parse(job.packet_json||'{}').visitorMonitoring===true;return env.DB.prepare(`INSERT INTO context_write_guards(id,result) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM context_jobs j JOIN context_subjects s ON s.project_id=j.project_id AND s.subject_id=j.subject_id WHERE j.id=? AND j.state='running' AND EXISTS(SELECT 1 FROM projects p WHERE p.id=j.project_id) AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=j.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL) AND s.revision=j.source_revision ${visitorMonitoring?`AND EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=j.project_id AND json_extract(ps.settings_json,'$.is_contact_tracking_enabled')=1 AND json_extract(ps.settings_json,'$.proactive_help_enabled')=1)`:''} AND (j.kind NOT IN ('contact','monitoring','optimizeContact') OR (s.consent=1 AND s.bot_enabled=1))) THEN 'ok' ELSE 'stale' END)`).bind(job.id,job.id)}
export async function publishProfile(env:Env,job:any,candidate:any){
 const {packet,existing}=JSON.parse(job.packet_json)
 const valid=job.kind==='optimize'?validation.isOptimizationCandidate(candidate,packet):job.kind==='optimizeContact'?validation.isContactOptimizationCandidate(candidate,packet):validation.isProfileCandidate(job.kind,candidate,packet)
 if(!valid)throw new Error('Profile result cites unsupported evidence')
 const merged=['optimize','optimizeContact'].includes(job.kind)?version.saveOptimizationProfile(existing,candidate,packet):version.mergeProfile(existing,candidate,packet)
 await env.DB.batch([currentGuard(env,job),env.DB.prepare('UPDATE context_profiles SET profile=?,evidence_fingerprint=? WHERE project_id=? AND subject_id=? AND type=?').bind(JSON.stringify(merged.profile),packet.evidence_fingerprint,job.project_id,job.subject_id,job.kind),env.DB.prepare("UPDATE context_jobs SET state='completed',result_json=?,finished_at=? WHERE id=?").bind(JSON.stringify({changed:merged.changed}),Date.now(),job.id),env.DB.prepare('DELETE FROM context_write_guards WHERE id=?').bind(job.id)])
}
export async function finishContextJob(env:Env,job:any,state:string,result:any,error?:unknown){
 await env.DB.batch([env.DB.prepare('UPDATE context_jobs SET state=?,result_json=?,error=?,finished_at=? WHERE id=? AND state=?').bind(state,JSON.stringify(result),error?String(error).slice(0,1000):null,Date.now(),job.id,'running'),env.DB.prepare('UPDATE context_collectors SET job_id=NULL,last_run_at=?,analysis_since_insight=CASE WHEN ? THEN 0 ELSE analysis_since_insight END WHERE project_id=? AND subject_id=? AND job_id=?').bind(Date.now(),result?.insight?1:0,job.project_id,job.subject_id,job.id)])
}
