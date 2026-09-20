import {isProjectActive} from '../../platform/project-status'
import type {Actor,Env} from '../../platform/env'
import {sendEmail,emailConfigured,type EmailInput} from './email'
import {replyAddress} from './inbound-routing'
async function deliver(env:Env,input:EmailInput){const prior=await env.DB.prepare('SELECT state,provider_id,recipient FROM email_deliveries WHERE id=?').bind(input.idempotencyKey).first<any>();if(prior)return {state:prior.state,id:prior.provider_id,recipient:prior.recipient};try{return await sendEmail(env,input)}catch(error){const recorded=await env.DB.prepare('SELECT state,provider_id,recipient FROM email_deliveries WHERE id=?').bind(input.idempotencyKey).first<any>();if(recorded)return {state:recorded.state,id:recorded.provider_id,recipient:recorded.recipient};throw error}}
/** Called after message commit. Provider failures remain visible in email_deliveries. */
export async function notifyMessage(env:Env,message:any,actor:Actor){
 const deliveryId=`message:${message.id}:notification`,prior=await env.DB.prepare('SELECT state,provider_id,recipient FROM email_deliveries WHERE id=?').bind(deliveryId).first<any>();if(prior)return {state:prior.state,id:prior.provider_id,recipient:prior.recipient};if(!await isProjectActive(env,actor.projectId))return {state:'project_deleted'};if(!emailConfigured(env))return {state:'not_configured'}
 const conversation=await env.DB.prepare('SELECT c.*,ct.email,ct.metadata_json FROM conversations c JOIN contacts ct ON ct.id=c.contact_id AND ct.project_id=c.project_id WHERE c.id=? AND c.project_id=?').bind(message.conversation_id,actor.projectId).first<any>();if(!conversation)return {state:'not_found'}
 const settings=await env.DB.prepare('SELECT * FROM email_settings WHERE project_id=? AND is_enabled=1').bind(actor.projectId).first<any>();if(!settings)return {state:'disabled'};const replyTo=replyAddress(settings.inbound_address,conversation.id)||undefined
 if(message.actor_role==='contact'){
  if(!conversation.assigned_to)return {state:'unassigned'}
  const user=await env.DB.prepare('SELECT u.id,u.email,s.is_notifiable_on_conversation_assignment FROM users u JOIN memberships m ON m.user_id=u.id LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=? AND m.project_id=?').bind(conversation.assigned_to,actor.projectId).first<any>();if(!user||user.is_notifiable_on_conversation_assignment===0)return {state:'disabled'}
  return deliver(env,{replyTo,projectId:actor.projectId,to:user.email,subject:'New HappyToHelp conversation reply',text:String(message.content),idempotencyKey:deliveryId})
 }
 if(!conversation.email)return {state:'no_recipient'}
 // Avoid notifying a contact actively reading the widget.
 if(Date.now()-Number(JSON.parse(conversation.metadata_json||'{}').last_seen_at||0)<90000)return {state:'online'}
 return deliver(env,{replyTo,projectId:actor.projectId,to:conversation.email,subject:'Reply to your support conversation',text:String(message.content),idempotencyKey:deliveryId})
}
