import {reconcileProjectUsage} from './billing-project-usage'
export {settleContextUsage,settleBrandUsage} from './billing-project-usage'
import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import {billingCurrency} from './stripe'

const DAY=86400000
/** Preserve the legacy six-decimal balance, without rounding every request to cents. */
export async function recordUsageDebit(env:Env,input:{projectId:string;attemptId:string;requestId:string;usage:any;createdAt?:number}){
 const account=await billingCurrency(env,input.projectId),usage=input.usage
 const known=usage?.cost_unknown!==true&&typeof usage?.cost==='number'&&Number.isFinite(usage.cost)&&usage.cost>=0
 const micros=known?Math.round(usage.cost*1000000):null
 if(micros!==null&&!Number.isSafeInteger(micros))throw new HTTPException(400,{message:'Provider cost exceeds accounting precision'})
 const providerCurrency=String(usage?.currency||'usd').toLowerCase(),rate=providerCurrency===account.currency?1:providerCurrency==='usd'?account.usd_conversion_rate:null
 const converted=micros!==null&&rate!==null&&Number.isFinite(rate)&&rate>0?Math.round(micros*rate):null
 if(converted!==null&&!Number.isSafeInteger(converted))throw new HTTPException(400,{message:'Converted cost exceeds accounting precision'})
 const state=micros===null?'missing_usage':converted===null?'requires_conversion':'settled',key=JSON.stringify([input.attemptId,input.requestId]),now=input.createdAt??Date.now()
 const prior=await env.DB.prepare('SELECT * FROM billing_usage_receipts WHERE id=?').bind(key).first<any>()
 if(prior?.state==='settled'){
  if(prior.project_id!==input.projectId||prior.provider_cost_micros!==micros||prior.currency!==account.currency)throw new HTTPException(409,{message:'Settled usage identity has different cost or currency'})
  return prior
 }
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO billing_usage_receipts(id,project_id,attempt_id,request_id,state,provider_cost_micros,currency,conversion_rate,amount_micros,usage_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,provider_cost_micros=excluded.provider_cost_micros,conversion_rate=excluded.conversion_rate,amount_micros=excluded.amount_micros,usage_json=excluded.usage_json WHERE billing_usage_receipts.state!='settled' AND billing_usage_receipts.project_id=excluded.project_id`).bind(key,input.projectId,input.attemptId,input.requestId,state,micros,account.currency,rate,converted,JSON.stringify(usage??null),now),
  env.DB.prepare("INSERT OR IGNORE INTO billing_ledger(id,project_id,kind,amount_minor,currency,created_at,amount_micros) SELECT 'usage:'||id,project_id,'usage',CAST(-amount_micros/10000 AS INTEGER),currency,created_at,-amount_micros FROM billing_usage_receipts WHERE id=? AND state='settled'").bind(key)
 ])
 const receipt=await env.DB.prepare('SELECT * FROM billing_usage_receipts WHERE id=?').bind(key).first<any>()
 if(receipt?.project_id!==input.projectId||receipt?.provider_cost_micros!==micros)throw new HTTPException(409,{message:'Usage accounting identity conflict'})
 return receipt
}

/** Called after a generation attempt becomes terminal, including spent failed/cancelled work. */
export async function settleGenerationUsage(env:Env,generationId:string){
 const generation=await env.DB.prepare('SELECT project_id,state,output_json FROM ai_generations WHERE id=?').bind(generationId).first<any>()
 if(!generation)throw new HTTPException(404)
 const attempts=await env.DB.prepare('SELECT id,state,started_at FROM ai_attempts WHERE generation_id=?').bind(generationId).all<any>()
 for(const attempt of attempts.results){
  if(['queued','running'].includes(attempt.state))throw new HTTPException(409,{message:'Usage settlement requires a terminal attempt'})
  const rows=await env.DB.prepare('SELECT request_id,usage_json,observed FROM ai_round_usage WHERE attempt_id=?').bind(attempt.id).all<any>()
  if(rows.results.length){
   for(const row of rows.results)await recordUsageDebit(env,{projectId:generation.project_id,attemptId:attempt.id,requestId:row.request_id,usage:row.observed&&row.usage_json?JSON.parse(row.usage_json):null,createdAt:Date.parse(attempt.started_at)})
  }else{
   const usage=generation.output_json?JSON.parse(generation.output_json).usage:null
   if(usage||attempt.state==='uncertain')await recordUsageDebit(env,{projectId:generation.project_id,attemptId:attempt.id,requestId:'aggregate',usage,createdAt:Date.parse(attempt.started_at)})
  }
 }
}

export async function billingUsageProjection(env:Env,projectId:string,currency:string,balanceMicros:number,now=Date.now()){
 const today=Math.floor(now/DAY)*DAY,start=today-6*DAY
 const daily=await env.DB.prepare("SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') day,-SUM(COALESCE(amount_micros,amount_minor*10000)) amount_micros FROM billing_ledger WHERE project_id=? AND currency=? AND kind='usage' AND created_at>=? GROUP BY day ORDER BY day").bind(projectId,currency,start).all<any>()
 const pending=await env.DB.prepare("SELECT SUM(state='missing_usage') missing_usage_count,SUM(state='requires_conversion') pending_conversion_count FROM billing_usage_receipts WHERE project_id=?").bind(projectId).first<any>()
 const missing=Number(pending?.missing_usage_count||0),conversion=Number(pending?.pending_conversion_count||0)
 const total=daily.results.reduce((sum,row)=>sum+row.amount_micros,0),average=daily.results.length?total/7:null
 const complete=missing===0&&conversion===0
 return {daily:daily.results.map(row=>({...row,amount_minor:row.amount_micros/10000})),window_days:7,daily_usage_minor:average===null?null:average/10000,balance_exhaustion_at:complete&&average!==null&&average>0?new Date(now+Math.max(0,balanceMicros)/average*DAY).toISOString():null,missing_usage_count:missing,pending_conversion_count:conversion,projection_complete:complete,source:'recorded_usage_ledger'}
}

/** Training traces use the same request-level accounting and missing-cost policy. */
export async function settleTrainingUsage(env:Env,attemptId:string){
 const rows=await env.DB.prepare("SELECT r.project_id,r.request_id,r.usage_json,r.observed,c.started_at FROM training_model_rounds r JOIN training_cases c ON c.attempt_id=r.attempt_id WHERE r.attempt_id=? AND c.status NOT IN ('queued','running')").bind(attemptId).all<any>()
 for(const row of rows.results)await recordUsageDebit(env,{projectId:row.project_id,attemptId:`training:${attemptId}`,requestId:row.request_id,usage:row.observed&&row.usage_json?JSON.parse(row.usage_json):null,createdAt:row.started_at})
}

/** Recover accounting after a crash without resubmitting any provider request. */
export async function reconcileUsageBilling(env:Env){
 await reconcileProjectUsage(env)
 const generations=await env.DB.prepare("SELECT DISTINCT g.id FROM ai_generations g JOIN ai_attempts a ON a.generation_id=g.id JOIN ai_round_usage r ON r.attempt_id=a.id LEFT JOIN billing_usage_receipts b ON b.attempt_id=a.id AND b.request_id=r.request_id WHERE g.state NOT IN ('queued','running') AND a.state NOT IN ('queued','running') AND (b.id IS NULL OR b.state!='settled') LIMIT 100").all<{id:string}>()
 for(const row of generations.results)await settleGenerationUsage(env,row.id)
 const training=await env.DB.prepare("SELECT DISTINCT r.attempt_id FROM training_model_rounds r JOIN training_cases c ON c.attempt_id=r.attempt_id LEFT JOIN billing_usage_receipts b ON b.attempt_id='training:'||r.attempt_id AND b.request_id=r.request_id WHERE c.status NOT IN ('queued','running') AND (b.id IS NULL OR b.state!='settled') LIMIT 100").all<{attempt_id:string}>()
 for(const row of training.results)await settleTrainingUsage(env,row.attempt_id)
}
