import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { summarizeSpend } from '../src/modules/management/ai-spend/summary.ts'
import { spendPresentation, usd } from '../src/ui/native/activation-spend/spend-model.js'
const require = createRequire(import.meta.url)
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('wrangler')] }))
const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler')] }))
const row = (cost, request = 'round', extra = {}) => ({generation_id:'generation',generation_state:'completed',attempt_id:'attempt',request_id:request,observed:1,usage_json:JSON.stringify({cost,metadata:{source:'xai',provider_cost_ticks:typeof cost==='number'?cost*1e10:undefined}}),...extra})

if (import.meta.url === pathToFileURL(process.argv[1]).href) test('cost receipts distinguish absent, known zero, partial, invalid and duplicate round usage', () => {
 assert.equal(summarizeSpend([]).knownUsd, null)
 assert.equal(summarizeSpend([]).state, 'empty')
 const zero = summarizeSpend([row(0)])
 assert.equal(zero.state, 'known'); assert.equal(zero.knownUsd, 0)
 assert.equal(spendPresentation(zero).amount, '$0.00')
 for (const cost of [undefined,null,-1,'0',true,Infinity,NaN]) {
  const result = summarizeSpend([row(cost)])
  assert.equal(result.state, 'unknown'); assert.equal(result.knownUsd, null)
 }
 assert.equal(summarizeSpend([row(1,'r',{observed:0})]).state, 'unknown')
 const estimate = summarizeSpend([row(0,'r',{usage_json:JSON.stringify({cost:0,input_tokens:100,metadata:{provider_total_tokens:100}})})])
 assert.equal(estimate.state,'unknown'); assert.equal(estimate.knownUsd,null); assert.equal(estimate.unverifiedUsd,0)
 assert.equal(summarizeSpend([row(1,'r',{usage_json:JSON.stringify({cost:1,metadata:{source:'xai',provider_cost_ticks:1e10,estimated_cost:true}})})]).state,'unknown')
 assert.equal(summarizeSpend([row(1,'r',{usage_json:'broken'})]).state, 'unknown')
 const partial = summarizeSpend([row(.003),row(null,'second')])
 assert.equal(partial.state,'partial'); assert.equal(partial.knownUsd,.003)
 assert.match(spendPresentation(partial).label,/total is unknown/)
 assert.equal(summarizeSpend([row(1),row(1),row(1)]).knownUsd,1)
 assert.equal(summarizeSpend([row(1),row(2)]).knownUsd,2)
 const unmeasured = summarizeSpend([row(null,null)])
 assert.equal(unmeasured.unmeasuredGenerations,1); assert.equal(unmeasured.state,'unknown')
 assert.equal(summarizeSpend([row(0,'r',{generation_state:'running'})]).state,'partial')
 const queued = summarizeSpend([row(null,null,{attempt_id:null,generation_state:'queued'})])
 assert.equal(queued.pendingGenerations,1); assert.equal(queued.knownUsd,null)
 assert.equal(usd(.0000001),'<$0.000001'); assert.equal(usd(NaN),'Unknown')
})

export async function createSpendHarness() {
 const script = (await build({stdin:{contents:"import {app} from './src/app'; import {aiSpend} from './src/modules/management/ai-spend'; app.route('/api/dashboard',aiSpend); export default app; export {ConversationSocket} from './src/modules/conversations/socket';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],logLevel:'silent'})).outputFiles[0].text
 let outbound = 0
 const mf = new Miniflare(convertV4MiniflareOptions({name:'activation-spend',port:16040,inspectorPort:16041,modules:true,script,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],bindings:{AI_DAILY_CEILINGS:JSON.stringify({repliesPerProject:2,repliesPerInstallation:3,spendUsdPerProject:1,contextRunsPerProject:2})},d1Databases:['DB'],r2Buckets:['FILES'],queueProducers:{JOBS:{queueName:'spend-tests'}},durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}},outboundService:async()=>{outbound++;throw new Error('External calls prohibited')}}))
 try {
  const db = await mf.getD1Database('DB')
  for (const file of (await readdir('.generated/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
   const source = (await readFile('.generated/migrations/'+file,'utf8')).replace(/^\s*--[^\n]*$/gm,'')
   for (const [,sql] of source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g)) await db.prepare(sql).run()
  }
  const call = (path, body, token) => mf.dispatchFetch('http://localhost'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  return { mf, db, call, outbound: () => outbound }
 } catch (error) { await mf.dispose(); throw error }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) test('real D1 spend route scopes persisted costs, updates receipts once, preserves accounting and enforces current membership', async () => {
 const {mf,db,call,outbound} = await createSpendHarness()
 try {
  const setup = await call('/api/identity/bootstrap',{name:'Spend',email:'spend@example.test',password:'local-spend-password-123',allowedOrigin:'http://localhost'})
  assert.equal(setup.status,201)
  const owner = await setup.json(), endpoint = `/api/dashboard/projects/${owner.projectId}/ai-spend`
  assert.equal((await call(endpoint)).status,401)
  const read = async (path=endpoint,token=owner.token) => {const response=await call(path,undefined,token); assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');return (await response.json()).data}
  const empty = await read()
  assert.equal(empty.spend.state,'empty');assert.equal(empty.spend.knownUsd,null)
  assert.equal(empty.resetsAt,new Date(Date.parse(empty.day+'T00:00:00Z')+86400000).toISOString())
  const other = await (await call('/api/management/projects',{name:'Other',allowedOrigin:'http://localhost'},owner.token)).json()
  assert.equal((await call(`/api/dashboard/projects/${other.id}/ai-spend`,undefined,owner.token)).status,403)
  const now = new Date().toISOString()
  const seed = async (id,project,cost,when=now) => {
   await db.prepare("INSERT INTO ai_generations(id,project_id,conversation_id,state,source_revision,actor_json,model,ai_id,ai_profile_json,created_at,updated_at) VALUES(?,?,?,'completed',0,?,'model','ai','{}',?,?)").bind(id,project,'conversation',JSON.stringify({role:'operator'}),when,when).run()
   await db.prepare("INSERT INTO ai_attempts(id,generation_id,state,started_at) VALUES(?,?,'completed',?)").bind(id+'-a',id,when).run()
   await db.prepare('INSERT INTO ai_round_usage(attempt_id,request_id,usage_json,observed) VALUES(?,?,?,1)').bind(id+'-a','provider-request',JSON.stringify({cost,metadata:{source:'xai',provider_cost_ticks:typeof cost==='number'?cost*1e10:undefined}})).run()
  }
  await seed('zero',owner.projectId,0)
  assert.equal((await read()).spend.knownUsd,0)
  await seed('paid',owner.projectId,.025)
  await seed('foreign',other.id,800)
  await seed('yesterday',owner.projectId,500,new Date(Date.parse(empty.day+'T00:00:00Z')-1).toISOString())
  assert.equal((await read()).spend.knownUsd,.025)
  await db.prepare('UPDATE ai_round_usage SET usage_json=? WHERE attempt_id=? AND request_id=?').bind(JSON.stringify({cost:.03,metadata:{source:'xai',provider_cost_ticks:300000000}}),'paid-a','provider-request').run()
  const updated = await read(); assert.equal(updated.spend.knownUsd,.03);assert.equal(updated.spend.rounds,2)
  await seed('unknown',owner.projectId,null)
  assert.equal((await read()).spend.state,'partial')
  const before = await db.prepare('SELECT * FROM ai_round_usage ORDER BY attempt_id,request_id').all()
  await read(); await read()
  assert.deepEqual(await db.prepare('SELECT * FROM ai_round_usage ORDER BY attempt_id,request_id').all(),before)
  const start=Math.floor(Date.now()/86400000)*86400000
  for (const [name,key,count] of [['ai:replies-per-project',owner.projectId,2],['ai:replies-per-installation','installation',3],['ai:reply-spend-micro-usd',owner.projectId,1000000],['ai:reply-ceiling-skips',owner.projectId,4],['ai:context-runs-per-project',owner.projectId,2]]) {
   await db.prepare('INSERT INTO abuse_counters(key,window_start,used,expires_at) VALUES(?,?,?,?)').bind(name+':'+createHash('sha256').update(key).digest('hex'),start,count,start+86400000).run()
  }
  const blocked = await read()
  assert.equal(blocked.automatic.replyCeilingReached,true);assert.equal(blocked.automatic.installationCeilingReached,true);assert.equal(blocked.automatic.skippedReplies,4);assert.equal(blocked.contextRuns.ceilingReached,true)
  assert.equal('installationUsed' in blocked.automatic,false)
  const project=await(await call('/api/identity/projects/'+owner.projectId,undefined,owner.token)).json()
  const visitor=await(await call('/api/identity/widget/session',{widgetKey:project.widget_key})).json()
  assert.equal((await call(endpoint,undefined,visitor.token)).status,403)
  await db.prepare('DELETE FROM memberships WHERE project_id=? AND user_id=?').bind(owner.projectId,owner.userId || (await db.prepare('SELECT actor_id FROM sessions WHERE project_id=? LIMIT 1').bind(owner.projectId).first()).actor_id).run()
  assert.equal((await call(endpoint,undefined,owner.token)).status,401)
  assert.equal(outbound(),0)
 } finally { await mf.dispose() }
})
