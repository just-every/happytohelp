import type {Context} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {Actor,AppEnv} from '../../platform/env'
import {ticketAuthority} from './model'
import {requestSource} from '../audit/record'

/** Personal views belong to the member; a shared edit needs current settings authority. */
export async function viewAuthority(c:Context<AppEnv>,actor:Actor,shared:boolean){
 if(shared){
  if(!['owner','admin'].includes(actor.role))throw new HTTPException(403,{message:'Workspace owner or admin role required for shared views'})
  return ticketAuthority(c.env,actor,{sessionHash:c.get('sessionHash'),source:requestSource(c)},'settings.manage')
 }
 return {
  sql:`SELECT 1 FROM memberships m JOIN sessions s ON s.token_hash=? WHERE m.project_id=? AND m.user_id=? AND m.role=? AND s.actor_id=m.user_id AND s.role<>'contact' AND s.revoked_at IS NULL AND s.expires_at>max(?,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AND (s.project_id IS NULL AND s.role='operator' OR s.project_id=m.project_id AND s.role=m.role) AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=m.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)`,
  params:[c.get('sessionHash'),actor.projectId,actor.id,actor.role,Date.now()]
 }
}
/** changes() binds this audit to the immediately preceding guarded view write in the same batch. */
export function viewAudit(c:Context<AppEnv>,actor:Actor,id:string,action:string,detail:Record<string,unknown>){
 return c.env.DB.prepare("INSERT INTO audit_events(id,project_id,at,category,action,outcome,actor_type,actor_id,source,target_type,target_id,detail_json) SELECT ?,?,?,'data',?,'succeeded','user',?,?,'ticket_view',?,? WHERE changes()>0")
 .bind(crypto.randomUUID(),actor.projectId,Date.now(),action,actor.id,requestSource(c),id,JSON.stringify(detail))
}
