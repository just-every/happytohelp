import assert from 'node:assert/strict'
import {startApp} from '../../journeys/kit/app.mjs'

// Lead operations for platform administrators: queued processing grounded in the lead's own website,
// recorded usage, no repeated paid work, a mandatory review before sending, and uncertain recovery.
export async function leadsJourney(){
 let modelCalls=0
 const app=await startApp({captureQueue:true,bindings:{OPENAI_API_KEY:'fixture-key',LEAD_MODEL:'fixture-model',EMAIL_API_KEY:'fixture-mail',EMAIL_FROM:'sender@example.com'},outbound:async request=>{
  const url=request.url
  if(url.startsWith('https://cloudflare-dns.com'))return Response.json({Status:0,Answer:[{type:1,data:'1.1.1.1'}]})
  if(url==='https://lead.example/')return new Response('<p>A shop. Contact hello@lead.example.</p>')
  if(url==='https://redirect.example/')return new Response(null,{status:302,headers:{Location:'https://target.example/'}})
  if(url==='https://api.openai.com/v1/chat/completions'){modelCalls++;return Response.json({choices:[{message:{content:JSON.stringify({email:'hello@lead.example',subject:'A support conversation',content:'A reviewed draft.'})}}],usage:{prompt_tokens:12,completion_tokens:8}})}
  if(url==='https://api.resend.com/emails')return Response.json({id:'delivered'})
  throw new Error('Unexpected provider URL '+url)
 }})
 try{
  const workspace=await app.seedWorkspace('leads'),admin=workspace.tokens.owner,operator=workspace.tokens.operator
  await app.db.prepare('INSERT INTO platform_admins VALUES(?)').bind(workspace.users.owner).run()
  const create=async website=>(await app.call('/api/management/admin/leads',{token:admin,body:{name:'Owner',website},status:201})).data.data.id
  assert.equal((await app.call('/api/management/admin/leads',{token:operator,body:{name:'Owner',website:'https://lead.example'}})).status,403,'platform administrators only')
  const lead=await create('https://lead.example'),redirected=await create('https://redirect.example')
  const queued=(await app.call(`/api/management/admin/leads/${lead}/process`,{token:admin,method:'PUT',body:{},status:202})).data
  const redirectQueued=(await app.call(`/api/management/admin/leads/${redirected}/process`,{token:admin,method:'PUT',body:{},status:202})).data
  const jobs=await app.takeJobs();assert.equal(jobs.length,2);for(const job of jobs)await app.runJobs([job])
  assert.equal((await app.first('SELECT status FROM leads WHERE id=?',lead)).status,'processed');assert.equal((await app.first('SELECT email FROM leads WHERE id=?',lead)).email,'hello@lead.example','the address comes from the lead\'s own site')
  const refusal=await app.first('SELECT state,error FROM lead_jobs WHERE id=?',redirectQueued.id);assert.equal(refusal.state,'failed');assert.match(refusal.error,/redirect/i)
  assert.equal(modelCalls,1);await app.runJobs([jobs[0]]);assert.equal(modelCalls,1,'a redelivered job never repeats paid work')
  assert.equal((await app.first('SELECT usage_json FROM lead_jobs WHERE id=?',queued.id)).usage_json,'{"prompt_tokens":12,"completion_tokens":8}')
  // A draft is sent only after review, with the provider's receipt.
  assert.notEqual((await app.call(`/api/management/admin/leads/${lead}/send`,{token:admin,method:'PUT',body:{}})).status,200)
  await app.call(`/api/management/admin/leads/${lead}`,{token:admin,method:'PUT',body:{status:'reviewed'},status:200})
  assert.equal((await app.call(`/api/management/admin/leads/${lead}/send`,{token:admin,method:'PUT',body:{},status:200})).data.state,'sent');assert.equal((await app.first('SELECT status FROM leads WHERE id=?',lead)).status,'sent')
  // Processing interrupted after the provider started is uncertain and never retried.
  await app.db.prepare("INSERT INTO leads(id,name,email,website,created_at,status) VALUES('interrupted','Owner','hello@lead.example','https://lead.example',1,'processing')").run()
  await app.db.prepare("INSERT INTO lead_jobs(id,lead_id,state,provider_started,created_at,started_at) VALUES('interrupted-job','interrupted','running',1,1,1)").run()
  await app.scheduled();assert.equal((await app.first("SELECT state FROM lead_jobs WHERE id='interrupted-job'")).state,'uncertain')
  await app.runJobs([{type:'lead.process',id:'interrupted-job',projectId:'platform'}]);assert.equal(modelCalls,1)
 }finally{await app.close()}
}
