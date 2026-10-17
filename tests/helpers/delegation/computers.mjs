import assert from 'node:assert/strict'
import {startApp,sha} from '../../journeys/kit/app.mjs'

// Workspace 'p' on the real application: each operator is an owner with a live
// session ('operator', 'operator2', ...), one contact and the named conversations.
export async function computersApp({operators=['u'],conversations=['c']}={}){
 const app=await startApp({captureQueue:true}),db=app.db,now=Date.now()
 const tokens=operators.map((_,index)=>index?'operator'+(index+1):'operator')
 await db.batch([
  db.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','http://localhost',1)"),
  ...operators.flatMap((user,index)=>[db.prepare("INSERT INTO users VALUES(?,?,'Operator',1)").bind(user,user+'@example.test'),db.prepare("INSERT INTO memberships VALUES('p',?,'owner')").bind(user),db.prepare("INSERT INTO sessions VALUES(?,?,'p','owner',NULL,?,NULL)").bind(sha(tokens[index]),user,now+1000000),db.prepare("INSERT INTO session_factors VALUES(?,?,'password',?)").bind(sha(tokens[index]),user,Date.now())]),
  db.prepare("INSERT INTO contacts(id,project_id,name,email,external_id,created_at) VALUES('contact','p','Customer','c@example.test',NULL,1)"),
  ...conversations.map(id=>db.prepare("INSERT INTO conversations(id,project_id,contact_id,revision,created_at,updated_at) VALUES(?,'p','contact',0,1,1)").bind(id)),
 ])
 const request=async(path,body,token='operator',method=body===undefined?'GET':'POST')=>{const response=await app.request(path,{body,token,method}),text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={text}}return {status:response.status,...payload}}
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run()
 const pair=async(operator='operator',name='Fixture worker')=>{const pairing=await request('/api/projects/p/local-agents/pairings',{},operator);assert.equal(pairing.status,200,JSON.stringify(pairing));const paired=await request('/api/local-agents/pair',{code:pairing.data.code,name,provider:'codex',capabilities:['terminal']});assert.equal(paired.status,200,JSON.stringify(paired));return {token:paired.data.token,id:paired.data.device.id}}
 const delegate=async(conversation,device,requestId,operator='operator',mode='investigate')=>{const queued=await request(`/api/projects/p/conversations/${conversation}/delegations`,{device_id:device,mode,instructions:'Inspect fixture for '+requestId,request_id:requestId},operator);assert.equal(queued.status,200,JSON.stringify(queued));return queued.data.id}
 const claimed=async(worker,claimId,expected)=>{const claim=await request('/api/local-agents/claim',{claim_id:claimId},worker.token);assert.equal(claim.status,200,JSON.stringify(claim));assert.equal(claim.data?.id,expected);return claim.data}
 // A task session authorized through the device flow; its device is backed by a revocable grant.
 const grantDevice=async(session,operator='operator')=>{
  const auth=await request('/api/local-agents/device-authorizations',{client_session_id:session,name:'Fixture skill',provider:'codex',capabilities:['computer']})
  assert.equal((await request('/api/projects/p/local-agent-authorizations/decision',{user_code:auth.data.user_code,decision:'approve'},operator)).status,200)
  const grant=await request('/api/local-agents/device-authorizations/token',{device_code:auth.data.device_code});assert.equal(grant.status,200)
  const task=await request('/api/local-agents/task-sessions',{client_session_id:session,name:'Fixture skill',capabilities:[]},grant.data.grant_token);assert.equal(task.status,200,JSON.stringify(task))
  return {grantToken:grant.data.grant_token,grantId:task.data.device.grant_id,token:task.data.token,id:task.data.device.id}
 }
 const report=(job,claim,eventId,result,token,status='completed')=>request(`/api/local-agents/jobs/${job}/result`,{run_id:claim.run_id,event_id:eventId,status,result},token)
 const job=id=>app.first('SELECT * FROM local_jobs WHERE id=?',id)
 const effectState=async id=>(await app.first('SELECT state FROM local_result_effects WHERE job_id=?',id))?.state
 // A real D1 trigger that aborts one write, standing in for a process death or provider outage at that point.
 const fault=(name,table,when,timing='BEFORE INSERT')=>run(`CREATE TRIGGER ${name} ${timing} ON ${table} WHEN ${when} BEGIN SELECT RAISE(ABORT,'Injected ${name}'); END`)
 const clear=name=>run(`DROP TRIGGER ${name}`)
 return {app,db,request,run,pair,delegate,claimed,grantDevice,report,job,effectState,fault,clear,close:()=>app.close()}
}
export const completed=summary=>({summary,actions:[],verified:true})
