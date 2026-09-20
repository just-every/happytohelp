import type {Env} from '../../platform/env'
import type {EmailInput} from './email'
import {sendSendGrid, type SendGridMessage} from '../sendgrid-email/sender'

export type EmailProvider = 'resend'|'cloudflare'|'sendgrid'
const providers:readonly EmailProvider[]=['resend','cloudflare','sendgrid']

/** The selected provider is explicit when supplied; the legacy default remains Resend. */
export function selectedEmailProvider(env:Env):EmailProvider|null{
 const value=String(env.EMAIL_PROVIDER||'resend') as EmailProvider
 return providers.includes(value)?value:null
}
export function emailConfigured(env:Env){
 const provider=selectedEmailProvider(env)
 return Boolean(provider&&typeof env.EMAIL_API_KEY==='string'&&env.EMAIL_API_KEY.trim()&&typeof env.EMAIL_FROM==='string'&&env.EMAIL_FROM.trim()&&(provider!=='cloudflare'||/^[a-f0-9]{32}$/i.test(String(env.EMAIL_ACCOUNT_ID||''))))
}
function namedAddress(from:string){
 const named=from.match(/^(.*?)\s*<([^>]+)>$/)
 return named?{name:named[1].trim(),address:named[2]}:from
}
export function providerRequest(env:Env,input:EmailInput,from:string):[string,RequestInit]{
 const provider=selectedEmailProvider(env)
 if(!provider||provider==='sendgrid')throw new Error('The selected provider has no Resend or Cloudflare request adapter')
 const cloudflare=provider==='cloudflare'
 return [cloudflare?`https://api.cloudflare.com/client/v4/accounts/${env.EMAIL_ACCOUNT_ID}/email/sending/send`:'https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${env.EMAIL_API_KEY}`,'Content-Type':'application/json',...(!cloudflare?{'Idempotency-Key':input.idempotencyKey}:{})},
  body:JSON.stringify({from:cloudflare?namedAddress(from):from,to:[input.to],subject:input.subject,text:input.text,...(input.replyTo?{reply_to:input.replyTo}:{})}),signal:AbortSignal.timeout(20000),
 }]
}
export async function sendGridDelivery(env:Env,input:EmailInput,from:string){
 const message:SendGridMessage={from,to:[input.to],subject:input.subject,text:input.text,...(input.replyTo?{replyTo:input.replyTo}:{}),deliveryId:input.idempotencyKey}
 return sendSendGrid({apiKey:String(env.EMAIL_API_KEY),message,timeoutMilliseconds:20000})
}
export function providerReceipt(env:Env,body:unknown,recipient:string):{accepted:boolean;id:string|null}{
 const data=body as {id?:string;success?:boolean;result?:{delivered?:string[];queued?:string[];permanent_bounces?:string[]}}
 if(selectedEmailProvider(env)!=='cloudflare'){
  if(typeof data?.id!=='string'||!data.id)throw new Error('Provider omitted delivery identity')
  return {accepted:true,id:data.id}
 }
 // Cloudflare REST returns recipient outcomes, not a provider message ID.
 // The durable local command remains the replay fence, including lost responses.
 if(data?.success!==true||!data.result)throw new Error('Email provider outcome unknown')
 if(data.result.permanent_bounces?.includes(recipient))return {accepted:false,id:null}
 if(data.result.delivered?.includes(recipient)||data.result.queued?.includes(recipient))return {accepted:true,id:null}
 throw new Error('Email provider omitted recipient outcome')
}
