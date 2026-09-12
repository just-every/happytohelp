import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
let api;
before(async()=>{const temp=mkdtempSync(join(tmpdir(),'h2h-tests-'));execFileSync(resolve('node_modules/.bin/esbuild'),['src/backend/index.ts','--bundle','--platform=node','--format=esm',`--outfile=${temp}/api.mjs`],{stdio:'pipe'});({api}=await import(pathToFileURL(join(temp,'api.mjs')).href));rmSync(temp,{recursive:true,force:true});});
function database(){const db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));const prepared=(sql,bindings=[])=>({bind(...values){return prepared(sql,values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v));},async first(){return db.prepare(sql).get(...bindings)??null;},async all(){return {results:db.prepare(sql).all(...bindings)};},execute(){const r=db.prepare(sql).run(...bindings);return {success:true,meta:{changes:r.changes}};},async run(){return this.execute();}});return {raw:db,prepare:prepared,async batch(statements){db.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(stmt.execute());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};}
async function fixture(){const DB=database(),env={DB,H2H_BOOTSTRAP_TOKEN:'test-bootstrap-token',APP_ORIGIN:'http://localhost'};let cookie='';async function call(path,data,options={}){const headers={origin:'http://localhost',...(cookie?{cookie}:{}),...(options.token?{authorization:`Bearer ${options.token}`}:{})};if(data!==undefined)headers['content-type']='application/json';const response=await api.request(`http://localhost${path}`,{method:options.method??(data===undefined?'GET':'POST'),headers:{...headers,...options.headers},...(data===undefined?{}:{body:JSON.stringify(data)})},env);if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
assert.equal((await call('/api/auth/bootstrap',{email:'owner@example.com',password:'correct-long-password',name:'Owner',bootstrapToken:env.H2H_BOOTSTRAP_TOKEN})).status,200);
const workspace=(await call('/api/workspaces',{name:'Customer workspace',path:'/tmp/customer-project'})).body.workspace;
const credential=(await call('/api/agents',{name:'Test agent',workspaceIds:[workspace.id]})).body;
const request=(await call('/api/requests',{workspaceId:workspace.id,subject:'Account question',customerEmail:'customer@example.com',body:'Inspect account configuration.'})).body.request;
async function delegate(mode='investigate'){return (await call(`/api/requests/${request.id}/delegate`,{mode,instructions:'Inspect this account only.',agentId:credential.agent.id})).body.job;}
async function claim(sessionId='test-session'){return call('/api/agent/claim',{sessionId},{token:credential.token});}
return {DB,env,call,workspace,credential,request,delegate,claim};}
const completed=(runId,eventId=crypto.randomUUID())=>({runId,eventId,status:'completed',result:{summary:'Inspected account settings.',verified:true,actions:[{description:'Read configuration',evidence:'Observed matching workspace'}]}});
test('singleton bootstrap, session and same-origin boundaries',async()=>{const f=await fixture();assert.equal((await f.call('/api/session')).body.authenticated,true);assert.equal((await f.call('/api/auth/bootstrap',{email:'other@example.com',password:'correct-long-password',name:'Other',bootstrapToken:f.env.H2H_BOOTSTRAP_TOKEN})).status,409);assert.equal((await f.call('/api/workspaces',{name:'CSRF'},{headers:{origin:'https://attacker.example'}})).status,403);assert.equal((await api.request('http://localhost/api/requests',{},f.env)).status,401);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM operators').get().n,1);});
test('claim recovery and durable exact result receipts',async()=>{const f=await fixture(),job=await f.delegate();const [a,b]=await Promise.all([f.claim(),f.claim()]);assert.equal(a.status,200);assert.equal(a.body.runId,b.body.runId);assert.equal((await f.claim('other-session')).body.job,null);const result=completed(a.body.runId),path=`/api/agent/jobs/${job.id}/result`;assert.equal((await f.call(path,result,{token:f.credential.token})).status,200);assert.equal((await f.call(path,result,{token:f.credential.token})).body.duplicate,true);assert.equal((await f.call(path,{...result,result:{...result.result,summary:'Changed'}},{token:f.credential.token})).status,409);assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM events WHERE kind='completed'").get().n,1);assert.equal((await f.call(`/api/requests/${f.request.id}`)).body.request.status,'review');});
test('operator input resumes same run; cancellation blocks mutations',async()=>{const f=await fixture(),job=await f.delegate(),claim=(await f.claim()).body;const question={runId:claim.runId,eventId:crypto.randomUUID(),status:'needs_input',result:{summary:'Missing account ID',verified:false,question:'Which account?'}};assert.equal((await f.call(`/api/agent/jobs/${job.id}/result`,question,{token:f.credential.token})).status,200);assert.equal((await f.claim()).body.runId,claim.runId);assert.equal((await f.call(`/api/jobs/${job.id}/input`,{message:'Use account 42.'})).status,200);const check=await f.call(`/api/agent/jobs/${job.id}/check?runId=${claim.runId}`,undefined,{token:f.credential.token});assert.equal(check.body.status,'running');assert.equal(check.body.input[0].message,'Use account 42.');await f.call(`/api/jobs/${job.id}/cancel`,{});assert.equal((await f.call(`/api/agent/jobs/${job.id}/result`,completed(claim.runId),{token:f.credential.token})).status,409);});
test('workspace scope and credential revocation',async()=>{const f=await fixture(),other=(await f.call('/api/workspaces',{name:'Other'})).body.workspace,restricted=(await f.call('/api/agents',{name:'Other agent',workspaceIds:[other.id]})).body;const job=await f.delegate(),claim=(await f.claim()).body;assert.equal((await f.call('/api/agent/claim',{sessionId:'other'},{token:restricted.token})).body.job,null);assert.equal((await f.call(`/api/agent/jobs/${job.id}/context?runId=${claim.runId}`,undefined,{token:restricted.token})).status,404);await f.call(`/api/agents/${f.credential.agent.id}`,undefined,{method:'DELETE'});assert.equal((await f.call(`/api/agent/jobs/${job.id}/result`,completed(claim.runId),{token:f.credential.token})).status,401);});
test('verification and mode approval gates',async()=>{const f=await fixture(),job=await f.delegate('resolve'),claim=(await f.claim()).body,path=`/api/agent/jobs/${job.id}/result`;const unverified=completed(claim.runId);unverified.result.verified=false;assert.equal((await f.call(path,unverified,{token:f.credential.token})).status,400);const unauthorized=completed(claim.runId);unauthorized.result.reply_draft='Not authorized';assert.equal((await f.call(path,unauthorized,{token:f.credential.token})).status,400);const result=completed(claim.runId);result.result.replies=[{id:'reply',title:'Proposed reply',body:'Customer reply.'}];assert.equal((await f.call(path,result,{token:f.credential.token})).status,200);assert.equal(f.DB.raw.prepare('SELECT status FROM replies').get().status,'proposed');});
test('advance reply approval is durable once, unconfigured transport stays explicit',async()=>{const f=await fixture(),job=await f.delegate('resolve_reply'),claim=(await f.claim()).body,result=completed(claim.runId),path=`/api/agent/jobs/${job.id}/result`;result.result.reply_draft='Verified customer response.';assert.equal((await f.call(path,result,{token:f.credential.token})).status,200);assert.equal((await f.call(path,result,{token:f.credential.token})).body.duplicate,true);const rows=f.DB.raw.prepare('SELECT * FROM replies').all();assert.equal(rows.length,1);assert.equal(rows[0].status,'approved');assert.match(rows[0].error,/Configure/);});
test('attachment references cannot cross job/run',async()=>{const f=await fixture(),job=await f.delegate(),claim=(await f.claim()).body,result=completed(claim.runId);result.result.attachment_ids=[crypto.randomUUID()];assert.equal((await f.call(`/api/agent/jobs/${job.id}/result`,result,{token:f.credential.token})).status,400);});
test('failed login is durably throttled',async()=>{const f=await fixture();for(let i=0;i<10;i++)assert.equal((await f.call('/api/auth/signin',{email:'owner@example.com',password:'wrong-long-password'})).status,401);assert.equal((await f.call('/api/auth/signin',{email:'owner@example.com',password:'correct-long-password'})).status,429);});
test('review requires verified completion and approves each proposal once',async()=>{
 const f=await fixture(),job=await f.delegate('resolve'),claim=(await f.claim()).body;
 await f.call(`/api/jobs/${job.id}/cancel`,{});
 assert.equal((await f.call(`/api/jobs/${job.id}/review`,{action:'resolve'})).status,409);
 await f.call(`/api/jobs/${job.id}/review`,{action:'reopen'});
 const next=await f.delegate('resolve'),nextClaim=(await f.claim()).body,result=completed(nextClaim.runId);result.result.replies=[{id:'proposal',title:'Reply',body:'Verified proposed reply.'}];
 await f.call(`/api/agent/jobs/${next.id}/result`,result,{token:f.credential.token});
 const proposal=f.DB.raw.prepare('SELECT id FROM replies').get(),approval={action:'approve_reply',replyId:proposal.id,reply:'Verified edited reply.'};
 assert.equal((await f.call(`/api/jobs/${next.id}/review`,approval)).status,200);
 assert.equal((await f.call(`/api/jobs/${next.id}/review`,approval)).body.duplicate,true);
 assert.equal((await f.call(`/api/jobs/${next.id}/review`,{...approval,reply:'Different text.'})).status,409);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM replies').get().n,1);
});
test('uncertain provider submission is never blindly retried, reconciliation requires evidence',async()=>{
 const f=await fixture(),job=await f.delegate('resolve_reply'),claim=(await f.claim()).body,result=completed(claim.runId);result.result.reply_draft='Verified response.';
 f.env.SENDGRID_API_KEY='test-only-key';f.env.MAIL_FROM='support@example.com';
 const original=globalThis.fetch;let attempts=0;globalThis.fetch=async()=>{attempts++;throw new Error('Lost provider response');};
 try {
  assert.equal((await f.call(`/api/agent/jobs/${job.id}/result`,result,{token:f.credential.token})).status,200);
  const reply=f.DB.raw.prepare('SELECT * FROM replies').get();assert.equal(reply.status,'uncertain');assert.equal(attempts,1);
  assert.equal((await f.call(`/api/replies/${reply.id}/send`,{})).status,409);assert.equal(attempts,1);
  assert.equal((await f.call(`/api/replies/${reply.id}/reconcile`,{outcome:'accepted',evidence:'Provider console shows acceptance.'})).status,400);
  assert.equal((await f.call(`/api/replies/${reply.id}/reconcile`,{outcome:'accepted',providerId:'provider-123',evidence:'Provider console confirms delivery request provider-123.'})).status,200);
  assert.equal(f.DB.raw.prepare('SELECT status FROM replies').get().status,'accepted');assert.equal(attempts,1);
 } finally {globalThis.fetch=original;}
});
test('provider acceptance is recorded as accepted, never delivered, and result retry does not resend',async()=>{
 const f=await fixture(),job=await f.delegate('resolve_reply'),claim=(await f.claim()).body,result=completed(claim.runId);result.result.reply_draft='Verified response.';f.env.SENDGRID_API_KEY='test-only-key';f.env.MAIL_FROM='support@example.com';
 const original=globalThis.fetch;let attempts=0;globalThis.fetch=async()=>{attempts++;return new Response(null,{status:202,headers:{'x-message-id':'provider-test-123'}});};
 try {const path=`/api/agent/jobs/${job.id}/result`;assert.equal((await f.call(path,result,{token:f.credential.token})).status,200);assert.equal((await f.call(path,result,{token:f.credential.token})).body.duplicate,true);const reply=f.DB.raw.prepare('SELECT * FROM replies').get();assert.equal(reply.status,'accepted');assert.equal(reply.provider_id,'provider-test-123');assert.equal(f.DB.raw.prepare('SELECT status FROM requests').get().status,'resolved');assert.equal(attempts,1);}finally{globalThis.fetch=original;}
});
test('four MiB screenshot evidence is stored in bounded chunks and revoked uploads fail',async()=>{const f=await fixture();const j=await f.delegate();const claim=(await f.claim()).body;const runId=claim.job.runId;const bytes=new Uint8Array(4*1024*1024);bytes.set([137,80,78,71,13,10,26,10]);const upload=()=>api.request(`http://localhost/api/agent/jobs/${j.id}/attachments?runId=${runId}`,{method:'POST',headers:{authorization:`Bearer ${f.credential.token}`,'content-type':'image/png'},body:bytes},f.env);const response=await upload();assert.equal(response.status,201);const {attachmentId}=await response.json();const rows=f.DB.raw.prepare('SELECT length(bytes) size FROM attachment_chunks WHERE attachment_id=? ORDER BY ordinal').all(attachmentId);assert.deepEqual(rows.map(r=>r.size),[1048576,1048576,1048576,1048576]);await f.call(`/api/agents/${f.credential.agent.id}`,undefined,{method:'DELETE'});assert.equal((await upload()).status,401);});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function proposalFixture(mode='resolve') {
 const f=await fixture(),job=await f.delegate(mode),claim=(await f.claim()).body,result=completed(claim.runId);
 if(mode==='resolve')result.result.replies=[{id:'reply',title:'Proposed',body:'Reviewed original content.'}];else result.result.reply_draft='Advance-authorized content.';
 await f.call(`/api/agent/jobs/${job.id}/result`,result,{token:f.credential.token});
 return {...f,job,reply:f.DB.raw.prepare('SELECT * FROM replies').get()};
}
test('superseded assignment cannot review or send, and late receipt cannot resolve newer work',async()=>{
 const f=await proposalFixture('resolve_reply');f.env.SENDGRID_API_KEY='test-only';f.env.MAIL_FROM='support@example.com';
 const started=deferred(),release=deferred(),original=globalThis.fetch;
 globalThis.fetch=async()=>{started.resolve();await release.promise;return new Response(null,{status:202,headers:{'x-message-id':'old-receipt'}});};
 try {
  const sending=f.call(`/api/replies/${f.reply.id}/send`,{});await started.promise;
  const next=await f.delegate('investigate'),claim=(await f.claim('next-session')).body;
  assert.equal((await f.call(`/api/jobs/${f.job.id}/review`,{action:'resolve'})).status,409);
  assert.equal((await f.call(`/api/jobs/${f.job.id}/review`,{action:'reopen'})).status,409);
  assert.equal((await f.call(`/api/replies/${f.reply.id}/send`,{})).status,409);
  await f.call(`/api/agent/jobs/${next.id}/result`,completed(claim.runId),{token:f.credential.token});
  release.resolve();assert.equal((await sending).status,200);
  assert.equal(f.DB.raw.prepare('SELECT status,current_job_id FROM requests').get().status,'review');
  assert.equal(f.DB.raw.prepare('SELECT current_job_id FROM requests').get().current_job_id,next.id);
  assert.equal(f.DB.raw.prepare('SELECT status FROM replies').get().status,'accepted');
  assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM events WHERE kind='resolved_after_reply'").get().n,0);
 }finally{release.resolve();globalThis.fetch=original;}
});
test('in-flight reconciliation is blocked and old attempt receipts cannot settle a replacement attempt',async()=>{
 const f=await proposalFixture('resolve_reply');f.env.SENDGRID_API_KEY='test-only';f.env.MAIL_FROM='support@example.com';
 const starts=[deferred(),deferred()],releases=[deferred(),deferred()],original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{const n=calls++;starts[n].resolve();await releases[n].promise;return new Response(null,{status:202,headers:{'x-message-id':`receipt-${n}`}});};
 try {
  const first=f.call(`/api/replies/${f.reply.id}/send`,{});await starts[0].promise;
  const reconciliation={outcome:'failed',evidence:'Provider inspection confirms first submission was rejected.'};
  assert.equal((await f.call(`/api/replies/${f.reply.id}/reconcile`,reconciliation)).status,409);assert.equal(calls,1);
  f.DB.raw.prepare('UPDATE replies SET submission_expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',f.reply.id);
  assert.equal((await f.call(`/api/replies/${f.reply.id}/reconcile`,reconciliation)).status,200);
  const second=f.call(`/api/replies/${f.reply.id}/send`,{});await starts[1].promise;
  const activeAttempt=f.DB.raw.prepare('SELECT attempt_id FROM replies').get().attempt_id;
  releases[0].resolve();await first;
  const pending=f.DB.raw.prepare('SELECT * FROM replies').get();assert.equal(pending.status,'sending');assert.equal(pending.attempt_id,activeAttempt);assert.equal(pending.provider_id,null);
  assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM events WHERE kind='reply_reconciled'").get().n,1);
  assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM events WHERE kind='provider_receipt'").get().n,1);
  releases[1].resolve();await second;assert.equal(f.DB.raw.prepare('SELECT provider_id FROM replies').get().provider_id,'receipt-1');
 }finally{for(const release of releases)release.resolve();globalThis.fetch=original;}
});
test('concurrent different-body approvals have one exact content winner',async()=>{
 const f=await proposalFixture();
 const approve=reply=>f.call(`/api/jobs/${f.job.id}/review`,{action:'approve_reply',replyId:f.reply.id,reply});
 const results=await Promise.all([approve('First reviewed message.'),approve('Second reviewed message.')]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winning=results[0].status===200?'First reviewed message.':'Second reviewed message.';
 assert.equal(f.DB.raw.prepare('SELECT body FROM replies').get().body,winning);
 assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM events WHERE kind='operator_review'").get().n,1);
});
