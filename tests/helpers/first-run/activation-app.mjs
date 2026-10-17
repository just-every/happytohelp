import assert from 'node:assert/strict'
import {startApp,sha} from '../../journeys/kit/app.mjs'

// Setup (activation) on the real application: its routes over real D1, with the AI model metadata, Resend
// domains/emails and public DNS answered at the network edge by a fixture whose state each journey steers.
export const origin='https://desk.example'
export const hosted={EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'synthetic-fixture-email-key',EMAIL_FROM:'support@example.test',OPENAI_API_KEY:'synthetic-fixture-model-key',INBOUND_EMAIL_TOKEN:'synthetic-fixture-inbound-key',PREVIEW_ORIGIN:'https://preview.example'}
// A local installation: development mail, the loopback origin and no provider keys.
export const local={H2H_LOCAL:'true',EMAIL_PROVIDER:'development',APP_ORIGIN:'http://127.0.0.1:8787',EMAIL_FROM:'support@local.test',EMAIL_API_KEY:undefined,OPENAI_API_KEY:undefined}
// Resend's domain detail: public DNS names and values per record.
export const domainRecords=status=>[{record:'SPF',name:'send',type:'MX',value:'feedback-smtp.example-region.amazonses.com',priority:10,status},{record:'SPF',name:'send',type:'TXT',value:'v=spf1 include:amazonses.com ~all',status},{record:'DKIM',name:'resend._domainkey',type:'TXT',value:'p=MIGfMA0GCSqGSIb3DQEB',status}]
export const step=(data,id)=>data.steps.find(row=>row.id===id)
export const ids=(data,where)=>data.steps.filter(where).map(row=>row.id)

export async function activationApp({bindings=hosted,appOrigin=origin,captureQueue=false}={}){
 const s={sendCount:0,event:'sent',modelStatus:200,dnsStatus:'verified',statusMismatch:false,sendUncertain:false,domainListed:true,recipient:null,proposedStatus:'pending',ownStatus:'pending',dnsMissing:'',dnsDown:false,modelGate:null,routerKeyStatus:200,routerModels:{data:[{id:'openai/gpt-oss-120b'}]},messages:new Map(),misdirected:[]}
 const outbound=async(request,{url,method,headers,body})=>{
  if(url.startsWith('https://cloudflare-dns.com/dns-query?')){
   if(s.dnsDown)throw new Error('Fixture resolver unavailable')
   const name=new URL(url).searchParams.get('name'),record=name.startsWith('_dmarc.')?'DMARC':name.includes('._domainkey.')?'DKIM':'SPF'
   const value={DMARC:'v=DMARC1; p=none',DKIM:'v=DKIM1; p=fixture-public-key',SPF:'v=spf1 include:fixture.test ~all'}[record]
   return Response.json({Status:0,Answer:record===s.dnsMissing?[]:[{type:16,data:JSON.stringify(value)}]})
  }
  for(const host of ['https://api.openai.com/v1/models/','https://api.anthropic.com/v1/models/'])if(url.startsWith(host)){await s.modelGate;const id=decodeURIComponent(url.slice(host.length));return Response.json(s.modelStatus===200?{id,object:'model'}:{error:'fixture'},{status:s.modelStatus})}
  // OpenRouter: the authenticated key record, then the models this account may use.
  if(url.startsWith('https://openrouter.ai/api/v1/')){
   if(headers.authorization!=='Bearer synthetic-fixture-openrouter-key')s.misdirected.push('openrouter request without its key')
   if(url.endsWith('/key'))return s.routerKeyStatus===302?new Response(null,{status:302,headers:{Location:'https://openrouter.ai/login'}}):Response.json({data:{label:'fixture'}},{status:s.routerKeyStatus})
   if(url.endsWith('/models/user'))return Response.json(s.routerModels)
  }
  if(url==='https://api.resend.com/domains')return Response.json({data:s.domainListed?[{id:'domain-1',name:'example.test'},{id:'domain-2',name:'acme.test'},{id:'domain-3',name:'mine.test'}]:[],has_more:false})
  for(const [id,name,status] of [['domain-1','example.test',s.dnsStatus],['domain-2','acme.test',s.proposedStatus],['domain-3','mine.test',s.ownStatus]])if(url===`https://api.resend.com/domains/${id}`)return Response.json({id,name,status,records:domainRecords(status)})
  if(url==='https://api.resend.com/emails'&&method==='POST'){
   s.sendCount++;if(s.sendUncertain)throw new Error('Fixture connection lost after provider accepted')
   const sent=JSON.parse(body)
   if(s.recipient&&JSON.stringify(sent.to)!==JSON.stringify([s.recipient]))s.misdirected.push(sent.to)
   if(headers['idempotency-key']?.startsWith('activation:')&&sent.headers?.['Auto-Submitted']!=='auto-generated')s.misdirected.push('unmarked test mail')
   const id=`test-message-${s.sendCount}`;s.messages.set(id,sent);return Response.json({id})
  }
  const sent=url.startsWith('https://api.resend.com/emails/')&&s.messages.get(url.split('/').pop())
  if(sent)return Response.json({id:url.split('/').pop(),to:s.statusMismatch?['someone@example.test']:sent.to,from:sent.from,last_event:s.event})
  throw new Error(`Unexpected provider request ${method} ${url}`)
 }
 const app=await startApp({origin:appOrigin,bindings,outbound,captureQueue})
 // Configuration is the deployment's: changing it restarts the same stored state, as a redeploy would.
 let applied=JSON.stringify(bindings)
 const deploy=async(changes={})=>{
  const next={...bindings,...changes},keys=new Set([...Object.keys(app.bindings),...Object.keys(next)]),wanted=JSON.stringify(next)
  if(wanted===applied)return;applied=wanted;await app.configure(Object.fromEntries([...keys].map(key=>[key,next[key]])))
 }
 const call=async(projectId,suffix='',{body,token,env,status,raw}={})=>{
  await deploy(env)
  return app.call(`/api/management/projects/${projectId}/activation${suffix}`,{body:raw??body,raw:raw!==undefined,headers:raw!==undefined?{'Content-Type':'application/json'}:{},method:body===undefined&&raw===undefined?'GET':'POST',token,status})
 }
 // The owner's Setup page for one workspace: read, check and send the test email.
 const kit=(ws,env)=>{
  const send=async(suffix,body,options={})=>{const response=await call(ws.projectId,suffix,{body,token:ws.tokens.owner,env:options.env||env});assert.equal(response.status,options.status||200,JSON.stringify(response.data));return response.status===200?response.data.data:null}
  return {get:options=>send('',undefined,options),check:(body,options)=>send('/check',body,options),testMail:options=>send('/test-mail',{},options)}
 }
 // A widget visitor of the workspace: a contact with a live session, optionally in a conversation.
 const visitor=async(ws,key,{conversation=false}={})=>{
  const now=Date.now()
  await app.db.batch([app.db.prepare('INSERT INTO contacts(id,project_id,created_at) VALUES(?,?,?)').bind(key,ws.projectId,now),app.db.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,?,?,?,?,?)').bind(sha(`${key}-token`),key,ws.projectId,'contact',key,now+600000)])
  if(conversation)await app.db.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind(`${key}-conversation`,ws.projectId,key,now,now).run()
  return {token:`${key}-token`,conversationId:`${key}-conversation`}
 }
 const ping=(conversationId,{action='pingActive',site,token,data={opened:true}})=>app.call(`/api/conversations/${conversationId}/widget-events`,{body:{action,data},token,headers:site?{Origin:site}:{}})
 const defaultAssistant=async(ws,id,model)=>app.db.batch([
  app.db.prepare('INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,ws.projectId,'Helper','Support','Help',model,Date.now()),
  app.db.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(ws.projectId,JSON.stringify({default_visitor_ai_id:id,default_responder:id}),Date.now()),
 ])
 const since=start=>app.requests.slice(start).map(row=>row.url)
 return {app,s,deploy,call,kit,visitor,ping,defaultAssistant,since,
  get DB(){return app.db},
  async close(){try{assert.deepEqual(s.misdirected,[],'mail goes only to the intended recipient, test mail marked automatic')}finally{await app.close()}},
 }
}
