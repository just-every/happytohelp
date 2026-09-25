import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {normalizeEmail,emailMetadata,emailEnvironment} from '../scripts/installer/email.mjs'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {sendEmail,emailConfigured}=await import('../src/modules/integrations/email.ts')
const {getPlatformProxy}=await import('wrangler'),proxy=await getPlatformProxy({persist:false}),originalFetch=globalThis.fetch
try{
 for(const file of ['0001_identity.sql','0002_conversations.sql','0005_widget_identity.sql','0070_management.sql','0080_integrations.sql'])for(const sql of(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await proxy.env.DB.prepare(sql).run()
 const config=normalizeEmail({provider:'cloudflare',from:'support@example.com',accountId:'a'.repeat(32),apiKey:'private-fixture'}),env={...proxy.env,...emailEnvironment(config)}
 assert.equal(emailConfigured(env),true);assert.equal(emailConfigured({...env,EMAIL_ACCOUNT_ID:''}),false)
 assert.throws(()=>normalizeEmail({provider:'cloudflare',from:'support@example.com',accountId:'a'.repeat(32)},{CLOUDFLARE_API_TOKEN:'provisioning-token'}),/sending API token/)
 const metadata=emailMetadata(env);assert.equal(metadata.domainVerification,'not_checked');assert.equal(metadata.outbound,'not_tested');assert.equal(JSON.stringify(metadata).includes('private-fixture'),false)
 const input={to:'recipient@example.com',subject:'Test',text:'Body',replyTo:'reply@example.com',idempotencyKey:'cf-1'};let calls=0
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/email/sending/send`);assert.equal(JSON.parse(init.body).reply_to,'reply@example.com');return Response.json({success:true,result:{queued:[input.to],delivered:[],permanent_bounces:[]}})}
 assert.deepEqual(await sendEmail(env,input),{id:null,state:'sent'});await sendEmail(env,input);assert.equal(calls,1)
 globalThis.fetch=async()=>{calls++;throw Error('response lost')};await assert.rejects(sendEmail(env,{...input,idempotencyKey:'lost'}),/response lost/);await assert.rejects(sendEmail(env,{...input,idempotencyKey:'lost'}),/uncertain/);assert.equal(calls,2)
 globalThis.fetch=async()=>Response.json({success:true,result:{queued:[],delivered:[],permanent_bounces:[input.to]}})
 await assert.rejects(sendEmail(env,{...input,idempotencyKey:'bounced'}),/permanently rejected/);assert.equal((await env.DB.prepare("SELECT state FROM email_deliveries WHERE id='bounced'").first()).state,'failed')
 globalThis.fetch=async()=>Response.json({success:true,result:{queued:[],delivered:[],permanent_bounces:[]}})
 await assert.rejects(sendEmail(env,{...input,idempotencyKey:'missing'}),/omitted recipient/);assert.equal((await env.DB.prepare("SELECT state FROM email_deliveries WHERE id='missing'").first()).state,'uncertain')
 console.log('Cloudflare email: real D1 replay fence, queued acceptance, permanent bounce, unknown outcomes and secret-free setup metadata passed (provider fixtures only)')
}finally{globalThis.fetch=originalFetch;await proxy.dispose()}
