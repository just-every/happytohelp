import {settleGenerationUsage} from '../integrations/billing-usage'
import {assistanceProfileSql,replyProfileSql} from './selection'
import type { Actor,Env,Job } from '../../platform/env'
import {notifyMessage} from '../integrations/notifications'
import { admitMessage } from '../conversations/admission'
import {assertModelConfigured} from './configuration'
import {publishSuggestions} from './presentation'
import { replyContext } from './context'
import { saveEvent,transition,requestGeneration,type Generation } from './repository'
// @ts-ignore Retained Ensemble request-scoped runtime.
import { withWorkerRuntime } from './vendor/ensemble/worker-runtime.js'
// @ts-ignore Retained orchestration.
import { runStream,TASKS } from './llm/orchestrator.js'
// @ts-ignore Retained customer prompt.
import { customerReplyMessages } from './replies/prompt.js'
// @ts-ignore Retained two-pass assistance.
import { generateSuggestions,generateReply } from './assist/prompt.js'
export async function handleGeneration(env:Env,job:Job){
 if(job.type!=='ai.generate')return false
 const row=await env.DB.prepare('SELECT * FROM ai_generations WHERE id=? AND project_id=?').bind(job.id,job.projectId).first<Generation>()
 if(!row)return true
 if(['completed','cancelled','superseded','failed','uncertain'].includes(row.state)){await settleGenerationUsage(env,row.id);return true}
 if(row.state==='running'){
  // A previous delivery may have reached the provider. Never replay it.
  await transition(env,row.id,'uncertain','Interrupted attempt; provider outcome requires review')
  await env.DB.prepare("UPDATE ai_attempts SET state='uncertain',finished_at=? WHERE generation_id=? AND state='running'").bind(new Date().toISOString(),row.id).run()
  await settleGenerationUsage(env,row.id)
  return true
 }
 try{assertModelConfigured(env,row.model)}catch(error){await env.DB.prepare("UPDATE ai_generations SET state='failed',error=? WHERE id=? AND state='queued'").bind(String(error),row.id).run();if(row.kind==='suggestions')await publishSuggestions(env,row.project_id,row.conversation_id);return true}
 const claimed=await env.DB.prepare("UPDATE ai_generations SET state='running',updated_at=? WHERE id=? AND state='queued'").bind(new Date().toISOString(),row.id).run()
 if(!claimed.meta.changes)return true
 const attemptId=crypto.randomUUID(),abort=new AbortController()
 await env.DB.prepare("INSERT INTO ai_attempts(id,generation_id,state,started_at) VALUES(?,?,'running',?)").bind(attemptId,row.id,new Date().toISOString()).run()
 let providerStarted=false,finalCommitted=false,chunkIndex=0
 const checkCurrent=async()=>{
  const current=await env.DB.prepare(`SELECT g.state,c.revision,(SELECT revision FROM context_subjects WHERE project_id=c.project_id AND subject_id=c.contact_id) context_revision,c.assigned_to,c.resolved_at,a.id ai_id,a.model,a.prompt,a.is_enabled FROM ai_generations g JOIN conversations c ON c.id=g.conversation_id AND c.project_id=g.project_id LEFT JOIN ai_profiles a ON a.id=${row.kind==='suggestions'?assistanceProfileSql:replyProfileSql} AND a.project_id=c.project_id WHERE g.id=?`).bind(row.id).first<any>()
  const selected=JSON.parse(row.ai_profile_json)
  if(!current||(current.context_revision||0)!==row.source_context_revision||current.ai_id!==row.ai_id||current.is_enabled!==1||current.model!==selected.model||current.prompt!==selected.prompt||current.state!=='running'||current.revision!==row.source_revision||(row.kind==='reply'&&current.assigned_to)||current.resolved_at){abort.abort('Conversation superseded');throw new Error('GENERATION_SUPERSEDED')}
 }
 const timer=setInterval(()=>{checkCurrent().catch(error=>abort.abort(error))},1000)
 const deadline=setTimeout(()=>abort.abort(new Error('GENERATION_DEADLINE')),180000)
 try{
  await checkCurrent()
  const context=await replyContext(env,row.project_id,row.conversation_id,row.kind==='suggestions'?'agent':'contact')
  if(row.instruction){(context.assistPacket as any).operator_guidance={content:row.instruction,visibility:'private-to-operators'};context.packet.trigger.server_instructions.push({visibility:'server-trigger',content:row.instruction})}
  let usageResult:any=null
  const trace={onEvent:async(event:any)=>{if(event.type==='agent_start')providerStarted=true;await saveEvent(env,attemptId,event);await checkCurrent();if(row.kind==='reply'&&event.type==='message_delta'&&typeof event.content==='string'&&!event.thinking)await emit(env,row,{type:'chunk',payload:{localId:`generation:${row.id}`,chunk:event.content,index:chunkIndex++,agent:context.agent}})},onUsage:async(usage:any)=>{usageResult=usage;await env.DB.prepare('UPDATE ai_generations SET output_json=? WHERE id=?').bind(JSON.stringify({usage}),row.id).run();await emit(env,row,{type:'generation.usage',operatorOnly:true,generationId:row.id,usage})}}
  if(row.kind==='suggestions'){const actor=JSON.parse(row.actor_json);const human=await env.DB.prepare('SELECT id,name FROM users WHERE id=?').bind(actor.id).first();(context.assistPacket as any).drafting_identity.human=human}
  const clientOptions=JSON.parse(row.options_json||'{}')
  if(clientOptions.message)(context.assistPacket as any).draft={content:clientOptions.message}
  const options={model:row.model,agent_instructions:row.instruction,abortSignal:abort.signal,maxToolCalls:8,maxToolCallRoundsPerTurn:4,trace}
  const result=await withWorkerRuntime({apiKey:env.OPENAI_API_KEY,files:env.FILES,scope:`projects/${row.project_id}/generations/${row.id}`,settings:env},()=>row.kind==='suggestions'
   ?(clientOptions.tool?generateReply({project_id:row.project_id,assist:{packet:context.assistPacket,policies:context.policies,evidenceIds:context.evidenceIds},tools:context.tools,options},null,clientOptions.tool):generateSuggestions({project_id:row.project_id,assist:{packet:context.assistPacket,policies:context.policies,evidenceIds:context.evidenceIds},tools:context.tools,options}))
   :runStream({project_id:row.project_id,task:TASKS.USER_REPLY,messages:customerReplyMessages({replies:{packet:context.packet,policies:context.policies}}),tools:context.tools,options,trace}))
  await env.DB.prepare('UPDATE ai_generations SET output_json=? WHERE id=?').bind(JSON.stringify({result,usage:usageResult}),row.id).run()
  await checkCurrent()
  if(row.kind==='suggestions'){
   const completed=await env.DB.prepare(`UPDATE ai_generations SET state='completed',output_json=?,updated_at=? WHERE id=? AND state='running' AND EXISTS(SELECT 1 FROM conversations c JOIN ai_profiles a ON a.id=${assistanceProfileSql} AND a.project_id=c.project_id WHERE c.id=ai_generations.conversation_id AND c.revision=source_revision AND COALESCE((SELECT revision FROM context_subjects WHERE project_id=c.project_id AND subject_id=c.contact_id),0)=source_context_revision AND c.resolved_at IS NULL AND a.id=ai_generations.ai_id AND a.is_enabled=1 AND a.model=json_extract(ai_profile_json,'$.model') AND a.prompt=json_extract(ai_profile_json,'$.prompt'))`).bind(JSON.stringify({result,usage:usageResult}),new Date().toISOString(),row.id).run()
   if(!completed.meta.changes)await transition(env,row.id,'superseded','Conversation or AI policy changed')
   await env.DB.prepare("UPDATE ai_attempts SET state=?,finished_at=? WHERE id=?").bind(completed.meta.changes?'completed':'superseded',new Date().toISOString(),attemptId).run()
   return true
  }
  if(!result?.response?.trim())throw new Error('Provider returned no customer reply')
  const admitted=await admitMessage(env,{projectId:row.project_id,conversationId:row.conversation_id,actor:JSON.parse(row.actor_json) as Actor,localId:`generation:${row.id}`,content:result.response,expectedRevision:row.source_revision,expectedLastMessageId:row.source_last_message_id,generationId:row.id})
  finalCommitted=admitted.accepted
  if(admitted.accepted)await Promise.all([row.conversation_id,`project:${row.project_id}`].map(key=>env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(key)).fetch('https://conversation.internal/broadcast',{method:'POST'})))
  if(admitted.accepted&&!admitted.duplicate){try{await notifyMessage(env,admitted.message,JSON.parse(row.actor_json))}catch(error){await env.DB.prepare('INSERT INTO ai_attempt_events(attempt_id,type,event_json,created_at) VALUES(?,?,?,?)').bind(attemptId,'notification_error',JSON.stringify({error:String(error)}),new Date().toISOString()).run()}}

  if(!admitted.accepted){await transition(env,row.id,'superseded',admitted.reason)}
  await env.DB.prepare("UPDATE ai_attempts SET state=?,finished_at=? WHERE id=?").bind(admitted.accepted?'completed':'superseded',new Date().toISOString(),attemptId).run()
 }catch(error){
  const persisted=await env.DB.prepare('SELECT state FROM ai_generations WHERE id=?').bind(row.id).first<{state:string}>()
  const superseded=String(abort.signal.reason).includes('Conversation superseded')
  const state=finalCommitted?'completed':persisted?.state==='cancelled'?'cancelled':superseded?'superseded':providerStarted?'uncertain':'failed'
  await transition(env,row.id,state,error)
  await env.DB.prepare('UPDATE ai_attempts SET state=?,error=?,finished_at=? WHERE id=?').bind(state,String(error).slice(0,2000),new Date().toISOString(),attemptId).run()
 }finally{clearInterval(timer);clearTimeout(deadline);await settleGenerationUsage(env,row.id);if(row.kind==='suggestions')await publishSuggestions(env,row.project_id,row.conversation_id);const terminal=await env.DB.prepare('SELECT state,error FROM ai_generations WHERE id=?').bind(row.id).first();await emit(env,row,{type:'generation.terminal',operatorOnly:true,generationId:row.id,...terminal});if(row.kind==='reply'&&terminal?.state!=='completed')await emit(env,row,{type:'reply_cancelled',payload:{local_id:`generation:${row.id}`}})}
 return true
}
export async function recoverQueuedGenerations(env:Env){
 const stale=await env.DB.prepare("SELECT id,project_id,conversation_id,kind FROM ai_generations WHERE state='running' AND updated_at<?").bind(new Date(Date.now()-240000).toISOString()).all<any>()
 for(const row of stale.results){await transition(env,row.id,'uncertain','Execution deadline passed without a durable terminal outcome');await env.DB.prepare("UPDATE ai_attempts SET state='uncertain',finished_at=? WHERE generation_id=? AND state='running'").bind(new Date().toISOString(),row.id).run();await settleGenerationUsage(env,row.id);if(row.kind==='suggestions')await publishSuggestions(env,row.project_id,row.conversation_id)}
 const jobs=await env.DB.prepare("SELECT id,project_id FROM ai_generations WHERE state='queued' ORDER BY created_at LIMIT 100").all<{id:string;project_id:string}>()
 for(const job of jobs.results)await env.JOBS.send({type:'ai.generate',id:job.id,projectId:job.project_id})
}

async function emit(env:Env,row:Generation,event:Record<string,unknown>){await env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(row.conversation_id)).fetch('https://conversation.internal/event',{method:'POST',body:JSON.stringify({...event,conversationId:row.conversation_id})})}
export async function onCustomerMessage(env:Env,message:any,actor:Actor){
 if(actor.role!=='contact')return
 const selected=await env.DB.prepare('SELECT a.id,a.model FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id JOIN conversations c ON c.id=ca.conversation_id WHERE c.id=? AND c.project_id=? AND a.project_id=c.project_id AND a.is_enabled=1 AND c.assigned_to IS NULL AND c.resolved_at IS NULL AND c.last_message_id=? AND c.revision=?').bind(message.conversation_id,actor.projectId,message.id,message.revision).first()
 if(!selected)return
 try{assertModelConfigured(env,String(selected.model))}catch{return}
 await requestGeneration(env,{projectId:actor.projectId,conversationId:message.conversation_id,actor,expectedRevision:message.revision,id:`reply:${message.id}`})
}
