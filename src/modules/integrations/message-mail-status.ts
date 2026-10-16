import type {Env} from '../../platform/env'
import {emailConfigured} from './email-provider'
import {localMailOrigin} from '../../edition/local-mail/configuration'

/** Read only the durable attempt; provider acceptance is never called delivery. */
export async function messageMailStatus(env:Env,message:{id:string;project_id:string;actor_role:string;erased_at?:number}) {
 if(message.actor_role==='contact'||message.erased_at)return null
 const deliveryId=`message:${message.id}:notification`,prefix=deliveryId+':'
 const attempts=(await env.DB.prepare('SELECT state,updated_at FROM email_deliveries WHERE project_id=? AND (id=? OR substr(id,1,?)=?)').bind(message.project_id,deliveryId,prefix.length,prefix).all<{state:string;updated_at:number}>()).results
 if(localMailOrigin(env))return {state:'suppressed'}
 if(attempts.length)return {state:['uncertain','sending','failed'].find(state=>attempts.some(attempt=>attempt.state===state))||attempts[0].state,updatedAt:Math.max(...attempts.map(attempt=>attempt.updated_at))}
 if(!emailConfigured(env))return {state:'not_configured'}
 const settings=await env.DB.prepare('SELECT is_enabled FROM email_settings WHERE project_id=?').bind(message.project_id).first<{is_enabled:number}>()
 if(settings?.is_enabled===0)return {state:'disabled'}
 const recipient=await env.DB.prepare('SELECT ct.email FROM conversations c JOIN contacts ct ON ct.id=c.contact_id AND ct.project_id=c.project_id WHERE c.id=(SELECT conversation_id FROM messages WHERE id=? AND project_id=?)').bind(message.id,message.project_id).first<{email:string|null}>()
 return {state:recipient?.email?'not_recorded':'no_recipient'}
}
