import type {Env} from '../../platform/env'
import {emailConfigured} from './email-provider'
import {localMailSender} from '../../edition/local-mail/outbox'

/** Read only the durable attempt; provider acceptance is never called delivery. */
export async function messageMailStatus(env:Env,message:{id:string;project_id:string;actor_role:string;erased_at?:number}) {
 if(message.actor_role==='contact'||message.erased_at)return null
 const attempt=await env.DB.prepare('SELECT state,updated_at FROM email_deliveries WHERE id=? AND project_id=?').bind(`message:${message.id}:notification`,message.project_id).first<{state:string;updated_at:number}>()
 if(attempt)return {state:attempt.state==='sent'&&localMailSender(env)?'captured':attempt.state,updatedAt:attempt.updated_at}
 if(!emailConfigured(env))return {state:'not_configured'}
 const settings=await env.DB.prepare('SELECT is_enabled FROM email_settings WHERE project_id=?').bind(message.project_id).first<{is_enabled:number}>()
 if(settings?.is_enabled===0)return {state:'disabled'}
 const recipient=await env.DB.prepare('SELECT ct.email FROM conversations c JOIN contacts ct ON ct.id=c.contact_id AND ct.project_id=c.project_id WHERE c.id=(SELECT conversation_id FROM messages WHERE id=? AND project_id=?)').bind(message.id,message.project_id).first<{email:string|null}>()
 return {state:recipient?.email?'not_recorded':'no_recipient'}
}
