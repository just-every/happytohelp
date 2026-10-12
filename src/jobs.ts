import {dispatchIntegrations} from './modules/api-integrations/dispatch'
import {advanceImport,getWorkRun} from './modules/move-in/service'
import {generationEffects} from './edition/ai/generation-effects'
import {requestContextModel} from './edition/ai/customer-context-provider'
import {isProjectActive} from './platform/project-status'
import type { Env,Job } from './platform/env'
import { handleGeneration,recoverQueuedGenerations } from './modules/ai-support/service'
import { executeTrainingCase } from './edition/ai/training'
import { consumeJob as consumeKnowledge,refreshDueDatasets } from './modules/knowledge'
import { executeTrainingRun,recoverTrainingRuns } from './modules/training-runs'
import { consumeContextJob,recoverContextJobs } from './modules/customer-context'
import { recoverLocalResultEffects } from './modules/local-computer'
import { localComputerIntegration } from './edition/local-computer'
import { consumeJob as consumeBrand,recoverBrandJobs } from './modules/site-preview/brand'
import { handleLeadJob,recoverLeadJobs } from './modules/integrations'
import { applyMessageEffects } from './message-effects'
import { pruneCounters } from './platform/usage-counters'
import type { Actor } from './platform/env'

export async function consumeJob(job:Job,env:Env) {
 if(job.type!=='lead.process'&&!await isProjectActive(env,job.projectId))return
 if(job.type==='integrations'){await dispatchIntegrations(env,job.projectId);return}
 if(job.type==='move-in'){const run=await getWorkRun(env,job.id);if(run&&run.project_id===job.projectId)await advanceImport(env,run);return}
 if(await handleGeneration(env,job,generationEffects))return
 if(await consumeKnowledge(job,env))return
 if(await consumeContextJob(job,env,requestContextModel))return
 if(await consumeBrand(job,env))return
 if(await handleLeadJob(env,job))return
 if(job.type==='training'){
  await executeTrainingRun(env,job.id,executeTrainingCase)
  return
 }
 throw new Error(`Unknown persisted job type: ${job.type}`)
}
export async function runScheduled(env:Env) {
 await dispatchIntegrations(env)
 const pending=await env.DB.prepare("SELECT project_id,conversation_id,MAX(id) last_id FROM conversation_outbox WHERE delivered_at IS NULL AND EXISTS(SELECT 1 FROM projects p WHERE p.id=conversation_outbox.project_id) AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=conversation_outbox.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL) GROUP BY project_id,conversation_id LIMIT 100").all<{project_id:string;conversation_id:string;last_id:number}>()
 for(const row of pending.results){
  if(!await isProjectActive(env,row.project_id))continue
  const messages=await env.DB.prepare('SELECT o.id outbox_id,m.* FROM conversation_outbox o JOIN messages m ON m.id=o.message_id WHERE o.conversation_id=? AND o.id<=? AND o.delivered_at IS NULL ORDER BY o.id LIMIT 100').bind(row.conversation_id,row.last_id).all<Record<string,unknown>>()
  let through:number|undefined
  for(const message of messages.results){
   const actor:Actor={id:String(message.actor_id),projectId:row.project_id,role:message.actor_role==='contact'?'contact':'operator',...(message.actor_role==='contact'?{contactId:String(message.actor_id)}:{})}
   try { await applyMessageEffects(env,message,actor);through=Number(message.outbox_id) }
   catch { console.error('Message follow-up pending',String(message.id));break }
  }
  const sent=await env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(row.conversation_id)).fetch('https://conversation.internal/broadcast',{method:'POST'})
  const projectSent=await env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(`project:${row.project_id}`)).fetch('https://conversation.internal/broadcast',{method:'POST'})
  if(sent.ok&&projectSent.ok&&through!==undefined)await env.DB.prepare('UPDATE conversation_outbox SET delivered_at=? WHERE conversation_id=? AND id<=? AND delivered_at IS NULL').bind(Date.now(),row.conversation_id,through).run()
 }
 await recoverQueuedGenerations(env,generationEffects)
 await refreshDueDatasets(env)
 await recoverContextJobs(env)
 await recoverTrainingRuns(env)
 await recoverLocalResultEffects(env,localComputerIntegration)
 await recoverBrandJobs(env)
 await recoverLeadJobs(env)
 await pruneCounters(env)
}
