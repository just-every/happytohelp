import {hashToken} from '../../platform/auth'
import {localMailSender} from '../../edition/local-mail/outbox'
import {emailMode} from './email-provider'
import type {Env} from '../../platform/env'
import {emailConfigured, providerRequest, providerReceipt, selectedEmailProvider, sendGridDelivery} from './email-provider'
import {SendGridSendError} from '../../vendor/base/modules/sendgrid-email/src/sender'
export {emailConfigured} from './email-provider'
import {HTTPException} from 'hono/http-exception'

/** `headers` are extra message headers (loop suppression on notifications); like every
 * other field they are part of the delivery identity. */
export interface EmailInput {to:string;subject:string;text:string;projectId?:string;idempotencyKey:string;replyTo?:string;headers?:Readonly<Record<string,string>>}
type DeliveryRow={state:string;provider_id:string|null;intent_hash:string}

async function senderFor(env:Env,input:EmailInput){
 const sender=input.projectId?await env.DB.prepare('SELECT from_name,from_address FROM email_settings WHERE project_id=?').bind(input.projectId).first<{from_name:string;from_address:string}>():null
 const senderAddress=sender?.from_address||String(env.EMAIL_FROM||'')
 return sender?.from_name?`${sender.from_name.replace(/[\r\n"<>]/g,'')} <${String(senderAddress).match(/<([^>]+)>/)?.[1]||senderAddress}>`:senderAddress
}
async function updateDelivery(env:Env,id:string,state:'sent'|'failed'|'uncertain',error:string|null,providerId:string|null=null){
 await env.DB.prepare('UPDATE email_deliveries SET state=?,provider_id=coalesce(?,provider_id),error=?,updated_at=? WHERE id=?').bind(state,providerId,error,Date.now(),id).run()
}
async function sendThroughSelectedProvider(env:Env,input:EmailInput,from:string):Promise<string|null>{
 const local=localMailSender(env)
 if(local){await local.send({deliveryId:input.idempotencyKey,from,to:[input.to],subject:input.subject,text:input.text,...(input.replyTo?{replyTo:input.replyTo}:{}),...(input.headers?{headers:input.headers}:{})});return null}
 if(selectedEmailProvider(env)==='sendgrid'){
  const receipt=await sendGridDelivery(env,input,from)
  return receipt.providerMessageId
 }
 const response=await fetch(...providerRequest(env,input,from))
 if(!response.ok){await updateDelivery(env,input.idempotencyKey,response.status>=500?'uncertain':'failed',`Provider HTTP ${response.status}`);throw new HTTPException(502,{message:'Email provider rejected delivery'})}
 const receipt=providerReceipt(env,await response.json(),input.to)
 if(!receipt.accepted){await updateDelivery(env,input.idempotencyKey,'failed','Recipient permanently rejected');throw new HTTPException(502,{message:'Email recipient permanently rejected'})}
 return receipt.id
}
function sendGridFailure(error:unknown){
 if(!(error instanceof SendGridSendError))return null
 const failed=error.outcome==='rejected'||error.outcome==='rate_limited'
 return {state:failed?'failed' as const:'uncertain' as const,message:error.outcome==='rate_limited'?'Email provider rate limited delivery':failed?'Email provider rejected delivery':'Email delivery outcome unknown; reconcile before retrying'}
}
export async function sendEmail(env:Env,input:EmailInput){
 if(!emailConfigured(env))throw new HTTPException(503,{message:'Email provider is not configured'})
 const from=await senderFor(env,input),intentHash=await hashToken(JSON.stringify({...input,from})),existing=await env.DB.prepare('SELECT state,provider_id,intent_hash FROM email_deliveries WHERE id=?').bind(input.idempotencyKey).first<DeliveryRow>()
 if(existing){
  if(existing.intent_hash!==intentHash)throw new HTTPException(409,{message:'Email command identity conflict'})
  if(existing.state==='sent')return {id:existing.provider_id,state:'sent',...(emailMode(env)==='local'?{mode:'local' as const}:{})}
  throw new HTTPException(409,{message:`Email delivery ${existing.state}; reconcile before retrying`})
 }
 const now=Date.now(),claimed=await env.DB.prepare("INSERT OR IGNORE INTO email_deliveries VALUES(?,?,?,?,?,'sending',NULL,NULL,?,?)").bind(input.idempotencyKey,input.projectId||null,input.to,input.subject,intentHash,now,now).run()
 if(!claimed.meta.changes)throw new HTTPException(409)
 try{
  const providerId=await sendThroughSelectedProvider(env,input,String(from))
  await updateDelivery(env,input.idempotencyKey,'sent',null,providerId)
  return {id:providerId,state:'sent',...(emailMode(env)==='local'?{mode:'local' as const}:{})}
 }catch(error){
 const classified=sendGridFailure(error)
 if(classified){
   await updateDelivery(env,input.idempotencyKey,classified.state,classified.message)
   throw new HTTPException(classified.state==='failed'?502:503,{message:classified.message})
  }
  await env.DB.prepare("UPDATE email_deliveries SET state='uncertain',error='Delivery outcome unknown',updated_at=? WHERE id=? AND state='sending'").bind(Date.now(),input.idempotencyKey).run()
  throw error
 }
}
