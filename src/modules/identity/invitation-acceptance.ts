import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
/** Reused inside the concrete writes, never just a link-preview preflight. */
export const invitationProjectActive=(project:string)=>`EXISTS(SELECT 1 FROM projects p WHERE p.id=${project}) AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=${project} AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)`
export const usableIdentityToken=`EXISTS(SELECT 1 FROM identity_tokens t WHERE t.token_hash=? AND t.consumed_at IS NULL AND t.expires_at>? AND (t.kind<>'invite' OR (${invitationProjectActive('t.project_id')})))`
export async function acceptExistingInvitation(env:Env,userId:string,sessionHash:string,tokenHash:string){
 const now=Date.now()
 const liveSession=`EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.actor_id WHERE s.token_hash=? AND s.actor_id=? AND s.role<>'contact' AND s.revoked_at IS NULL AND s.expires_at>? AND (s.project_id IS NULL AND s.role='operator' OR (${invitationProjectActive('s.project_id')} AND EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=s.project_id AND m.user_id=s.actor_id AND m.role=s.role))))`
 const eligible=`t.token_hash=? AND t.kind='invite' AND t.consumed_at IS NULL AND t.expires_at>? AND lower(t.email)=(SELECT lower(email) FROM users WHERE id=?) AND ${invitationProjectActive('t.project_id')} AND ${liveSession}`
 const args=[tokenHash,now,userId,sessionHash,userId,now]
 const results=await env.DB.batch([
  env.DB.prepare(`INSERT INTO memberships SELECT t.project_id,?,t.role FROM identity_tokens t WHERE ${eligible} ON CONFLICT(project_id,user_id) DO NOTHING`).bind(userId,...args),
  env.DB.prepare(`UPDATE identity_tokens AS t SET consumed_at=? WHERE ${eligible}`).bind(now,...args),
  env.DB.prepare("UPDATE identity_tokens SET consumed_at=? WHERE kind='invite' AND consumed_at IS NULL AND token_hash<>? AND (project_id,lower(email)) IN (SELECT project_id,lower(email) FROM identity_tokens WHERE token_hash=? AND consumed_at=?)").bind(now,tokenHash,tokenHash,now)
 ])
 if(!results[1].meta.changes)throw new HTTPException(400,{message:'Invitation invalid, expired or workspace unavailable'})
 return {accepted:true}
}
