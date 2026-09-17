import type {Env} from '../../platform/env'
import type {EmailInput} from './email'

export function emailConfigured(env:Env){
 const provider=env.EMAIL_PROVIDER||'resend'
 return ['resend','cloudflare'].includes(String(provider))&&typeof env.EMAIL_API_KEY==='string'&&Boolean(env.EMAIL_API_KEY.trim())&&typeof env.EMAIL_FROM==='string'&&Boolean(env.EMAIL_FROM.trim())&&(provider!=='cloudflare'||/^[a-f0-9]{32}$/i.test(String(env.EMAIL_ACCOUNT_ID||'')))
}
export function providerRequest(env:Env,input:EmailInput,from:string):[string,RequestInit]{
 const cloudflare=env.EMAIL_PROVIDER==='cloudflare'
 const named=from.match(/^(.*?)\s*<([^>]+)>$/)
 return [cloudflare?`https://api.cloudflare.com/client/v4/accounts/${env.EMAIL_ACCOUNT_ID}/email/sending/send`:'https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${env.EMAIL_API_KEY}`,'Content-Type':'application/json',...(!cloudflare?{'Idempotency-Key':input.idempotencyKey}:{})},
  body:JSON.stringify({from:cloudflare&&named?{name:named[1].trim(),address:named[2]}:from,to:[input.to],subject:input.subject,text:input.text,...(input.replyTo?{reply_to:input.replyTo}:{})}),signal:AbortSignal.timeout(20000),
 }]
}
export function providerReceipt(env:Env,body:unknown,recipient:string):{accepted:boolean;id:string|null}{
 const data=body as {id?:string;success?:boolean;result?:{delivered?:string[];queued?:string[];permanent_bounces?:string[]}}
 if(env.EMAIL_PROVIDER!=='cloudflare'){
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
