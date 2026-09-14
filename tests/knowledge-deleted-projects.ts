import type {Env,Job} from '../src/platform/env'
import {refreshDataset,consumeJob,refreshDueDatasets} from '../src/modules/knowledge/service'
import {queueImport} from '../src/modules/knowledge/import-jobs'
export async function testDeletedKnowledgeProjects(env:Env,check:(condition:unknown,message:string)=>void){
 const projectId='knowledge-deleted';const datasetId='knowledge-deleted-dataset';const sent:Job[]=[];
 const runtime={...env,JOBS:{send:async(job:Job)=>{sent.push(job)}},OPENAI_API_KEY:'fixture',KNOWLEDGE_EMBEDDING_MODEL:'fixture',QDRANT_URL:'https://qdrant.test',QDRANT_API_KEY:'fixture'} as unknown as Env;
 await env.DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(projectId,'Deleted test','deleted-widget','https://example.com',Date.now()).run();
 await env.DB.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?)').bind(projectId,'{}',Date.now()).run();
 await env.DB.prepare('INSERT INTO knowledge_datasets(id,project_id,name,created_at) VALUES(?,?,?,?)').bind(datasetId,projectId,'Deleted test',Date.now()).run();
 const docs={documents:[{url:'https://example.com/published',title:'Published',content:'Prior published corpus'}]};
 const prior=await refreshDataset(runtime,projectId,datasetId,docs);while(sent.length)await consumeJob(sent.shift()!,runtime);
 const pending=await refreshDataset(runtime,projectId,datasetId,{crawl:{url:'https://example.com'}});const imported=await queueImport(runtime,projectId,'intercom');sent.length=0;
 const deleted=async()=>env.DB.prepare('UPDATE project_settings SET settings_json=?,updated_at=? WHERE project_id=?').bind(JSON.stringify({deleted_at:Date.now()}),Date.now(),projectId).run();
 await deleted();let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=(async()=>{calls++;throw new Error('Deleted project provider must never execute')}) as typeof fetch;
 try{
 for(const job of [{type:'knowledge.ingest',id:pending.id,projectId,datasetId},{type:'knowledge.crawl-poll',id:pending.id,projectId,datasetId,runId:'remote'},{type:'knowledge.page',id:pending.id,projectId,datasetId,cursor:0},{type:'knowledge.import',id:imported.id,projectId,cursor:0}])await consumeJob(job,runtime);
 check(calls===0,'deleted queued knowledge jobs make zero provider calls');
 let denied=false;try{await refreshDataset(runtime,projectId,datasetId,docs)}catch{denied=true}check(denied,'deleted refresh admission denied');
 await env.DB.prepare('UPDATE knowledge_datasets SET next_refresh_at=? WHERE id=?').bind(0,datasetId).run();await refreshDueDatasets(runtime);
 check(!sent.some(job=>job.projectId===projectId),'deleted scheduled and recovery stages never dispatch');
 check((await env.DB.prepare('SELECT published_version FROM knowledge_datasets WHERE id=?').bind(datasetId).first<any>()).published_version===prior.id,'deleted queued work preserves published corpus');
 // A provider request already in flight may complete; deletion blocks its next call and publication.
 await env.DB.prepare("UPDATE project_settings SET settings_json='{}' WHERE project_id=?").bind(projectId).run();await env.DB.prepare('UPDATE knowledge_datasets SET claim_token=NULL,next_refresh_at=NULL WHERE id=?').bind(datasetId).run();sent.length=0;
 const running=await refreshDataset(runtime,projectId,datasetId,{...docs,semantic:true});await consumeJob(sent.shift()!,runtime);await consumeJob(sent.shift()!,runtime);
 globalThis.fetch=(async()=>{calls++;await deleted();return Response.json({data:[{index:0,embedding:[1,0]}]})}) as typeof fetch;
 await consumeJob(sent.shift()!,runtime);
 const state=await env.DB.prepare('SELECT status,published_version,claim_token FROM knowledge_datasets WHERE id=?').bind(datasetId).first<any>();
 check(calls===1,'deletion during embedding blocks subsequent vector-provider calls');check(state.published_version===prior.id&&state.claim_token===running.id&&state.status==='processing','in-flight deletion retains uncertainty and old corpus without false cancellation');
 // Deleted backlogs must be filtered before scheduler limits, not after selection.
 const liveProject='knowledge-live-after-backlog';await env.DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(liveProject,'Live backlog','live-backlog-widget','https://example.com',Date.now()).run();
 for(let offset=0;offset<101;offset+=25)await env.DB.batch(Array.from({length:Math.min(25,101-offset)},(_,n)=>env.DB.prepare("INSERT INTO knowledge_datasets(id,project_id,name,status,claim_token,created_at) VALUES(?,?,?,'ingesting',?,0)").bind(`dead-backlog-${offset+n}`,projectId,'Backlog',`dead-claim-${offset+n}`)));
 await env.DB.prepare("INSERT INTO knowledge_datasets(id,project_id,name,created_at) VALUES('live-backlog',?,'Live',0)").bind(liveProject).run();const live=await refreshDataset(runtime,liveProject,'live-backlog',docs);sent.length=0;
 await refreshDueDatasets(runtime);check(sent.some(job=>job.id===live.id),'deleted backlog cannot starve active knowledge recovery before LIMIT');
 }finally{globalThis.fetch=originalFetch}
}
