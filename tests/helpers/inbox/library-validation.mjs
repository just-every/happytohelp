import assert from 'node:assert/strict'
import {startApp,sha} from '../../journeys/kit/app.mjs'

// Library inputs are validated before storage: crawl limits on datasets (including a crawl started from stored
// out-of-range limits, which never reaches the crawler), contacts without any identifier, and the last owner.
export async function libraryValidationJourney(){
 let calls=0
 const app=await startApp({captureQueue:true,bindings:{APIFY_TOKEN:'fixture',APIFY_CRAWLER_ACTOR_ID:'actor'},outbound:async()=>{calls++;throw new Error('provider must not be called')}}),DB=app.db
 const call=(prefix,path,method,body)=>app.request(prefix+path,{raw:true,method,headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
 try{
  await DB.batch([DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://widget.example',1)"),DB.prepare("INSERT INTO users VALUES('u','owner@example.com','Owner',1)"),DB.prepare("INSERT INTO memberships VALUES('p','u','owner')"),DB.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(sha('token'),Date.now()+999999)])
  const base={name:'Docs',url:'https://example.test'}
  for(const patch of [{max_crawl_depth:-5},{max_crawl_pages:99999999},{max_crawl_depth:101},{max_crawl_pages:0},{max_crawl_depth:1.5},{max_crawl_pages:'50'},{max_crawl_depth:''}]){
   const response=await call('/api/knowledge','/p/datasets','POST',{...base,...patch});assert.equal(response.status,400,JSON.stringify(patch));assert.match((await response.json()).error,/Max crawl (depth|pages)/)
  }
  assert.equal((await DB.prepare('SELECT count(*) n FROM knowledge_datasets').first()).n,0,'refused datasets are not stored')
  const created=await call('/api/knowledge','/p/datasets','POST',{...base,max_crawl_depth:100,max_crawl_pages:1000});assert.equal(created.status,201);const {id}=await created.json()
  const defaults=await call('/api/knowledge','/p/datasets','POST',base);assert.equal(defaults.status,201,'omitted limits keep the stored defaults')
  for(const patch of [{max_crawl_depth:-1},{max_crawl_pages:10001}])assert.equal((await call('/api/knowledge',`/p/datasets/${id}`,'PUT',{...base,...patch})).status,400,JSON.stringify(patch))
  assert.equal((await call('/api/knowledge',`/p/datasets/${id}`,'PUT',{...base,max_crawl_depth:7,max_crawl_pages:70})).status,200)
  assert.deepEqual(await DB.prepare('SELECT max_crawl_depth d,max_crawl_pages n FROM knowledge_datasets WHERE id=?').bind(id).first(),{d:7,n:70})

  for(const body of [{},{name:''},{name:'   ',email:'',external_id:''},{email:null,external_id:null}]){
   const response=await call('/api/management','/projects/p/contacts','POST',body);assert.equal(response.status,400,JSON.stringify(body));assert.match(await response.text(),/name, an email or an external ID/)
  }
  assert.equal((await DB.prepare('SELECT count(*) n FROM contacts').first()).n,0,'an empty contact is not stored')
  for(const body of [{name:'Ada'},{email:'ada@example.test'},{external_id:'crm-1'}])assert.equal((await call('/api/management','/projects/p/contacts','POST',body)).status,201,JSON.stringify(body))
  assert.equal((await DB.prepare('SELECT count(*) n FROM contacts').first()).n,3)
  const owner=await call('/api/management','/projects/p/agents/u','DELETE');assert.equal(owner.status,409);assert.match(await owner.text(),/last owner/i,'the last-owner refusal explains itself')
  // Limits already stored out of range never start the crawler.
  const stored=(await (await call('/api/knowledge','/p/datasets','POST',{name:'Stored',url:'https://example.test',max_crawl_depth:3,max_crawl_pages:10})).json()).id
  await app.takeJobs();const before=calls
  for(const [column,value] of [['max_crawl_depth',-5],['max_crawl_pages',99999999]]){
   await DB.prepare(`UPDATE knowledge_datasets SET ${column}=?,claim_token=NULL,status='ready' WHERE id=?`).bind(value,stored).run()
   const started=await call('/api/knowledge',`/p/datasets/${stored}/crawl`,'POST',{});if(started.ok)for(const job of (await app.takeJobs()).filter(job=>job.datasetId===stored))await app.runJobs([job])
   const after=await DB.prepare('SELECT status,error FROM knowledge_datasets WHERE id=?').bind(stored).first();assert.ok(!started.ok||after.status==='failed',column+': '+JSON.stringify(after));await DB.prepare('UPDATE knowledge_datasets SET max_crawl_depth=3,max_crawl_pages=10 WHERE id=?').bind(stored).run()
  }
  assert.equal(calls,before,'the crawler is never called with stored out-of-range limits')
 }finally{await app.close()}
}
