// Provider-free enforcement check. Real application + D1/DO/R2; queues have no
// consumer, so admissions cannot execute inference. No fabricated provider output.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {awaitWindowRoom} from './helpers/window-room.mjs'
import {readFile,readdir} from 'node:fs/promises'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]}))
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
test('configured request and daily AI count ceilings enforce real local admissions without inference',async()=>{
 const script=(await build({stdin:{contents:"export {app as default} from './src/app'; export {ConversationSocket} from './src/modules/conversations/socket'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],logLevel:'silent'})).outputFiles[0].text
 let outbound=0
 const mf=new Miniflare(convertV4MiniflareOptions({name:'usage-limits',port:8786,inspectorPort:8787,modules:true,script,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],bindings:{RATE_LIMITS:JSON.stringify({widgetSessionsPerIpHour:2}),AI_DAILY_CEILINGS:JSON.stringify({repliesPerProject:2,repliesPerInstallation:3}),OPENAI_API_KEY:'inert-admission-test-key'},d1Databases:['DB'],r2Buckets:['FILES'],queueProducers:{JOBS:{queueName:'usage-limits'}},durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}},outboundService:async()=>{outbound++;throw new Error('Outbound requests prohibited')}}))
 try{
  const db=await mf.getD1Database('DB')
  for(const file of (await readdir('.generated/migrations')).filter(f=>f.endsWith('.sql')).sort()){
   const source=(await readFile('.generated/migrations/'+file,'utf8')).replace(/^\s*--[^\n]*$/gm,'')
   for(const [,sql] of source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await db.prepare(sql).run()
  }
  const call=(path,body,token)=>mf.dispatchFetch('http://localhost'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  await awaitWindowRoom(3600,10000)
  const owner=await(await call('/api/identity/bootstrap',{name:'Limits',email:'usage-limits@example.com',password:'local-limit-test-password-123',allowedOrigin:'http://localhost'})).json()
  const project=await(await call('/api/identity/projects/'+owner.projectId,undefined,owner.token)).json()
  const session=()=>call('/api/identity/widget/session',{widgetKey:project.widget_key})
  const visitor=await(await session()).json();assert.equal((await session()).status,201)
  const limited=await session();assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('Retry-After'))>=1)
  const now=Date.now()
  await db.prepare('INSERT INTO ai_profiles VALUES(?,?,?,?,?,?,1,0,NULL,?)').bind('usage-ai',owner.projectId,'Assistant','support','Answer from evidence','gpt-5.6-luna',now).run()
  await db.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json').bind(owner.projectId,JSON.stringify({default_visitor_ai_id:'usage-ai'}),now).run()
  const conversation=await(await call('/api/conversations',{projectId:owner.projectId},visitor.token)).json()
  for(let i=0;i<3;i++){const response=await call(`/api/conversations/${conversation.id}/messages`,{localId:'usage-'+i,content:'Local ceiling check',expectedRevision:i},visitor.token);assert.equal(response.status,200);assert.equal((await response.json()).accepted,true)}
  const states=(await db.prepare('SELECT state,error FROM ai_generations ORDER BY created_at,id').all()).results
  assert.equal(states.filter(r=>r.state==='queued').length,2);assert.equal(states.filter(r=>r.state==='failed'&&r.error.includes('repliesPerProject')).length,1)
  const request=()=>call(`/api/conversations/${conversation.id}/widget-events`,{action:'request',data:{requestId:'00000000-0000-4000-8000-000000000001'}},visitor.token)
  for(let i=0;i<2;i++){const response=await request();assert.equal(response.status,429);assert.ok(Number(response.headers.get('Retry-After'))>=1)}
  assert.equal((await db.prepare('SELECT count(*) n FROM messages').first()).n,3)
  assert.equal((await db.prepare('SELECT count(*) n FROM ai_attempts').first()).n,0)
  assert.equal((await db.prepare('SELECT count(*) n FROM ai_round_usage').first()).n,0)
  assert.equal((await db.prepare("SELECT count(*) n FROM ai_generations WHERE id='00000000-0000-4000-8000-000000000001'").first()).n,1)
  // A separate project's first admission reaches the installation ceiling;
  // its second request is denied and its project reservation is refunded.
  const other=await(await call('/api/management/projects',{name:'Second limits project',allowedOrigin:'http://localhost'},owner.token)).json()
  const switched=await(await call('/api/identity/switch-project',{projectId:other.id},owner.token)).json()
  const otherProject=await(await call('/api/identity/projects/'+other.id,undefined,switched.token)).json()
  await db.prepare('INSERT INTO ai_profiles VALUES(?,?,?,?,?,?,1,0,NULL,?)').bind('usage-ai-other',other.id,'Assistant','support','Answer from evidence','gpt-5.6-luna',now).run()
  await db.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json').bind(other.id,JSON.stringify({default_visitor_ai_id:'usage-ai-other'}),now).run()
  const otherVisitor=await(await call('/api/identity/widget/session',{widgetKey:otherProject.widget_key})).json()
  const otherConversation=await(await call('/api/conversations',{projectId:other.id},otherVisitor.token)).json()
  for(let i=0;i<2;i++)assert.equal((await call(`/api/conversations/${otherConversation.id}/messages`,{localId:'other-'+i,content:'Installation ceiling check',expectedRevision:i},otherVisitor.token)).status,200)
  assert.equal((await db.prepare("SELECT count(*) n FROM ai_generations WHERE state='queued'").first()).n,3)
  assert.equal((await db.prepare("SELECT count(*) n FROM ai_generations WHERE error LIKE '%repliesPerInstallation%'").first()).n,1)
  assert.equal(outbound,0);assert.equal((await db.prepare('SELECT count(*) n FROM ai_attempts').first()).n,0)
  console.log(JSON.stringify({request_statuses:[201,201,429],project_ai_admissions:2,installation_ai_admissions:3,explicit_ai_denials:[429,429],provider_calls:outbound,provider_attempts:0,provider_tokens:null,provider_cost:null}))
 }finally{await mf.dispose()}
})
