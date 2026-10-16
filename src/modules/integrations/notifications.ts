import {isProjectActive} from '../../platform/project-status'
import type {Actor,Env} from '../../platform/env'
import {emailConfigured} from './email'
import {replyAddress} from './inbound-routing'
import {deliverNotification,loopSuppressionHeaders,recordedNotification} from './notification-delivery'
import {queueOperatorActivity} from './operator-activity'
export {loopSuppressionHeaders} from './notification-delivery'
export {assignmentNotificationStatement,dispatchOperatorNotifications} from './operator-notifications'

/** Called after message commit. Customer replies retain immediate delivery,
 * including an online widget; operator activity is durable and read-aware. */
export async function notifyMessage(env:Env,message:any,actor:Actor){
 const deliveryId=`message:${message.id}:notification`,prior=await recordedNotification(env,deliveryId)
 if(prior)return prior
 if(!await isProjectActive(env,actor.projectId))return {state:'project_deleted'}
 if(message.actor_role==='contact')return queueOperatorActivity(env,message,actor.projectId)
 if(!emailConfigured(env))return {state:'not_configured'}
 const conversation=await env.DB.prepare('SELECT c.*,ct.email,ct.metadata_json FROM conversations c JOIN contacts ct ON ct.id=c.contact_id AND ct.project_id=c.project_id WHERE c.id=? AND c.project_id=?').bind(message.conversation_id,actor.projectId).first<any>()
 if(!conversation)return {state:'not_found'}
 const settings=await env.DB.prepare('SELECT * FROM email_settings WHERE project_id=?').bind(actor.projectId).first<any>()
 if(settings?.is_enabled===0)return {state:'disabled'}
 const replyTo=settings&&env.INBOUND_EMAIL_TOKEN?replyAddress(settings.inbound_address,conversation.id)||undefined:undefined
 if(!conversation.email)return {state:'no_recipient'}
 return deliverNotification(env,{replyTo,projectId:actor.projectId,to:conversation.email,subject:'Reply to your support conversation',text:String(message.content),headers:loopSuppressionHeaders(message),idempotencyKey:deliveryId})
}
