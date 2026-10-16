import type {Env} from '../../platform/env'
import {sendEmail,type EmailInput} from './email'

export async function recordedNotification(env:Env,id:string){
 const row=await env.DB.prepare('SELECT state,provider_id,recipient FROM email_deliveries WHERE id=?').bind(id).first<{state:string;provider_id:string|null;recipient:string}>()
 return row?{state:row.state,id:row.provider_id,recipient:row.recipient}:null
}
/** A durable attempt, including an uncertain one, is terminal for automatic work. */
export async function deliverNotification(env:Env,input:EmailInput){
 const prior=await recordedNotification(env,input.idempotencyKey)
 if(prior)return prior
 try{return await sendEmail(env,input)}catch(error){
  const recorded=await recordedNotification(env,input.idempotencyKey)
  if(recorded)return recorded
  throw error
 }
}
export function loopSuppressionHeaders(message:{actor_role?:unknown}){
 return {'Auto-Submitted':message.actor_role==='ai'?'auto-replied':'auto-generated','X-Auto-Response-Suppress':'All'}
}
