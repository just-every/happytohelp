import {contactAvailableSql} from '../conversations/contact-privacy'
import {tokenGuard,type TokenAuthority} from '../../platform/integration-authority'
import {HTTPException} from 'hono/http-exception'
import type {Actor,Env} from '../../platform/env'
import {publishResolution} from './state'
export interface ConversationTransition {resolved?:boolean;agent_id?:string|null;ai_id?:string|null}
/** All effects are conditional on one transaction-local receipt, minted only while
 * the session, membership, workspace, message frontier and cycle still match. */
export async function transitionConversation(env:Env,actor:Actor,conversationId:string,change:ConversationTransition,sessionHash?:string,tokenAuthority?:TokenAuthority){
 if(actor.role==='contact')throw new HTTPException(403)
 if(!sessionHash&&!tokenAuthority)throw new HTTPException(401)
 if(change.resolved!==undefined&&typeof change.resolved!=='boolean')throw new HTTPException(400)
 for(const field of ['agent_id','ai_id'] as const)if(field in change&&change[field]!==null&&typeof change[field]!=='string')throw new HTTPException(400)
 const current=await env.DB.prepare(`SELECT c.*,t.transition_id,(SELECT MAX(ordinal) FROM conversation_resolutions WHERE conversation_id=c.id) ordinal FROM conversations c LEFT JOIN conversation_tracking t ON t.conversation_id=c.id WHERE c.id=? AND c.project_id=?`).bind(conversationId,actor.projectId).first<any>();if(!current)throw new HTTPException(404)
 const token=tokenAuthority?tokenGuard(tokenAuthority,actor.projectId,'conversations:write'):null
 const authoritySql=token?`AND EXISTS(${token.sql}) AND ${contactAvailableSql()}`:`AND EXISTS(SELECT 1 FROM memberships WHERE project_id=c.project_id AND user_id=? AND role=?)
 AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND actor_id=? AND role<>'contact' AND revoked_at IS NULL AND expires_at>? AND (project_id IS NULL AND role='operator' AND EXISTS(SELECT 1 FROM users WHERE id=sessions.actor_id) OR EXISTS(SELECT 1 FROM memberships live WHERE live.project_id=sessions.project_id AND live.user_id=sessions.actor_id AND live.role=sessions.role)))
 AND NOT EXISTS(SELECT 1 FROM sessions s JOIN project_settings ps ON ps.project_id=s.project_id WHERE s.token_hash=? AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)`
 const authorityArgs=token?token.params:[actor.id,actor.role,sessionHash!,actor.id,Date.now(),sessionHash!]
 const now=Date.now(),receipt=crypto.randomUUID(),guard=`c.id=? AND c.project_id=? AND c.contact_id=? AND c.revision=? AND c.resolved_at IS ? AND c.updated_at=? AND c.assigned_to IS ?
 AND (SELECT transition_id FROM conversation_tracking WHERE conversation_id=c.id) IS ?
 AND (SELECT MAX(ordinal) FROM conversation_resolutions WHERE conversation_id=c.id) IS ?
 ${authoritySql}
 AND NOT EXISTS(SELECT 1 FROM project_settings WHERE project_id=c.project_id AND json_extract(settings_json,'$.deleted_at') IS NOT NULL)
 ${change.agent_id?'AND EXISTS(SELECT 1 FROM memberships WHERE project_id=c.project_id AND user_id=?)':''}
 ${change.ai_id?'AND EXISTS(SELECT 1 FROM ai_profiles WHERE project_id=c.project_id AND id=? AND is_enabled=1)':''}`
 const args=[conversationId,actor.projectId,current.contact_id,current.revision,current.resolved_at,current.updated_at,current.assigned_to,current.transition_id,current.ordinal,...authorityArgs,...(change.agent_id?[change.agent_id]:[]),...(change.ai_id?[change.ai_id]:[])]
 const accepted='EXISTS(SELECT 1 FROM conversation_tracking WHERE conversation_id=? AND transition_id=?)'
 const statements=[
  env.DB.prepare(`INSERT OR IGNORE INTO conversation_tracking(conversation_id,project_id,initial_history_complete,cycle_history_complete,cycle_start_revision,cycle_start_at) SELECT c.id,c.project_id,0,0,c.revision,c.created_at FROM conversations c WHERE ${guard}`).bind(...args),
  env.DB.prepare(`UPDATE conversation_tracking SET transition_id=? WHERE conversation_id IN (SELECT c.id FROM conversations c WHERE ${guard})`).bind(receipt,...args),
  env.DB.prepare(`UPDATE conversations SET resolved_at=?,assigned_to=?,updated_at=? WHERE id=? AND ${accepted}`).bind(change.resolved===undefined?current.resolved_at:change.resolved?(current.resolved_at??now):null,'agent_id' in change?change.agent_id||null:current.assigned_to,now,conversationId,conversationId,receipt)
 ]
 if('ai_id' in change||change.agent_id)statements.push(env.DB.prepare(`INSERT INTO conversation_ai(conversation_id,ai_id) SELECT ?,? WHERE ${accepted} ON CONFLICT(conversation_id) DO UPDATE SET ai_id=excluded.ai_id`).bind(conversationId,change.agent_id?null:change.ai_id||null,conversationId,receipt))
 if(change.resolved||'agent_id' in change||'ai_id' in change)statements.push(env.DB.prepare(`UPDATE ai_generations SET state='cancelled',updated_at=? WHERE conversation_id=? AND project_id=? AND state IN ('queued','running') AND ${accepted}`).bind(new Date(now).toISOString(),conversationId,actor.projectId,conversationId,receipt))
 const result=await env.DB.batch(statements)
 if(!result[1].meta.changes)throw new HTTPException(409,{message:'Conversation or authority changed'})
 return publishResolution(env,actor.projectId,conversationId)
}
export function setConversationResolved(env:Env,actor:Actor,conversationId:string,resolved:boolean,sessionHash?:string){return transitionConversation(env,actor,conversationId,{resolved},sessionHash)}
