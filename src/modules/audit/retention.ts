import type {Env} from '../../platform/env'
import {auditStatement} from './record'

export const RETENTION_LIMITS={min:90,max:3650}
const DAY=86400000

/**
 * Removes security-log rows older than each workspace's retention, never one a legal
 * hold covers. The purge window opens for one workspace and cutoff inside the same
 * batch as the delete, so no other delete can pass the append-only trigger. Each
 * purge records how many rows it removed and how many holds kept.
 */
export async function purgeExpiredAudit(env:Env,now=Date.now()){
 const projects=(await env.DB.prepare("SELECT project_id,CAST(json_extract(settings_json,'$.audit_retention_days') AS INTEGER) days FROM project_settings WHERE json_extract(settings_json,'$.audit_retention_days') IS NOT NULL LIMIT 50").all<{project_id:string;days:number}>()).results
 for(const {project_id:projectId,days} of projects){
  if(!Number.isInteger(days)||days<RETENTION_LIMITS.min)continue
  const before=now-days*DAY
  const held=`EXISTS(SELECT 1 FROM audit_holds h WHERE h.project_id=audit_events.project_id AND h.released_at IS NULL AND audit_events.at>=h.starts_at AND (h.ends_at IS NULL OR audit_events.at<=h.ends_at))`
  const results=await env.DB.batch([
   env.DB.prepare(`SELECT count(*) kept FROM audit_events WHERE project_id=? AND at<? AND ${held}`).bind(projectId,before),
   env.DB.prepare('INSERT INTO audit_purges(project_id,before_at) VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET before_at=excluded.before_at').bind(projectId,before),
   env.DB.prepare(`DELETE FROM audit_events WHERE project_id=? AND at<? AND NOT ${held}`).bind(projectId,before),
   env.DB.prepare('DELETE FROM audit_purges WHERE project_id=?').bind(projectId),
  ])
  const removed=results[2].meta.changes,kept=(results[0].results[0] as {kept:number}).kept
  if(removed)await auditStatement(env.DB,{projectId,category:'audit',action:'audit.purged',actor:{type:'system'},source:'system',detail:{removed,keptUnderHold:kept,olderThanDays:days}},now).run()
 }
}
