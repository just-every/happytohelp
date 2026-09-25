import {isProjectActive} from '../../platform/project-status'
import {dispatchKnowledgeJob} from './recovery'
import type { Env,Job } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { chunks,embeddings,qdrant,collection,type DocumentInput } from './providers'
export interface StagedDocument extends DocumentInput { id:string }
export async function stageCorpus(env:Env,job:Job,documents:DocumentInput[],semantic:boolean){
 if(!await isProjectActive(env,job.projectId))return;
 const embeddingModel=semantic?env.KNOWLEDGE_EMBEDDING_MODEL:null;if(semantic&&(typeof embeddingModel!=='string'||!embeddingModel))throw new Error('CONFIGURATION_INVALID: KNOWLEDGE_EMBEDDING_MODEL required');
 const fingerprint=await hashToken(JSON.stringify(documents));
 const staged=documents.map(d=>({...d,id:crypto.randomUUID()}));
 const pieces=staged.flatMap(d=>chunks(d.content).map(content=>({documentId:d.id,content})));
 await env.FILES.put(`knowledge/corpus/${job.id}.json`,JSON.stringify(staged));
 for(let cursor=0;cursor<staged.length;cursor+=20)await env.FILES.put(`knowledge/pages/${job.id}/documents/${cursor/20}.json`,JSON.stringify(staged.slice(cursor,cursor+20)));
 for(let cursor=0;cursor<pieces.length;cursor+=32)await env.FILES.put(`knowledge/pages/${job.id}/vectors/${cursor/32}.json`,JSON.stringify(pieces.slice(cursor,cursor+32)));
 await env.DB.prepare('INSERT INTO knowledge_versions(id,dataset_id,fingerprint,created_at,semantic,embedding_model) VALUES(?,?,?,?,?,?)').bind(job.id,job.datasetId,fingerprint,Date.now(),semantic?1:0,embeddingModel).run();
 const state={documentPages:Math.ceil(staged.length/20),vectorPages:semantic?Math.ceil(pieces.length/32):0,semantic,embeddingModel};
 await env.FILES.put(`knowledge/pages/${job.id}/manifest.json`,JSON.stringify(state));
 await env.DB.prepare("UPDATE knowledge_datasets SET ingest_cursor=0,status='ingesting' WHERE id=? AND claim_token=?").bind(job.datasetId,job.id).run();
 await dispatchKnowledgeJob(env,{...job,type:'knowledge.page',cursor:0})
}
export async function consumePage(job:Job,env:Env){
 if(!await isProjectActive(env,job.projectId))return true;
 const cursor=Number(job.cursor);const claim=await env.DB.prepare("UPDATE knowledge_datasets SET status='processing',ingest_started_at=? WHERE id=? AND project_id=? AND claim_token=? AND ingest_cursor=? AND status='ingesting'").bind(Date.now(),job.datasetId,job.projectId,job.id,cursor).run();
 if(!claim.meta.changes)return true;
 try{
 const manifest=await (await env.FILES.get(`knowledge/pages/${job.id}/manifest.json`))!.json<{documentPages:number;vectorPages:number;semantic:boolean;embeddingModel:string}>();
 if(cursor<manifest.documentPages){
 const docs=await(await env.FILES.get(`knowledge/pages/${job.id}/documents/${cursor}.json`))!.json<StagedDocument[]>();
 await env.DB.batch(docs.map(d=>env.DB.prepare('INSERT INTO knowledge_documents(id,version_id,url,title,content) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(d.id,job.id,d.url,d.title,d.content)))
 }else if(cursor<manifest.documentPages+manifest.vectorPages){
 const page=cursor-manifest.documentPages;const pieces=await(await env.FILES.get(`knowledge/pages/${job.id}/vectors/${page}.json`))!.json<Array<{documentId:string;content:string}>>();
 if(!await isProjectActive(env,job.projectId))return true;
 const vectors=await embeddings({...env,KNOWLEDGE_EMBEDDING_MODEL:manifest.embeddingModel},pieces.map(p=>p.content));
 if(!await isProjectActive(env,job.projectId))return true;
 if(page===0)await qdrant(env,`/collections/${collection(job.id)}`,'PUT',{vectors:{size:vectors[0].length,distance:'Cosine'}});
 if(!await isProjectActive(env,job.projectId))return true;
 await qdrant(env,`/collections/${collection(job.id)}/points?wait=true`,'PUT',{points:pieces.map((p,i)=>({id:crypto.randomUUID(),vector:vectors[i],payload:p}))})
 }
 if(!await isProjectActive(env,job.projectId))return true;
 const next=cursor+1;
 if(next<manifest.documentPages+manifest.vectorPages){await env.DB.prepare("UPDATE knowledge_datasets SET ingest_cursor=?,status='ingesting' WHERE id=? AND claim_token=? AND ingest_cursor=?").bind(next,job.datasetId,job.id,cursor).run();await dispatchKnowledgeJob(env,{...job,cursor:next});return true}
 const dataset=await env.DB.prepare('SELECT d.*,v.fingerprint old_fingerprint FROM knowledge_datasets d LEFT JOIN knowledge_versions v ON v.id=d.published_version WHERE d.id=? AND d.claim_token=?').bind(job.datasetId,job.id).first<any>();
 if(!dataset)return true;const current=await env.DB.prepare('SELECT fingerprint FROM knowledge_versions WHERE id=?').bind(job.id).first<{fingerprint:string}>();
 const unchanged=current?.fingerprint===dataset.old_fingerprint?dataset.unchanged_count+1:0;const days=dataset.refresh_mode==='adaptive'?[1,2,4,7,14,30][Math.min(unchanged,5)]:({daily:1,weekly:7,monthly:30} as Record<string,number>)[dataset.refresh_mode];
 await env.DB.prepare("UPDATE knowledge_datasets SET published_version=?,status='ready',claim_token=NULL,last_refreshed_at=?,unchanged_count=?,next_refresh_at=? WHERE id=? AND claim_token=? AND ingest_cursor=? AND EXISTS(SELECT 1 FROM projects p WHERE p.id=knowledge_datasets.project_id AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=p.id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL))").bind(job.id,Date.now(),unchanged,days?Date.now()+days*86400000:null,job.datasetId,job.id,cursor).run();return true
 }catch(error){await env.DB.prepare("UPDATE knowledge_datasets SET status='failed',error=?,claim_token=NULL,next_refresh_at=NULL WHERE id=? AND claim_token=?").bind(String(error),job.datasetId,job.id).run();return true}
}
