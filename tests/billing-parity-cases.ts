import assert from 'node:assert/strict'
import {recordUsageDebit,billingUsageProjection} from '../src/modules/integrations/billing-usage'
import {paymentDocuments,billingCurrency} from '../src/modules/integrations/stripe'
export async function billingParityCases(env:any){
 const DB=env.DB,now=Date.now()
 await recordUsageDebit(env,{projectId:'p',attemptId:'spent-failed',requestId:'round1',usage:{cost:0.000123},createdAt:now})
 await recordUsageDebit(env,{projectId:'p',attemptId:'spent-failed',requestId:'round1',usage:{cost:0.000123},createdAt:now})
 assert.equal((await DB.prepare("SELECT -SUM(amount_micros) amount FROM billing_ledger WHERE kind='usage'").first()).amount,123)
 await assert.rejects(recordUsageDebit(env,{projectId:'p',attemptId:'spent-failed',requestId:'round1',usage:{cost:0.5}}),/different cost/)
 await recordUsageDebit(env,{projectId:'p',attemptId:'missing',requestId:'round2',usage:{cost:0,cost_unknown:true}})
 let projection=await billingUsageProjection(env,'p','usd',1000000,now)
 assert.equal(projection.missing_usage_count,1);assert.equal(projection.balance_exhaustion_at,null)
 await recordUsageDebit(env,{projectId:'p',attemptId:'missing',requestId:'round2',usage:{cost:0.5}})
 projection=await billingUsageProjection(env,'p','usd',1000000,now)
 assert.equal(projection.missing_usage_count,0);assert.equal(projection.daily_usage_minor,50.0123/7);assert.ok(projection.balance_exhaustion_at)
 await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('aud','AUD','aud','https://example.com',1)").run()
 assert.equal((await billingCurrency({...env,BILLING_CURRENCY:'aud'},'aud')).currency,'aud')
 assert.equal((await recordUsageDebit(env,{projectId:'aud',attemptId:'aud-run',requestId:'round',usage:{cost:1}})).state,'requires_conversion')
 await DB.prepare("UPDATE billing_accounts SET usd_conversion_rate=1.5 WHERE project_id='aud'").run()
 assert.equal((await recordUsageDebit(env,{projectId:'aud',attemptId:'aud-run',requestId:'round',usage:{cost:1}})).amount_micros,1500000)
 const fetchBefore=globalThis.fetch,urls:string[]=[]
 globalThis.fetch=async(input:any)=>{const url=String(input);urls.push(url);assert.match(url,/^https:\/\/api.stripe.com\/v1\//);return Response.json(url.includes('/charges/')?{id:'ch_docs',payment_intent:'pi_docs',customer:'cus_docs',currency:'aud',amount:1000,receipt_url:'https://pay.stripe.com/receipt',invoice:'in_docs'}:{id:'in_docs',customer:'cus_docs',hosted_invoice_url:'https://invoice.stripe.com/docs'})}
 try{assert.deepEqual(await paymentDocuments(env,{id:'pi_docs',customer:'cus_docs',currency:'aud',amount_received:1000,latest_charge:'ch_docs'}),{receipt_url:'https://pay.stripe.com/receipt',invoice_url:'https://invoice.stripe.com/docs',provider_charge_id:'ch_docs'});assert.equal(urls.length,2)}finally{globalThis.fetch=fetchBefore}
}
