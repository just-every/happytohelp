import {assertModelConfigured} from '../ai-support/configuration'
import type { Env } from '../../platform/env'
// @ts-ignore Retained Worker-compatible orchestration module.
import { runStream } from '../ai-support/llm/orchestrator.js'
// @ts-ignore Request-local provider/storage context.
import { withWorkerRuntime } from '../ai-support/vendor/ensemble/worker-runtime.js'
export async function requestContextModel(env:Env,job:any,task:string,request:any){
 assertModelConfigured(env,job.model)
 const record=async(kind:string,payload:unknown)=>env.DB.prepare('INSERT INTO context_job_events(job_id,kind,payload,created_at) VALUES(?,?,?,?)').bind(job.id,kind,JSON.stringify(payload),Date.now()).run()
 const result=await withWorkerRuntime({apiKey:env.OPENAI_API_KEY,files:env.FILES,scope:`projects/${job.project_id}/context/${job.id}`,settings:env},()=>runStream({project_id:job.project_id,task,messages:request.messages,schema:request.schema,response_name:`context_${task}`,tools:[],options:{model:job.model,maxToolCalls:0,maxToolCallRoundsPerTurn:0},trace:{onEvent:async(event:any)=>{if(event.type==='agent_start')await env.DB.prepare('UPDATE context_jobs SET provider_started=1 WHERE id=?').bind(job.id).run();await record(event.type,event)},onUsage:async(usage:unknown)=>record('usage',usage)}}))
 return request.schema.parse(result)
}
