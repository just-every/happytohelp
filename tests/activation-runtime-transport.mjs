import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join,dirname} from 'node:path'
import {createRuntime} from './activation/browser-runtime.mjs'
import {providerFixture} from './activation/browser-provider-fixture.mjs'
import {apiKit,snapshot} from './activation/browser-kit.mjs'

const evidence=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/activation-transport')
await mkdir(evidence,{recursive:true})
const server=resolve('dist/server'),emitted=JSON.parse(await readFile(join(server,'wrangler.json'),'utf8'))
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const receipts=[]
let fixture
try{
 for(const wrapped of [false,true]){
  if(wrapped)fixture=await providerFixture({port:0})
  const runtime=await createRuntime(wrapped?{providerFixtureOrigin:fixture.origin,vars:{OPENAI_API_KEY:'activation-inert-model-key'}}:{})
  let success=false
  try{
   const config=JSON.parse(await readFile(join(runtime.directory,'wrangler.json'),'utf8'))
   for(const key of ['compatibility_date','compatibility_flags','rules','durable_objects','migrations'])assert.deepEqual(config[key],emitted[key],key)
   assert.equal(config.assets.directory,resolve(server,emitted.assets.directory))
   assert.deepEqual(config.queues,{producers:[{binding:'JOBS',queue:'isolated-jobs'}],consumers:[{queue:'isolated-jobs',max_batch_size:1,max_retries:0}]})
   assert.equal(config.d1_databases[0].binding,'DB');assert.equal(config.r2_buckets[0].binding,'FILES')
   if(wrapped){
    assert.equal(config.main,join(runtime.directory,'emitted/provider-boundary.mjs'))
    for(const entry of await readdir(server,{withFileTypes:true,recursive:true})){
     if(!entry.isFile())continue
     const path=join(entry.parentPath,entry.name),relative=path.slice(server.length+1)
     assert.equal(digest(await readFile(join(dirname(config.main),relative))),digest(await readFile(path)),relative+' emitted bytes')
    }
   }else assert.equal(config.main,resolve(server,emitted.main))
   const health=await fetch(runtime.origin+'/health');assert.equal(health.status,200)
   assert.partialDeepStrictEqual(await health.json(),{status:'ok',runtime:'native-rer',database:'reachable',files:'reachable'})
   const template=await fetch(runtime.origin+'/');assert.equal(template.status,200);assert.match(template.headers.get('Content-Type'),/^text\/html/)
   const asset=await fetch(runtime.origin+'/widget.js');assert.equal(asset.status,200)
   assert.equal(digest(Buffer.from(await asset.arrayBuffer())),digest(await readFile(join(config.assets.directory,'widget.js'))))
   const sql=await runtime.execute('SELECT name FROM d1_migrations ORDER BY name;')
   const migrationNames=(await readdir(config.d1_databases[0].migrations_dir)).filter(name=>name.endsWith('.sql')).sort()
   assert.deepEqual([...sql.matchAll(/"name": "([^"]+)"/g)].map(match=>match[1]),migrationNames,'all migrations actually applied in filename order')
   const boot=await apiKit(runtime)('/api/identity/bootstrap',{body:{email:'transport-activation@example.test',password:'activation-transport-password',name:'Transport activation',allowedOrigin:runtime.origin},status:201})
   const api=apiKit(runtime,boot.token),activation=`/api/management/projects/${boot.projectId}/activation`
   assert.equal(snapshot(await api(activation)).done,0)
   if(wrapped){
    assert.equal(fixture.state.calls.length,0,'GET never invokes external provider HTTP')
    const assistant=(await api(`/api/management/projects/${boot.projectId}/ais`,{body:{name:'Transport metadata',role:'Support',model:'gpt-5-mini',prompt:'Answer from sources.',is_enabled:true},status:201})).data
    await api(`/api/management/projects/${boot.projectId}/settings`,{method:'PUT',body:{default_responder:assistant.id}})
    let release
    fixture.state.modelGate=new Promise(done=>{release=done})
    const pending=api(activation+'/check',{body:{step:'model_key'}})
    try{
     const deadline=Date.now()+15000
     while(fixture.state.calls.length===0&&Date.now()<deadline)await new Promise(done=>setTimeout(done,25))
     assert.equal(fixture.state.calls.length,1,'emitted app reaches existing HTTP fixture exactly once')
     assert.equal(snapshot(await api(activation)).steps.find(step=>step.id==='model_key').state,'checking')
    }finally{release();fixture.state.modelGate=null}
    assert.equal(snapshot(await pending).steps.find(step=>step.id==='model_key').state,'done','gated HTTP response completes')
    assert.deepEqual(fixture.state.calls,[{method:'GET',url:'https://api.openai.com/v1/models/gpt-5-mini'}])
    assert.equal(fixture.state.sendCalls,0);assert.equal(fixture.state.error,undefined)
   }else{
    const demo=await api('/api/dashboard/demo-inbox',{body:{},status:201})
    for(const idleMs of [4990,5010]){
     await new Promise(done=>setTimeout(done,idleMs))
     const response=await fetch(`${runtime.origin}/api/dashboard/projects/${demo.id}/conversations/${demo.id}-first-hike/actions`,{method:'POST',headers:{Authorization:'Bearer '+boot.token,'Content-Type':'application/json'},body:JSON.stringify({action:'agentAssist'}),signal:AbortSignal.timeout(15000)})
     assert.equal(response.status,503);assert.match(response.headers.get('Content-Type'),/application\/json/)
     assert.match((await response.json()).error,/CONFIGURATION_REQUIRED: OPENAI_API_KEY/)
    }
   }
   assert.match(runtime.logs,/Native emitted workerd HTTP transport/)
   assert.doesNotMatch(runtime.logs,/\[ProxyWorker\]|Network connection lost/)
   await writeFile(join(evidence,`${wrapped?'provider':'untargeted'}-runtime.log`),runtime.logs)
   receipts.push({wrapped,migrationCount:runtime.migrationCount,emittedEntrySha256:digest(await readFile(resolve(server,emitted.main))),providerCalls:wrapped?fixture.state.calls:[],health:true,template:true,assetBytes:true,migrationsApplied:true,nativeHttp:true})
   success=true
  }finally{await runtime.close(success)}
  await assert.rejects(fetch(runtime.origin+'/health',{signal:AbortSignal.timeout(2000)}),'owned native HTTP socket closes')
  await fixture?.close();fixture=undefined
 }
 await writeFile(join(evidence,'activation-transport.json'),JSON.stringify({passed:true,receipts},null,2)+'\n')
 console.log('Activation transport PASS: both actual emitted runtimes, all emitted migrations applied, exact emitted module/asset bytes, missing-key JSON across idle boundary, gated metadata-only existing provider HTTP fixture, no development proxy.')
}finally{await fixture?.close()}
