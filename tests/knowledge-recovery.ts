import type {Env,Job} from '../src/platform/env'
import {refreshDataset,consumeJob,refreshDueDatasets} from '../src/modules/knowledge/service'
import {queueImport} from '../src/modules/knowledge/import-jobs'

export async function testKnowledgeRecovery(env:Env,check:(condition:unknown,message:string)=>void){
 const sent:Job[]=[]
 const working={...env,JOBS:{send:async(job:Job)=>{sent.push(job)}}} as unknown as Env
 const unavailable={...env,JOBS:{send:async()=>{throw new Error('injected queue delivery failure')}}} as unknown as Env
 // Acknowledged-but-lost delivery models process exit between persisted stage and dispatch.
 const lost={...env,JOBS:{send:async()=>{}}} as unknown as Env
 const dataset='recovery-dataset'
 await env.DB.prepare('INSERT INTO knowledge_datasets(id,project_id,name,created_at) VALUES(?,?,?,?)').bind(dataset,'p','Recovery',Date.now()).run()
 const input={documents:Array.from({length:21},(_,i)=>({url:`https://example.test/recovery/${i}`,title:'Recovery',content:`Retained recovery ${i}`}))}
 const initial=await refreshDataset(unavailable,'p',dataset,input)
 check((await env.DB.prepare('SELECT status FROM knowledge_datasets WHERE id=?').bind(dataset).first<any>()).status==='ingesting','failed initial dispatch retains queued stage')
 await refreshDueDatasets(working)
 const ingest=sent.find(job=>job.id===initial.id)!;sent.length=0
 check(ingest?.type==='knowledge.ingest','schedule recovers initial dispatch')
 await consumeJob(ingest,lost)
 check((await env.DB.prepare('SELECT ingest_cursor FROM knowledge_datasets WHERE id=?').bind(dataset).first<any>()).ingest_cursor===0,'staged corpus survives lost first-page dispatch')
 await refreshDueDatasets(working)
 const first=sent.find(job=>job.id===initial.id)!;sent.length=0
 check(first?.type==='knowledge.page'&&first.cursor===0,'schedule recovers staged first page')
 await consumeJob(first,unavailable)
 await refreshDueDatasets(working)
 const next=sent.find(job=>job.id===initial.id)!;sent.length=0
 check(next?.cursor===1,'schedule resumes committed next cursor after queue failure')
 await consumeJob(next,working)
 check((await env.DB.prepare('SELECT status FROM knowledge_datasets WHERE id=?').bind(dataset).first<any>()).status==='ready','recovered corpus publishes')
 check((await env.DB.prepare('SELECT count(*) n FROM knowledge_documents WHERE version_id=?').bind(initial.id).first<any>()).n===21,'recovery indexes every document once')
 const version=initial.id
 await env.DB.prepare("UPDATE knowledge_datasets SET claim_token='running-crawl',status='crawling',ingest_cursor=-1 WHERE id=?").bind(dataset).run()
 await env.FILES.put('knowledge/crawl/running-crawl.json',JSON.stringify({runId:'retained-provider-run'}))
 await refreshDueDatasets(working)
 check(sent.some(job=>job.type==='knowledge.crawl-poll'&&job.runId==='retained-provider-run'),'crawl recovery polls existing provider run only');sent.length=0
 await env.DB.prepare("UPDATE knowledge_datasets SET status='processing',ingest_started_at=? WHERE id=?").bind(Date.now()-21*60000,dataset).run()
 await refreshDueDatasets(working)
 const expired=await env.DB.prepare('SELECT * FROM knowledge_datasets WHERE id=?').bind(dataset).first<any>()
 check(expired.status==='failed'&&expired.error.includes('uncertain')&&!sent.length,'interrupted potentially paid processing is never replayed')
 check(expired.published_version===version,'interrupted refresh retains old published corpus')
 const imported=await queueImport(unavailable,'p','intercom')
 await refreshDueDatasets(working)
 check(sent.some(job=>job.type==='knowledge.import'&&job.id===imported.id&&job.cursor===0),'initial import dispatch recovers');sent.length=0
 const originalFetch=globalThis.fetch
 globalThis.fetch=(async()=>Response.json({data:[],pages:{page:1,total_pages:1}})) as typeof fetch
 try{await consumeJob({type:'knowledge.import',id:imported.id,projectId:'p',cursor:0},{...unavailable,INTERCOM_TOKEN:'test-fixture'})}finally{globalThis.fetch=originalFetch}
 check((await env.DB.prepare('SELECT cursor,status FROM knowledge_imports WHERE id=?').bind(imported.id).first<any>()).cursor===1,'import commits next cursor before failed dispatch')
 await refreshDueDatasets(working)
 check(sent.some(job=>job.type==='knowledge.import'&&job.id===imported.id&&job.cursor===1),'import recovery dispatches exact retained next cursor');sent.length=0
 await env.DB.prepare("UPDATE knowledge_imports SET status='processing',processing_started_at=? WHERE id=?").bind(Date.now()-21*60000,imported.id).run()
 await refreshDueDatasets(working)
 check((await env.DB.prepare('SELECT status FROM knowledge_imports WHERE id=?').bind(imported.id).first<any>()).status==='failed'&&!sent.length,'stale import processing fails explicitly without cursor rewind')
}
