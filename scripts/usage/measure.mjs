import assert from 'node:assert/strict'
import {writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRuntime} from './runtime.mjs'
const runtime=await createRuntime();const {origin}=runtime
let phase='setup';const requests=[],frames=[],storage=[];const boundaries=[{name:'setup',offset:runtime.logs().length}]
const mark=name=>{phase=name;boundaries.push({name,offset:runtime.logs().length})}
const call=async(path,body,token,extra={})=>{const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{ }),Origin:origin,...extra.headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});requests.push({phase,path,status:response.status,request_body_bytes:body===undefined?0:Buffer.isBuffer(body)?body.length:Buffer.byteLength(JSON.stringify(body))});return response}
const json=async(path,body,token,status=200)=>{const r=await call(path,body,token);const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const socket=async(id,token,after,expected)=>{const ws=new WebSocket(origin.replace('http','ws')+`/api/conversations/${id}/socket?token=${token}`+(after?'&after='+after:''));const got=[];ws.addEventListener('message',e=>{const frame=JSON.parse(e.data);got.push(frame);frames.push({phase,type:frame.type,bytes:Buffer.byteLength(e.data)})});await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true})});for(let n=0;got.length<expected&&n<100;n++)await pause(30);assert.equal(got.length,expected);return {ws,got}}
let completed=false
try{
 const owner=await json('/api/identity/bootstrap',{name:'Usage workload',email:'usage@example.com',password:'local-measurement-password-123',allowedOrigin:origin},undefined,201)
 const project=await json('/api/identity/projects/'+owner.projectId,undefined,owner.token)
 await pause(300);storage.push({phase:'before',...await(await fetch(origin+'/__usage/storage')).json()});mark('static_assets');const asset=await fetch(origin+'/widget.js');assert.equal(asset.status,200);const staticAssets={requests:1,bytes:(await asset.arrayBuffer()).byteLength};await pause(100);mark('new_visitor')
 const visitor=await json('/api/identity/widget/session',{widgetKey:project.widget_key,name:'Measured visitor'},undefined,201)
 async function conversation(label){
  const c=await json('/api/conversations',{projectId:owner.projectId},visitor.token,201)
  const data=Buffer.alloc(1024*1024,65)
  const response=await call(`/api/conversations/${c.id}/media`,data,visitor.token,{headers:{'Content-Type':'text/plain','X-Filename':'measurement.txt'}});assert.equal(response.status,201);const media=await response.json();assert.equal(media.size,data.length)
  let revision=0,last
  for(let index=0;index<4;index++){
   const operator=index%2===1
   const message=await json(`/api/conversations/${c.id}/messages`,{localId:label+'-'+index,content:operator?'Thanks, we are checking your request.':'Please help with this representative request.',expectedRevision:revision,...(operator?{expectedLastMessageId:last}:{}),...(index===0?{mediaIds:[media.id]}:{})},operator?owner.token:visitor.token)
   assert.equal(message.accepted,true);revision=message.message.revision;last=message.message.id
  }
  const first=await socket(c.id,visitor.token,null,4);const cursor=first.got.at(-1).eventId;first.ws.close();await pause(100)
  const fifth=await json(`/api/conversations/${c.id}/messages`,{localId:label+'-4',content:'Thank you; here is the final detail.',expectedRevision:revision},visitor.token);assert.equal(fifth.message.revision,5)
  const resumed=await socket(c.id,visitor.token,cursor,1);resumed.ws.send(JSON.stringify({type:'ping'}));for(let i=0;resumed.got.length<2&&i<100;i++)await pause(30);assert.equal(resumed.got.at(-1).type,'pong');resumed.ws.close();await pause(100)
  const transcript=await json(`/api/conversations/${c.id}/messages`,undefined,owner.token);assert.equal(transcript.messages.length,5)
  const download=await call(`/api/conversations/${c.id}/media/${media.id}`,undefined,visitor.token);assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),data)
  await pause(500)
 }
 await conversation('new');storage.push({phase:'after_new',...await(await fetch(origin+'/__usage/storage')).json()});mark('returning_visitor');await conversation('returning');storage.push({phase:'after_returning',...await(await fetch(origin+'/__usage/storage')).json()});mark('recovery_cron')
 const cron=await fetch(origin+'/cdn-cgi/handler/scheduled');assert.equal(cron.status,200);await pause(1000);mark('idle_cron');assert.equal((await fetch(origin+'/cdn-cgi/handler/scheduled')).status,200);await pause(500);mark('end')
 const log=runtime.logs();const records=boundaries.slice(0,-1).map((b,i)=>({phase:b.name,events:[...log.slice(b.offset,boundaries[i+1].offset).matchAll(/H2H_USAGE (\{[^\n]+\})/g)].map(m=>JSON.parse(m[1]))}))
 const output={schema:1,date:new Date().toISOString(),source_revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),instrumentation_sha256:Object.fromEntries(await Promise.all(['measure.mjs','worker.js','runtime.mjs'].map(async file=>[file,createHash('sha256').update(await readFile(new URL(file,import.meta.url))).digest('hex')]))),local_storage_files:await runtime.storageFiles(),emitted_sha256:createHash('sha256').update(await readFile('dist/server/index.js')).digest('hex'),workload:{visitor_messages:3,operator_replies:2,attachment_bytes:1048576,uploads:1,downloads:1,socket_connections:2,incoming_ping_frames:1,retention_days:30},requests,frames,storage,staticAssets,records,ai:{provider_call_count:0,tokens:null,cost_usd:null,outcome:'not_run_no_provider'},hosted:{worker_cpu_ms:null,do_gb_seconds:null,do_storage_gb_month:null,billing:'unmeasured'}}
 await writeFile(runtime.directory+'/measurement.json',JSON.stringify(output,null,2)+'\n');console.log('Measurement:',runtime.directory+'/measurement.json');completed=true
}finally{await runtime.close(completed)}
