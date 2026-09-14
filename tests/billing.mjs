import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const {billingParityCases}=await import('./billing-parity-cases.ts')
const {recordStripePayment,automatedTopUps}=await import('../src/modules/integrations/billing.ts')
const {stripeOperation,stripe,customer,verifyStripeEvent}=await import('../src/modules/integrations/stripe.ts')
const {getPlatformProxy}=await import('wrangler')
const proxy=await getPlatformProxy({persist:false})
try {
 const env={...proxy.env,STRIPE_SECRET_KEY:'test-only',STRIPE_WEBHOOK_SECRET:'test-only'},DB=env.DB
 for(const file of ['0001_identity.sql','0002_conversations.sql','0003_identity_credentials.sql','0004_message_intent.sql','0005_widget_identity.sql','0007_conversation_history.sql','0070_management.sql','0080_integrations.sql','0081_billing_receipts.sql'])for(const sql of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await DB.prepare(sql).run()
 await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://widget.example',1)").run()
 await billingParityCases(env)
 const realFetch=globalThis.fetch;let calls=0
 globalThis.fetch=async(url,init)=>{assert.match(String(url),/^https:\/\/api.stripe.com\/v1\//);calls++;assert.ok(init.headers['Idempotency-Key']);return Response.json({id:'cus_test'})}
 try{assert.equal(await customer(env,'p'),'cus_test');assert.equal(await customer(env,'p'),'cus_test');assert.equal(calls,1)}finally{globalThis.fetch=realFetch}
 const intent={amount_minor:1000,currency:'usd',customer:'cus_test'}
 await stripeOperation(env,'p','automatic','A',intent,async()=>({id:'pi_A'}))
 const payment={id:'pi_A',status:'succeeded',currency:'usd',amount_received:1000,customer:'cus_test',payment_method:'pm_A',metadata:{h2h_project_id:'p',h2h_request_id:'A'}}
 await DB.prepare("UPDATE billing_accounts SET auto_state='A' WHERE project_id='p'").run()
 await recordStripePayment(env,payment)
 assert.equal((await DB.prepare("SELECT auto_state FROM billing_accounts").first()).auto_state,'idle')
 await DB.prepare("UPDATE billing_accounts SET auto_state='B',default_payment_method='pm_B' WHERE project_id='p'").run()
 await recordStripePayment(env,payment)
 assert.deepEqual(await DB.prepare('SELECT auto_state,default_payment_method FROM billing_accounts').first(),{auto_state:'B',default_payment_method:'pm_B'})
 assert.equal((await DB.prepare("SELECT SUM(amount_minor) balance FROM billing_ledger WHERE kind='top_up'").first()).balance,1000)
 await assert.rejects(recordStripePayment(env,{...payment,id:'pi_other'}),/identity conflicts/)
 await assert.rejects(recordStripePayment(env,{...payment,amount_received:1001}),/differs/)
 await assert.rejects(recordStripePayment(env,{...payment,customer:'cus_wrong'}),/differs/)
 await assert.rejects(recordStripePayment(env,{...payment,currency:'eur'}),/differs/)
 await assert.rejects(recordStripePayment(env,{...payment,metadata:{...payment.metadata,h2h_request_id:'unknown'}}),/matching/)
 await stripeOperation(env,'p','automatic','B',intent,async()=>({id:'pi_B'}))
 await DB.prepare("UPDATE billing_accounts SET auto_state='requires_review:B' WHERE project_id='p'").run()
 await recordStripePayment(env,{...payment,id:'pi_B',metadata:{...payment.metadata,h2h_request_id:'B'}})
 assert.equal((await DB.prepare('SELECT auto_state FROM billing_accounts').first()).auto_state,'idle')
 let attempted=0;await assert.rejects(stripeOperation(env,'p','automatic','unknown',intent,async()=>{attempted++;throw new Error('lost response')}))
 await assert.rejects(stripeOperation(env,'p','automatic','unknown',intent,async()=>{attempted++;return {id:'pi_bad'}}),/uncertain/)
 assert.equal(attempted,1)
 await DB.prepare("UPDATE billing_accounts SET auto_top_up=1,auto_state='idle',top_up_minor=10000,threshold_minor=2000 WHERE project_id='p'").run()
 let automaticCalls=0
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://api.stripe.com/v1/payment_intents');automaticCalls++;const body=new URLSearchParams(init.body);assert.equal(body.get('amount'),'10000');assert.equal(body.get('payment_method'),'pm_B');return Response.json({id:'pi_pending',status:'processing'})}
 try{await automatedTopUps(env);await automatedTopUps(env);assert.equal(automaticCalls,1);assert.match((await DB.prepare('SELECT auto_state FROM billing_accounts').first()).auto_state,/^requires_review:/)}finally{globalThis.fetch=realFetch}
 const timestamp=Math.floor(Date.now()/1000),raw=JSON.stringify({id:'evt_test',type:'test',data:{object:{}}})
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-only'),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const digest=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${raw}`))).toString('hex')
 assert.equal((await verifyStripeEvent(env,raw,`t=${timestamp},v1=${digest}`)).id,'evt_test')
 await assert.rejects(verifyStripeEvent(env,raw+' ',`t=${timestamp},v1=${digest}`),/Invalid/)
 await assert.rejects(verifyStripeEvent(env,raw,`t=1,v1=${digest}`),/Expired/)
 console.log('Billing real local D1: customer idempotency; exact credit; duplicate A preserves B and method; conflicting receipt; amount/customer/currency/unknown intent rejection; matching reviewed claim completion; uncertain no replay; signed webhook checks passed')
}finally{await proxy.dispose()}
