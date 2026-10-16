import assert from 'node:assert/strict'
import {knowledgeApp} from './app.mjs'

const unavailable={'x-test-fault':'queue-unavailable'},lost={'x-test-fault':'queue-lost'}

// Knowledge work survives lost or refused queue sends from durable state, never replays uncertain paid work,
// and a deleted workspace makes no further provider calls while keeping its published corpus.
export async function recoveryJourney(){
 const k=await knowledgeApp({bindings:{INTERCOM_TOKEN:'test-fixture'}}),{app,p,call}=k
 const state=(id,columns='*')=>app.first(`SELECT ${columns} FROM knowledge_datasets WHERE id=?`,id)
 const sweep=async()=>{await app.scheduled();return app.takeJobs()}
 try{
  const dataset=await k.dataset('Recovery'),documents=Array.from({length:21},(_,i)=>({url:`https://example.test/recovery/${i}`,title:'Recovery',content:`Retained recovery ${i}`}))
  // The first dispatch fails: the stage is durable and the schedule dispatches it.
  const initial=(await call(`/api/knowledge/${p}/datasets/${dataset}/refresh`,{body:{documents},headers:unavailable,status:202})).data
  assert.equal((await state(dataset)).status,'ingesting')
  const ingest=(await sweep()).find(job=>job.id===initial.id);assert.equal(ingest?.type,'knowledge.ingest')
  // The first page is lost after its stage committed; the schedule recovers it.
  await app.runJobs([ingest],lost);assert.equal((await state(dataset)).ingest_cursor,0)
  const first=(await sweep()).find(job=>job.id===initial.id);assert.equal(first?.type,'knowledge.page');assert.equal(first.cursor,0)
  // The next page's send fails after its cursor committed; the schedule resumes the committed cursor.
  await app.runJobs([first],unavailable);const next=(await sweep()).find(job=>job.id===initial.id);assert.equal(next?.cursor,1)
  await app.runJobs([next]);assert.equal((await state(dataset)).status,'ready');assert.equal((await app.first('SELECT count(*) n FROM knowledge_documents WHERE version_id=?',initial.id)).n,21,'every document indexed once')
  // A running crawl is recovered by polling its existing provider run only.
  await app.db.prepare("UPDATE knowledge_datasets SET claim_token='running-crawl',status='crawling',ingest_cursor=-1 WHERE id=?").bind(dataset).run()
  await (await app.files).put('knowledge/crawl/running-crawl.json',JSON.stringify({runId:'retained-provider-run'}))
  assert.ok((await sweep()).some(job=>job.type==='knowledge.crawl-poll'&&job.runId==='retained-provider-run'))
  // Interrupted, possibly paid processing fails as uncertain and keeps the published corpus.
  await app.db.prepare("UPDATE knowledge_datasets SET status='processing',ingest_started_at=? WHERE id=?").bind(Date.now()-21*60000,dataset).run()
  assert.deepEqual(await sweep(),[]);const expired=await state(dataset);assert.equal(expired.status,'failed');assert.match(expired.error,/uncertain/);assert.equal(expired.published_version,initial.id)
  // An import's first dispatch, and a send failing after its next cursor committed, both recover exactly.
  const imported=(await call(`/api/knowledge/${p}/import/intercom`,{body:{},headers:unavailable,status:200})).data
  const importJob=(await sweep()).find(job=>job.type==='knowledge.import'&&job.id===imported.id);assert.equal(importJob?.cursor,0)
  k.provider=async()=>Response.json({data:[],pages:{page:1,total_pages:1}})
  await app.runJobs([importJob],unavailable);assert.equal((await app.first('SELECT cursor FROM knowledge_imports WHERE id=?',imported.id)).cursor,1)
  assert.ok((await sweep()).some(job=>job.type==='knowledge.import'&&job.id===imported.id&&job.cursor===1))
  await app.db.prepare("UPDATE knowledge_imports SET status='processing',processing_started_at=? WHERE id=?").bind(Date.now()-21*60000,imported.id).run()
  assert.deepEqual(await sweep(),[]);assert.equal((await app.first('SELECT status FROM knowledge_imports WHERE id=?',imported.id)).status,'failed','stale import processing fails without rewinding')

  // A deleted workspace: its queued stages run without a provider call, admission and schedules stop, the corpus stays.
  await app.configure({OPENAI_API_KEY:'fixture',KNOWLEDGE_EMBEDDING_MODEL:'fixture',QDRANT_URL:'https://qdrant.test',QDRANT_API_KEY:'fixture'})
  const gone=await app.seedWorkspace('deleted'),projectId=gone.projectId,owner={token:gone.tokens.owner}
  await app.db.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?)').bind(projectId,'{}',Date.now()).run()
  const deletedDataset=(await app.call(`/api/knowledge/${projectId}/datasets`,{...owner,body:{name:'Deleted test'},status:201})).data.id,docs={documents:[{url:'https://example.com/published',title:'Published',content:'Prior published corpus'}]}
  const refresh=(body,headers)=>app.call(`/api/knowledge/${projectId}/datasets/${deletedDataset}/refresh`,{...owner,body,headers})
  const prior=(await refresh(docs)).data;await k.drain()
  const pending=(await refresh({crawl:{url:'https://example.com'}})).data,pendingImport=(await app.call(`/api/knowledge/${projectId}/import/intercom`,{...owner,body:{},status:200})).data;await app.takeJobs()
  const markDeleted=()=>app.db.prepare('UPDATE project_settings SET settings_json=?,updated_at=? WHERE project_id=?').bind(JSON.stringify({deleted_at:Date.now()}),Date.now(),projectId).run()
  await markDeleted();const calls=app.requests.length;k.provider=async()=>{throw new Error('a deleted workspace must not reach a provider')}
  await app.runJobs([{type:'knowledge.ingest',id:pending.id,projectId,datasetId:deletedDataset},{type:'knowledge.crawl-poll',id:pending.id,projectId,datasetId:deletedDataset,runId:'remote'},{type:'knowledge.page',id:pending.id,projectId,datasetId:deletedDataset,cursor:0},{type:'knowledge.import',id:pendingImport.id,projectId,cursor:0}])
  assert.equal(app.requests.length,calls,'deleted queued knowledge jobs make no provider call')
  assert.notEqual((await refresh(docs)).status,202,'a deleted workspace cannot start a refresh')
  await app.db.prepare('UPDATE knowledge_datasets SET next_refresh_at=0 WHERE id=?').bind(deletedDataset).run()
  assert.ok(!(await sweep()).some(job=>job.projectId===projectId),'deleted schedules and recovery never dispatch');assert.equal((await state(deletedDataset)).published_version,prior.id)
  // Deletion while an embedding call is in flight lets that call finish but blocks the next one and publication.
  await app.db.prepare("UPDATE project_settings SET settings_json='{}' WHERE project_id=?").bind(projectId).run();await app.db.prepare('UPDATE knowledge_datasets SET claim_token=NULL,next_refresh_at=NULL WHERE id=?').bind(deletedDataset).run()
  const running=(await refresh({...docs,semantic:true})).data;for(let n=0;n<2;n++)await app.runJobs(await app.takeJobs())
  let embeddings=0;k.provider=async()=>{embeddings++;await markDeleted();return Response.json({data:[{index:0,embedding:[1,0]}]})}
  await app.runJobs(await app.takeJobs())
  const inflight=await state(deletedDataset,'status,published_version,claim_token');assert.equal(embeddings,1);assert.deepEqual({...inflight},{status:'processing',published_version:prior.id,claim_token:running.id})
  // A deleted backlog never starves an active workspace's recovery.
  for(let offset=0;offset<101;offset+=25)await app.db.batch(Array.from({length:Math.min(25,101-offset)},(_,n)=>app.db.prepare("INSERT INTO knowledge_datasets(id,project_id,name,status,claim_token,created_at) VALUES(?,?,?,'ingesting',?,0)").bind(`dead-backlog-${offset+n}`,projectId,'Backlog',`dead-claim-${offset+n}`)))
  const live=await app.seedWorkspace('live'),liveDataset=(await app.call(`/api/knowledge/${live.projectId}/datasets`,{token:live.tokens.owner,body:{name:'Live'},status:201})).data.id
  const liveRefresh=(await app.call(`/api/knowledge/${live.projectId}/datasets/${liveDataset}/refresh`,{token:live.tokens.owner,body:docs,headers:lost,status:202})).data
  assert.ok((await sweep()).some(job=>job.id===liveRefresh.id),'the live workspace recovers ahead of the deleted backlog')
 }finally{await k.close()}
}
