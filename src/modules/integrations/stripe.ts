import { HTTPException } from 'hono/http-exception'
import type { Env } from '../../platform/env'
import { hashToken } from '../../platform/auth'

export async function stripe(env:Env,path:string,body?:Record<string,string>,key?:string) {
 if(typeof env.STRIPE_SECRET_KEY!=='string'||!env.STRIPE_SECRET_KEY)throw new HTTPException(503,{message:'Stripe is not configured'})
 const headers:Record<string,string>={Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}
 if(body)headers['Content-Type']='application/x-www-form-urlencoded'
 if(key)headers['Idempotency-Key']=key
 const response=await fetch(`https://api.stripe.com/v1/${path}`,{method:body?'POST':'GET',headers,body:body?new URLSearchParams(body).toString():undefined,redirect:'error',signal:AbortSignal.timeout(20000)})
 if(!response.ok)throw Object.assign(new Error(`Stripe returned HTTP ${response.status}`),{knownFailure:response.status>=400&&response.status<500&&![408,409,429].includes(response.status)})
 return response.json() as Promise<any>
}
export async function stripeOperation(env:Env,projectId:string,kind:string,requestId:string,request:Record<string,unknown>,execute:(key:string)=>Promise<any>){
 if(typeof requestId!=='string'||!requestId||requestId.length>200)throw new HTTPException(400,{message:'A stable request_id is required'})
 if(!env.STRIPE_SECRET_KEY)throw new HTTPException(503,{message:'Stripe is not configured'})
 const key=`${projectId}:${kind}:${requestId}`,digest=await hashToken(JSON.stringify(request))
 const prior=await env.DB.prepare('SELECT * FROM billing_operations WHERE id=?').bind(key).first<any>()
 if(prior){if(prior.intent_hash!==digest)throw new HTTPException(409,{message:'Billing request identity was reused for different intent'});if(prior.state==='completed')return JSON.parse(prior.response_json);throw new HTTPException(409,{message:`Billing operation is ${prior.state}; inspect provider state before another attempt`})}
 const claim=await env.DB.prepare("INSERT OR IGNORE INTO billing_operations(id,project_id,kind,state,created_at,intent_hash,request_json) VALUES(?,?,?,'sending',?,?,?)").bind(key,projectId,kind,Date.now(),digest,JSON.stringify(request)).run()
 if(!claim.meta.changes)throw new HTTPException(409,{message:'Billing operation is already in progress'})
 try{const result=await execute(await hashToken(key));await env.DB.prepare("UPDATE billing_operations SET state='completed',response_json=?,provider_id=? WHERE id=? AND state='sending'").bind(JSON.stringify(result),result.id||null,key).run();return result}
 catch(error){await env.DB.prepare("UPDATE billing_operations SET state=?,error=? WHERE id=? AND state='sending'").bind((error as any).knownFailure?'failed':'uncertain',error instanceof Error?error.message:'Unknown provider outcome',key).run();throw new HTTPException(502,{message:'Billing provider operation did not complete locally; inspect its recorded state'})}
}
export async function customer(env:Env,projectId:string){
 await billingCurrency(env,projectId)
 const existing=await env.DB.prepare('SELECT stripe_customer_id FROM billing_accounts WHERE project_id=?').bind(projectId).first<{stripe_customer_id:string}>()
 if(existing?.stripe_customer_id)return existing.stripe_customer_id
 const project=await env.DB.prepare('SELECT name FROM projects WHERE id=?').bind(projectId).first<{name:string}>()
 if(!project)throw new HTTPException(404)
 const result=await stripeOperation(env,projectId,'customer',projectId,{projectId},key=>stripe(env,'customers',{name:project.name,'metadata[h2h_project_id]':projectId},key))
 if(typeof result.id!=='string'||!result.id.startsWith('cus_'))throw new HTTPException(502,{message:'Stripe returned an invalid customer identity'})
 await env.DB.prepare('UPDATE billing_accounts SET stripe_customer_id=? WHERE project_id=? AND stripe_customer_id IS NULL').bind(result.id,projectId).run()
 return result.id as string
}
export async function verifyStripeEvent(env:Env,raw:string,signature:string|null){
 if(typeof env.STRIPE_WEBHOOK_SECRET!=='string'||!env.STRIPE_WEBHOOK_SECRET)throw new HTTPException(503,{message:'Stripe webhook is not configured'})
 const parts=(signature||'').split(',').map(x=>x.split('=')),timestamp=parts.find(([k])=>k==='t')?.[1]
 if(!timestamp||!/^[0-9]+$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)throw new HTTPException(400,{message:'Expired or invalid Stripe signature'})
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify'])
 let valid=false
 for(const [kind,value]of parts){if(kind!=='v1'||!value||!/^[0-9a-f]{64}$/.test(value))continue;const bytes=Uint8Array.from(value.match(/../g)!,x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(`${timestamp}.${raw}`)))valid=true}
 if(!valid)throw new HTTPException(400,{message:'Invalid Stripe signature'})
 return JSON.parse(raw) as {id:string;type:string;data:{object:any}}
}

/** The edition currently supports two-decimal Stripe settlement currencies. */
export const billingCurrencies=['usd','aud','eur','gbp','cad','nzd','sgd','chf','sek','nok','dkk','hkd']
export function normalizeCurrency(value:unknown){const code=typeof value==='string'?value.toLowerCase():'';if(!billingCurrencies.includes(code))throw new HTTPException(400,{message:'Select a supported billing currency'});return code}
export async function billingCurrency(env:Env,projectId:string){
 const configured=normalizeCurrency(env.BILLING_CURRENCY||'usd')
 await env.DB.prepare('INSERT OR IGNORE INTO billing_accounts(project_id,currency,usd_conversion_rate) VALUES(?,?,?)').bind(projectId,configured,configured==='usd'?1:null).run()
 const account=await env.DB.prepare('SELECT currency,usd_conversion_rate FROM billing_accounts WHERE project_id=?').bind(projectId).first<{currency:string;usd_conversion_rate:number|null}>()
 if(!account)throw new HTTPException(404)
 return {...account,currency:normalizeCurrency(account.currency)}
}
function documentUrl(value:unknown){if(typeof value!=='string')return null;try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}}
export async function paymentDocuments(env:Env,payment:any){
 let charge=payment.latest_charge
 if(typeof charge==='string'){if(!/^ch_[A-Za-z0-9_]+$/.test(charge))throw new HTTPException(400,{message:'Invalid payment charge identity'});charge=await stripe(env,`charges/${encodeURIComponent(charge)}?expand%5B%5D=invoice`)}
 if(!charge)return {receipt_url:null,invoice_url:null,provider_charge_id:null}
 if(typeof charge!=='object'||typeof charge.id!=='string'||charge.payment_intent!==payment.id||charge.customer!==payment.customer||charge.currency!==payment.currency||charge.amount!==payment.amount_received)throw new HTTPException(409,{message:'Payment documents do not match the approved receipt'})
 let invoice=charge.invoice
 if(typeof invoice==='string'){if(!/^in_[A-Za-z0-9_]+$/.test(invoice))throw new HTTPException(400);invoice=await stripe(env,`invoices/${encodeURIComponent(invoice)}`)}
 if(invoice&&invoice.customer!==payment.customer)throw new HTTPException(409,{message:'Invoice customer does not match payment'})
 return {receipt_url:documentUrl(charge.receipt_url),invoice_url:documentUrl(invoice?.hosted_invoice_url),provider_charge_id:charge.id}
}
