import {isProjectActive} from '../../platform/project-status'
import type {Actor,Env} from '../../platform/env'
import {sendEmails,emailConfigured,type EmailInput,type EmailOutcome} from './email'
import {renderConversationEmail} from './email-content'
import {recipientReplyAddress} from './email-reply-address'
import {loopSuppressionHeaders} from './notification-delivery'
import {queueOperatorActivity} from './operator-activity'
export {loopSuppressionHeaders} from './notification-delivery'
export {assignmentNotificationStatement,dispatchOperatorNotifications} from './operator-notifications'

type Recipient={id:string;email:string|null;metadata_json?:string}
type Recorded={state:string;provider_id:string|null;recipient:string}
const mailbox=(value:unknown)=>typeof value==='string'&&value.length<=254&&/^[^\s@<>(),:;"\\]+@[^\s@<>(),:;"\\]+\.[^\s@<>(),:;"\\]+$/.test(value.trim())?value.trim().toLowerCase():null
function metadata(contact:Recipient){return JSON.parse(contact.metadata_json||'{}')}
/** A collected preference chooses only a notification destination. It never
 * changes canonical identity, verification, participants or inbound authority. */
export function notificationAddress(contact:Recipient){return mailbox(metadata(contact).provided_email)||mailbox(contact.email)}
function outcome(deliveries:EmailOutcome[]){
 const first=deliveries[0]
 const state=['uncertain','sending','failed'].find(state=>deliveries.some(delivery=>delivery.state===state))||first.state
 return {...first,state,recipients:deliveries}
}
async function recorded(env:Env,id:string){
 const first=await env.DB.prepare('SELECT state,provider_id,recipient FROM email_deliveries WHERE id=?').bind(id).first<Recorded>()
 if(!first)return null
 const prefix=id+':',others=await env.DB.prepare('SELECT state,provider_id,recipient FROM email_deliveries WHERE substr(id,1,?)=? ORDER BY id').bind(prefix.length,prefix).all<Recorded>()
 return outcome([first,...others.results].map(row=>({state:row.state,id:row.provider_id,recipient:row.recipient})))
}
/** Called after commit. The historical primary ID fences the entire fan-out;
 * edited addresses or newly added participants cannot turn replay into new mail. */
export async function notifyMessage(env:Env,message:any,actor:Actor){
 const deliveryId=`message:${message.id}:notification`,prior=await recorded(env,deliveryId)
 if(prior)return prior
 if(!await isProjectActive(env,actor.projectId))return {state:'project_deleted'}
 const operatorActivity=message.actor_role==='contact'?await queueOperatorActivity(env,message,actor.projectId):null
 if(operatorActivity?.state==='automatic')return operatorActivity
 if(!emailConfigured(env))return {state:'not_configured'}
 const conversation=await env.DB.prepare('SELECT c.*,ct.email,ct.metadata_json FROM conversations c JOIN contacts ct ON ct.id=c.contact_id AND ct.project_id=c.project_id WHERE c.id=? AND c.project_id=?').bind(message.conversation_id,actor.projectId).first<any>()
 if(!conversation)return {state:'not_found'}
 const settings=await env.DB.prepare('SELECT * FROM email_settings WHERE project_id=?').bind(actor.projectId).first<any>()
 if(settings?.is_enabled===0)return {state:'disabled'}
 const contacts=await env.DB.prepare('SELECT ct.id,ct.email,ct.metadata_json FROM contacts ct WHERE ct.project_id=? AND (ct.id=? OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id=? AND cp.contact_id=ct.id)) ORDER BY CASE WHEN ct.id=? THEN 0 ELSE 1 END,ct.id').bind(actor.projectId,conversation.contact_id,conversation.id,conversation.contact_id).all<Recipient>()
 const senderId=message.actor_id||(message.actor_role==='contact'?actor.contactId||actor.id:message.actor_role==='ai'?null:actor.id)
 const excluded=new Set<string>()
 if(senderId){
  const sender=message.actor_role==='contact'
   ?contacts.results.find(contact=>contact.id===senderId)||await env.DB.prepare('SELECT id,email,metadata_json FROM contacts WHERE id=? AND project_id=?').bind(senderId,actor.projectId).first<Recipient>()
   :await env.DB.prepare('SELECT u.id,u.email FROM users u JOIN messages m ON m.actor_id=u.id WHERE u.id=? AND m.id=? AND m.project_id=? AND m.conversation_id=?').bind(senderId,message.id,actor.projectId,conversation.id).first<Recipient>()
  if(sender)for(const value of [sender.email,metadata(sender).provided_email]){const email=mailbox(value);if(email)excluded.add(email)}
 }
 const recipients:{id:string;email:string}[]=[]
 for(const contact of contacts.results){
  const flags=metadata(contact)
  if((message.actor_role==='contact'&&contact.id===senderId)||flags.is_erasing||flags.is_erased||flags.is_deleted||flags.is_blocked)continue
  const email=notificationAddress(contact)
  if(email&&!excluded.has(email)){recipients.push({id:contact.id,email});excluded.add(email)}
 }
 if(!recipients.length)return operatorActivity||{state:'no_recipient'}
 const {omitted,...content}=await renderConversationEmail(env,{projectId:actor.projectId,conversationId:conversation.id,messages:[message]})
 const inputs:EmailInput[]=await Promise.all(recipients.map(async(recipient,index)=>({...content,replyTo:settings?await recipientReplyAddress(env,settings.inbound_address,actor.projectId,conversation.id,recipient.email):undefined,projectId:actor.projectId,to:recipient.email,subject:'Reply to your support conversation',headers:loopSuppressionHeaders(message),idempotencyKey:index===0?deliveryId:`${deliveryId}:contact:${recipient.id}`})))
 try{return outcome(await sendEmails(env,inputs))}
 catch(error){const existing=await recorded(env,deliveryId);if(existing)return existing;throw error}
}
