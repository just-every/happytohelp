import {assistanceProfileSql,replyProfileSql} from './selection'
import {assertModelConfigured} from './configuration'
import {publishSuggestions} from './presentation'
import type { Actor,Env } from '../../platform/env'
export interface Generation {id:string;project_id:string;conversation_id:string;state:string;source_revision:number;source_context_revision:number;source_last_message_id:string|null;actor_json:string;model:string;ai_id:string;ai_profile_json:string;kind:string;instruction:string;options_json:string}
export async function requestGeneration(env:Env,input:{projectId:string;conversationId:string;actor:Actor;expectedRevision:number;id?:string;kind?:'reply'|'suggestions';instruction?:string;options?:{tool?:string;message?:string;client_request_id?:string;display_request_version?:number;loading_message?:string}}){
 const profileSql=input.kind==='suggestions'?assistanceProfileSql:replyProfileSql
 const selected=await env.DB.prepare(`SELECT a.model FROM conversations c JOIN ai_profiles a ON a.id=${profileSql} AND a.project_id=c.project_id AND a.is_enabled=1 WHERE c.project_id=? AND c.id=?`).bind(input.projectId,input.conversationId).first<{model:string}>()
 if(!selected)throw new Error('CONFIGURATION_REQUIRED: enabled selected conversation AI')
 assertModelConfigured(env,selected.model)
 if(input.actor.projectId!==input.projectId)throw new Error('Project access denied')
 if(input.instruction && (input.actor.role==='contact'||input.instruction.length>16000))throw new Error('Operator instruction denied or too long')
 if(input.options?.tool&&!['improve','extend','shorten','complete'].includes(input.options.tool))throw new Error('Unknown assistant editing tool')
 if(input.options&&input.actor.role==='contact')throw new Error('Operator options denied')
 const optionsJson=JSON.stringify(input.options||{})
 if(optionsJson.length>40000)throw new Error('Operator options too long')
 const id=input.id||crypto.randomUUID(),now=new Date().toISOString()
 const existing=await env.DB.prepare('SELECT * FROM ai_generations WHERE id=?').bind(id).first<Generation>()
 if(existing){if(existing.project_id!==input.projectId||existing.conversation_id!==input.conversationId||existing.source_revision!==input.expectedRevision||existing.actor_json!==JSON.stringify(input.actor)||existing.kind!==(input.kind||'reply')||existing.instruction!==(input.instruction||'')||existing.options_json!==optionsJson)throw new Error('Generation command conflict');return {id,state:existing.state}}
 await env.DB.prepare('INSERT OR IGNORE INTO context_subjects(project_id,subject_id) SELECT project_id,contact_id FROM conversations WHERE id=? AND project_id=?').bind(input.conversationId,input.projectId).run()
 const result=await env.DB.prepare(`INSERT OR IGNORE INTO ai_generations(id,project_id,conversation_id,state,source_revision,source_context_revision,source_last_message_id,actor_json,model,ai_id,ai_profile_json,kind,instruction,options_json,created_at,updated_at)
 SELECT ?,c.project_id,c.id,'queued',c.revision,(SELECT revision FROM context_subjects WHERE project_id=c.project_id AND subject_id=c.contact_id),c.last_message_id,?,a.model,a.id,json_object('id',a.id,'model',a.model,'prompt',a.prompt),?,?,?,?,?
 FROM conversations c JOIN ai_profiles a ON a.id=${profileSql} AND a.project_id=c.project_id AND a.is_enabled=1
 WHERE c.id=? AND c.project_id=? AND c.revision=? AND c.resolved_at IS NULL AND (? != 'contact' OR c.contact_id=?)`).bind(id,JSON.stringify(input.actor),input.kind||'reply',input.instruction||'',optionsJson,now,now,input.conversationId,input.projectId,input.expectedRevision,input.actor.role,input.actor.contactId||input.actor.id).run()
 if(!result.meta.changes)throw new Error('Generation admission denied or command already exists')
 if(input.kind==='suggestions'){await env.DB.prepare("UPDATE ai_generations SET state='superseded' WHERE project_id=? AND conversation_id=? AND kind='suggestions' AND state IN ('queued','running') AND rowid<(SELECT rowid FROM ai_generations WHERE id=?)").bind(input.projectId,input.conversationId,id).run();await publishSuggestions(env,input.projectId,input.conversationId)}
 // The persisted queued record is authoritative; scheduled recovery resends this ID if dispatch fails.
 await env.JOBS.send({type:'ai.generate',id,projectId:input.projectId})
 return {id,state:'queued'}
}
export async function saveEvent(env:Env,attemptId:string,event:any){
 if(['agent_start','cost_update','agent_done','error','stream_end'].includes(event.type))await env.DB.prepare('INSERT INTO ai_attempt_events(attempt_id,type,event_json,created_at) VALUES(?,?,?,?)').bind(attemptId,event.type,JSON.stringify(event),new Date().toISOString()).run()
 if(event.type==='agent_start' && event.request_id)await env.DB.prepare('INSERT OR IGNORE INTO ai_round_usage(attempt_id,request_id,model) VALUES(?,?,?)').bind(attemptId,event.request_id,event.agent?.model||null).run()
 if(event.type==='cost_update'&&event.request_id)await env.DB.prepare(`INSERT INTO ai_round_usage(attempt_id,request_id,model,usage_json,observed) VALUES(?,?,?,?,1) ON CONFLICT(attempt_id,request_id) DO UPDATE SET model=excluded.model,usage_json=excluded.usage_json,observed=1`).bind(attemptId,event.request_id,event.usage?.model||null,JSON.stringify(event.usage)).run()
}
export async function transition(env:Env,id:string,state:string,error?:unknown){await env.DB.prepare("UPDATE ai_generations SET state=?,error=?,updated_at=? WHERE id=? AND state='running'").bind(state,error?String(error).slice(0,2000):null,new Date().toISOString(),id).run()}
