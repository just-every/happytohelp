import assert from 'node:assert/strict'
import {settleContextUsage,settleBrandUsage,reconcileProjectUsage} from '../src/modules/integrations/billing-project-usage'
import {billingUsageProjection} from '../src/modules/integrations/billing-usage'
import {automatedTopUps} from '../src/modules/integrations/billing'
export async function projectUsageCases(env:any){
 const DB=env.DB,now=Date.now()
 const job=async(id:string,state:string,started=1)=>DB.prepare('INSERT INTO context_jobs(id,project_id,subject_id,kind,state,source_revision,packet_json,model,created_at,started_at,provider_started) VALUES(?,?,?,?,?,0,?,?,?, ?,?)').bind(id,'p',id,'monitoring',state,'{}','test',now,now,started).run()
 const event=async(id:string,kind:string,payload:any)=>DB.prepare('INSERT INTO context_job_events(job_id,kind,payload,created_at) VALUES(?,?,?,?)').bind(id,kind,JSON.stringify(payload),now).run()
 await job('context-paid','running');await event('context-paid','agent_start',{request_id:'analysis'});await event('context-paid','cost_update',{request_id:'analysis',usage:{cost:.000321}})
 await settleContextUsage(env,'context-paid');assert.equal(await DB.prepare("SELECT id FROM billing_usage_receipts WHERE attempt_id='context:context-paid'").first(),null)
 await DB.prepare("UPDATE context_jobs SET state='completed' WHERE id='context-paid'").run()
 await event('context-paid','agent_start',{request_id:'summary'});await event('context-paid','cost_update',{request_id:'summary',usage:{cost:.02}});await event('context-paid','usage',{cost:999})
 await reconcileProjectUsage(env);await reconcileProjectUsage(env)
 assert.equal((await DB.prepare("SELECT -SUM(amount_micros) cost FROM billing_ledger WHERE id IN(SELECT 'usage:'||id FROM billing_usage_receipts WHERE attempt_id='context:context-paid')").first()).cost,20321)
 await job('context-crashed','uncertain');await event('context-crashed','agent_start',{request_id:'lost'});await reconcileProjectUsage(env)
 assert.equal((await DB.prepare("SELECT state FROM billing_usage_receipts WHERE attempt_id='context:context-crashed'").first()).state,'missing_usage')
 assert.equal((await billingUsageProjection(env,'p','usd',1000000)).projection_complete,false)
 await event('context-crashed','cost_update',{request_id:'lost',usage:{cost:.01}});await reconcileProjectUsage(env)
 assert.equal((await DB.prepare("SELECT amount_micros FROM billing_usage_receipts WHERE attempt_id='context:context-crashed'").first()).amount_micros,10000)
 await job('context-preflight','failed',0);await settleContextUsage(env,'context-preflight');assert.equal(await DB.prepare("SELECT id FROM billing_usage_receipts WHERE attempt_id='context:context-preflight'").first(),null)
 await DB.prepare("INSERT INTO brand_generations(id,project_id,actor_id,request_id,prompt,model,size,quality,state,created_at,started_at,expires_at,usage_json) VALUES('brand-spent','p','owner','brand','test','image','square','low','ready',?,?,?,'{\"total_tokens\":12}')").bind(now,now,now+10000).run()
 await settleBrandUsage(env,'brand-spent');await settleBrandUsage(env,'brand-spent');assert.equal((await DB.prepare("SELECT state FROM billing_usage_receipts WHERE attempt_id='brand:brand-spent'").first()).state,'missing_usage')
 await DB.prepare("UPDATE brand_generations SET usage_json='{\"cost\":0.04}' WHERE id='brand-spent'").run();await reconcileProjectUsage(env);assert.equal((await DB.prepare("SELECT amount_micros FROM billing_usage_receipts WHERE attempt_id='brand:brand-spent'").first()).amount_micros,40000)
 await DB.prepare("INSERT OR REPLACE INTO project_settings(project_id,settings_json,updated_at) VALUES('p',?,?)").bind(JSON.stringify({deleted_at:now}),now).run()
 await DB.prepare("UPDATE billing_accounts SET auto_top_up=1,auto_state='idle',default_payment_method='pm_test',top_up_minor=10000,threshold_minor=10000 WHERE project_id='p'").run()
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Deleted project must not dispatch Stripe')}
 try{await automatedTopUps(env);assert.equal(calls,0);assert.equal((await DB.prepare("SELECT auto_state FROM billing_accounts WHERE project_id='p'").first()).auto_state,'idle')}finally{globalThis.fetch=original}
 // Deletion between selection and claim must also prevent dispatch.
 await DB.prepare("UPDATE project_settings SET settings_json='{}' WHERE project_id='p'").run()
 const raceDB={prepare(sql:string){const statement=DB.prepare(sql);if(sql.includes('SELECT b.*'))return {async all(){const rows=await statement.all();await DB.prepare("UPDATE project_settings SET settings_json=? WHERE project_id='p'").bind(JSON.stringify({deleted_at:now})).run();return rows}};return statement}}
 calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Deleted-before-claim must not dispatch Stripe')}
 try{await automatedTopUps({...env,DB:raceDB});assert.equal(calls,0)}finally{globalThis.fetch=original}
 // A crash after ledger admission but before checkpoint repeats accounting safely.
 await DB.prepare("DELETE FROM billing_project_usage_checkpoints WHERE source='context' AND source_id='context-paid'").run()
 await reconcileProjectUsage(env)
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM billing_usage_receipts WHERE attempt_id='context:context-paid'").first()).n,2)
 let checkpointWrites=0
 const observedDB={prepare(sql:string){if(sql.startsWith('INSERT INTO billing_project_usage_checkpoints'))checkpointWrites++;return DB.prepare(sql)}}
 await reconcileProjectUsage({...env,DB:observedDB});assert.equal(checkpointWrites,0)
 console.log('Context/brand actual D1: terminal request costs, aggregate exclusion, missing usage, crash recovery, duplicate settlement, and deleted-project no Stripe dispatch passed')
}
