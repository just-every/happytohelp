import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile,mkdir,writeFile,symlink} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {createRuntime} from './helpers/emitted-runtime.mjs'

const runtime=await createRuntime(),receipt=[],exec=promisify(execFile)
let success=false,socket
try{
 assert.equal(runtime.migrationCount,42)
 const fixtureBin=join(runtime.directory,'provider-bin');await mkdir(fixtureBin)
 await symlink(resolve('tests/helpers/hero/codex.mjs'),join(fixtureBin,'codex'))
 const connectorEnv={...process.env,PATH:fixtureBin+':'+process.env.PATH}
 const emitted=JSON.parse(await readFile(resolve('dist/server/wrangler.json'),'utf8')),isolated=JSON.parse(await readFile(join(runtime.directory,'wrangler.json'),'utf8'))
 const server=dirname(resolve('dist/server/wrangler.json'))
 assert.equal(isolated.main,resolve(server,emitted.main));assert.equal(isolated.assets.directory,resolve(server,emitted.assets.directory))
 for(const key of ['compatibility_date','compatibility_flags','rules','durable_objects','migrations'])assert.deepEqual(isolated[key],emitted[key],key)
 const tenant=await runtime.seedTenant({name:'Native transport',email:'transport@native.test',allowedOrigin:runtime.origin})
 const call=async(path,body,token=tenant.token)=>{
  const response=await fetch(runtime.origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,Origin:runtime.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const text=await response.text();assert.match(response.headers.get('Content-Type'),/application\/json/,`${response.status}: ${text}`)
  return {status:response.status,body:JSON.parse(text)}
 }
 const project=await call(`/api/identity/projects/${tenant.projectId}`);assert.equal(project.status,200)
 const visitor=await call('/api/identity/widget/session',{widgetKey:project.body.widget_key});assert.equal(visitor.status,201)
 const conversation=await call('/api/conversations',{projectId:tenant.projectId},visitor.body.token);assert.equal(conversation.status,201)
 const frames=[]
 socket=new WebSocket(runtime.origin.replace('http:','ws:')+`/api/conversations/${conversation.body.id}/socket?token=${visitor.body.token}`)
 socket.addEventListener('message',event=>frames.push(JSON.parse(event.data)))
 await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(Error('native socket open timeout')),10000);socket.addEventListener('open',()=>{clearTimeout(timer);done()},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);fail(Error('native socket upgrade failed'))},{once:true})})
 // Fresh capabilities straddle workerd's five-second HTTP idle boundary. No
 // request is retried: each actual connector child sends its pairing POST once.
 for(const idleMs of [4990,5000,5010,5100]){
  const pairings=await Promise.all([0,1].map(async()=>{const pairing=await call(`/api/projects/${tenant.projectId}/local-agents/pairings`,{});assert.equal(pairing.status,200);return pairing.body.data}))
  await new Promise(done=>setTimeout(done,idleMs))
  const outcomes=await Promise.allSettled(pairings.map(async(pairing,index)=>{
   const configPath=join(runtime.directory,`connector-${idleMs}-${index}.json`)
   const child=await exec(process.execPath,[resolve('local-agent/bin/h2h-local.mjs'),'connect','--server',runtime.origin,'--code',pairing.code,'--provider','codex','--name',`Native ${idleMs}-${index}`,'--workdir',runtime.directory],{cwd:runtime.directory,env:{...connectorEnv,H2H_LOCAL_CONFIG:configPath},timeout:20000})
   assert.match(child.stdout,/Paired this computer with HappyToHelp/)
   const config=JSON.parse(await readFile(configPath,'utf8'));assert.equal(config.server,runtime.origin);assert.ok(config.device.id);assert.ok(config.token)
   const replay=await call('/api/local-agents/pair',{code:pairing.code,name:'Reused',provider:'codex'},'');assert.equal(replay.status,401);assert.match(replay.body.error,/used/)
   return {idleMs,pairingId:pairing.id,deviceId:config.device.id,childExit:0,reuseStatus:replay.status}
  }))
  for(const outcome of outcomes){if(outcome.status==='rejected')throw outcome.reason;receipt.push(outcome.value)}
  assert.equal(socket.readyState,WebSocket.OPEN,'visitor socket remains connected across idle HTTP/CLI pairing')
 }
 const sql=await runtime.execute(`SELECT COUNT(*) AS redeemed FROM local_pairings WHERE project_id='${tenant.projectId}' AND redeemed_at IS NOT NULL; SELECT COUNT(*) AS devices FROM local_devices WHERE project_id='${tenant.projectId}'; SELECT COUNT(*) AS duplicate_devices FROM (SELECT pairing_id FROM local_devices GROUP BY pairing_id HAVING COUNT(*)>1);`)
 assert.match(sql,/"redeemed": 8/);assert.match(sql,/"devices": 8/);assert.match(sql,/"duplicate_devices": 0/)
 const sent=await call(`/api/conversations/${conversation.body.id}/messages`,{localId:'native-transport-message',content:'Native HTTP and WebSocket agree.',expectedRevision:0},visitor.body.token)
 assert.equal(sent.status,200);assert.equal(sent.body.accepted,true)
 const deadline=Date.now()+8000;while(!frames.some(frame=>frame.message?.id===sent.body.message.id)&&Date.now()<deadline)await new Promise(done=>setTimeout(done,25))
 assert.deepEqual(frames.filter(frame=>frame.type==='message').map(frame=>frame.message.id),[sent.body.message.id])
 const transcript=await call(`/api/conversations/${conversation.body.id}/messages`,undefined,visitor.body.token);assert.equal(transcript.body.messages.length,1);assert.equal(transcript.body.messages[0].id,sent.body.message.id)
 const evidence=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/native-transport');await mkdir(evidence,{recursive:true})
 await writeFile(join(evidence,'native-runtime.log'),runtime.logs)
 await writeFile(join(evidence,'native-transport.json'),JSON.stringify({passed:true,migrationCount:runtime.migrationCount,transport:'emitted application in native workerd HTTP socket, Wrangler binding/assets translation; no development ProxyWorker',emittedConfig:{main:isolated.main,assets:isolated.assets,compatibility_date:isolated.compatibility_date,compatibility_flags:isolated.compatibility_flags,rules:isolated.rules,durable_objects:isolated.durable_objects},pairings:receipt,sql,socketMessageId:sent.body.message.id,assertions:['emitted entry, assets, rules, compatibility and Durable Object migration preserved','eight actual CLI fresh single-use pairings across idle boundary','JSON reuse refused','one persisted device per consumed capability','native HTTP commit, WebSocket delivery and reload agree']},null,2))
 success=true;console.log('Native transport PASS: 42 migrations, eight actual CLI pairings, JSON reuse refusal, D1 single consumption, native HTTP/WebSocket/reload stable identity; no retries or development proxy.')
}finally{socket?.close();await runtime.close(success)}
await assert.rejects(fetch(runtime.origin+'/health',{signal:AbortSignal.timeout(2000)}),'owned workerd HTTP socket must close')
