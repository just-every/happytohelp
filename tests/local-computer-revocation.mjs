// Authority revocation is not confirmed process termination (DELEGATION-001). Queued work never started and is
// cancelled; started work becomes terminal 'revoked' with an explicitly unconfirmed local outcome, scoped to the
// revoked device and its grant siblings only. A spent claim id never hands work back, and the result-effect sweep
// never collides with a replacement delegation or stops the scheduled tick.
import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const packages=await readdir('node_modules/.pnpm');
const {build}=await import('../node_modules/.pnpm/'+packages.find(x=>x.startsWith('esbuild@'))+'/node_modules/esbuild/lib/main.js');
const {Miniflare,convertV4MiniflareOptions}=await import('../node_modules/.pnpm/'+packages.find(x=>x.startsWith('miniflare@'))+'/node_modules/miniflare/dist/src/index.js');
const sessionToken=value=>createHash('sha256').update(value).digest('hex');
let folder,mf,db;

before(async()=>{
 folder=await mkdtemp(join(tmpdir(),'h2h-local-revocation-'));
 await build({entryPoints:['tests/local-computer-worker.ts'],outfile:join(folder,'worker.mjs'),bundle:true,format:'esm',platform:'neutral',external:['node:crypto','node:buffer'],logLevel:'silent'});
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:await readFile(join(folder,'worker.mjs'),'utf8'),compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{ENABLE_SYNTHETIC_EVALUATION:'true'},queueProducers:{JOBS:'training-tests'}}));
 db=await mf.getD1Database('DB');
 for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','030_local_computer.sql','040_training_runs.sql','0070_management.sql','0050_knowledge.sql','0080_integrations.sql','0081_billing_receipts.sql','041_training_model_usage.sql']){const sql=await readFile('migrations/'+file,'utf8');for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await db.prepare(statement).run();}
 const operators=['u','u2','u3','u4'];
 await db.batch([
  db.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','http://localhost',1)"),
  ...operators.map(user=>db.prepare("INSERT INTO users VALUES(?,?,'Operator',1)").bind(user,user+'@example.test')),
  ...operators.map(user=>db.prepare("INSERT INTO memberships VALUES('p',?,'owner')").bind(user)),
  db.prepare("INSERT INTO contacts(id,project_id,name,email,external_id,created_at) VALUES('contact','p','Customer','c@example.test',NULL,1)"),
  ...Array.from({length:20},(_,index)=>db.prepare("INSERT INTO conversations VALUES(?,'p','contact',0,NULL,NULL,NULL,1,1)").bind('c'+(index+1))),
  ...operators.map((user,index)=>db.prepare("INSERT INTO sessions VALUES(?,?,'p','owner',NULL,?,NULL)").bind(sessionToken(index?'operator'+(index+1):'operator'),user,Date.now()+1000000)),
 ]);
});
after(async()=>{await mf?.dispose();if(folder)await rm(folder,{recursive:true,force:true});});

async function request(path,body,token='operator',method='POST'){const response=await mf.dispatchFetch('http://localhost'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const payload=await response.json();return {status:response.status,...payload};}
const job=id=>db.prepare('SELECT * FROM local_jobs WHERE id=?').bind(id).first();
const effectState=async id=>(await db.prepare('SELECT state FROM local_result_effects WHERE job_id=?').bind(id).first())?.state;
async function pair(operator,name){const pairing=await request('/api/projects/p/local-agents/pairings',{},operator);assert.equal(pairing.status,200,JSON.stringify(pairing));const paired=await request('/api/local-agents/pair',{code:pairing.data.code,name,provider:'codex',capabilities:['terminal']});assert.equal(paired.status,200,JSON.stringify(paired));return {token:paired.data.token,id:paired.data.device.id};}
async function delegate(conversation,device,requestId,operator='operator',mode='investigate'){const queued=await request('/api/projects/p/conversations/'+conversation+'/delegations',{device_id:device,mode,instructions:'Inspect fixture for '+requestId,request_id:requestId},operator);assert.equal(queued.status,200,JSON.stringify(queued));return queued.data.id;}
async function claimed(worker,claimId,expected){const claim=await request('/api/local-agents/claim',{claim_id:claimId},worker.token);assert.equal(claim.status,200,JSON.stringify(claim));assert.equal(claim.data?.id,expected);return claim.data;}
async function grantDevice(session,operator='operator'){
 const auth=await request('/api/local-agents/device-authorizations',{client_session_id:session,name:'Fixture skill',provider:'codex',capabilities:['computer']});
 assert.equal((await request('/api/projects/p/local-agent-authorizations/decision',{user_code:auth.data.user_code,decision:'approve'},operator)).status,200);
 const grant=await request('/api/local-agents/device-authorizations/token',{device_code:auth.data.device_code});assert.equal(grant.status,200);
 const task=await request('/api/local-agents/task-sessions',{client_session_id:session,name:'Fixture skill',capabilities:[]},grant.data.grant_token);assert.equal(task.status,200,JSON.stringify(task));
 return {grantToken:grant.data.grant_token,grantId:task.data.device.grant_id,token:task.data.token,id:task.data.device.id};
}
const completedResult=summary=>({summary,actions:[],verified:true});

test('revocation withdraws authority without claiming the local process stopped',async()=>{
 const worker=await pair('operator','Revocation fixture worker');
 const started=await delegate('c1',worker.id,'started-work');
 const claim=await claimed(worker,'claim-started',started);
 const neverStarted=await delegate('c3',worker.id,'never-started');
 assert.equal((await job(neverStarted)).status,'queued');

 assert.equal((await request('/api/projects/p/local-agents/'+worker.id,undefined,'operator','DELETE')).status,200);
 const revoked=await job(started);
 assert.equal(revoked.status,'revoked','Started work is revoked, never reported as cancelled');
 assert.equal(revoked.delivery_state,'authority_revoked');
 assert.equal(revoked.cancel_requested,1);
 assert.ok(revoked.completed_at,'Revoked started work records a terminal timestamp');
 const cancelled=await job(neverStarted);
 assert.equal(cancelled.status,'cancelled','Queued work never started, so it is cancelled');
 assert.equal(cancelled.delivery_state,null);

 // The revoked device can no longer report anything about the work it may still be running.
 assert.equal((await request('/api/local-agents/jobs/'+started+'/progress',{run_id:claim.run_id,event_id:'late-progress',message:'Still working locally'},worker.token)).status,401);
 assert.equal((await request('/api/local-agents/jobs/'+started+'/result',{run_id:claim.run_id,event_id:'late-result',status:'completed',result:completedResult('Late report')},worker.token)).status,401);
 assert.equal((await request('/api/local-agents/heartbeat',{},worker.token)).status,401);

 // The terminal status frees the one-active-delegation index for the same conversation.
 const replacement=await pair('operator','Replacement worker');
 assert.equal((await job(await delegate('c1',replacement.id,'after-revocation'))).status,'queued');

 // Grant revocation applies the same distinction to every device the grant backs.
 const skill=await grantDevice('revocation-test');
 const grantJob=await delegate('c4',skill.id,'grant-running');
 await claimed(skill,'grant-claim',grantJob);
 assert.equal((await request('/api/projects/p/local-agent-grants/'+skill.grantId,undefined,'operator','DELETE')).status,200);
 const grantRevoked=await job(grantJob);
 assert.equal(grantRevoked.status,'revoked');
 assert.equal(grantRevoked.delivery_state,'authority_revoked');
 assert.equal(grantRevoked.cancel_requested,1);
 assert.ok(grantRevoked.completed_at);

 // Membership loss withdraws authority the same way: started work is unconfirmed, queued work never ran.
 const third=await pair('operator3','Membership fixture worker');
 const thirdRunning=await delegate('c5',third.id,'membership-running','operator3');
 await claimed(third,'membership-claim',thirdRunning);
 const thirdQueued=await delegate('c6',third.id,'membership-queued','operator3');
 await db.prepare("DELETE FROM memberships WHERE project_id='p' AND user_id='u3'").run();
 const heartbeat=await request('/api/local-agents/heartbeat',{},third.token);assert.equal(heartbeat.status,200,JSON.stringify(heartbeat));
 assert.deepEqual(heartbeat.data.active_jobs,[]);
 const membershipLost=await job(thirdRunning);
 assert.equal(membershipLost.status,'revoked');
 assert.equal(membershipLost.delivery_state,'membership_lost');
 assert.equal(membershipLost.cancel_requested,1);
 assert.ok(membershipLost.completed_at);
 assert.equal((await request('/api/local-agents/claim',{claim_id:'membership-claim-2'},third.token)).data,null);
 const membershipQueued=await job(thirdQueued);
 assert.equal(membershipQueued.status,'cancelled');
 assert.equal(membershipQueued.delivery_state,'membership_lost');
 await db.prepare("INSERT INTO memberships VALUES('p','u3','owner')").run();
});

test('revocation touches only the named device and its grant siblings',async()=>{
 // Another operator's live device keeps its running work.
 const other=await pair('operator2','Second operator worker');
 const otherJob=await delegate('c2',other.id,'other-running','operator2');
 await claimed(other,'other-claim',otherJob);

 // A device revoked earlier can still hold a delegation whose insert committed after that revocation (the
 // create route checks the device before inserting). A later, unrelated revocation must not rewrite it.
 const stale=await pair('operator2','Earlier revoked worker');
 assert.equal((await request('/api/projects/p/local-agents/'+stale.id,undefined,'operator2','DELETE')).status,200);
 await db.prepare("INSERT INTO local_jobs(id,project_id,conversation_id,operator_id,device_id,request_id,mode,instructions,created_at) VALUES('raced-job','p','c9','u2',?,'raced-insert','investigate','Inserted after revocation',?)").bind(stale.id,new Date().toISOString()).run();

 // Two task sessions backed by one grant are siblings: revoking one device revokes both and their work.
 const first=await grantDevice('sibling-one');
 const firstJob=await delegate('c10',first.id,'sibling-one-running');
 await claimed(first,'sibling-one-claim',firstJob);
 const second=await request('/api/local-agents/task-sessions',{client_session_id:'sibling-two',name:'Fixture skill',capabilities:[]},first.grantToken);assert.equal(second.status,200,JSON.stringify(second));
 const sibling={token:second.data.token,id:second.data.device.id};
 const siblingJob=await delegate('c11',sibling.id,'sibling-two-running');
 await claimed(sibling,'sibling-two-claim',siblingJob);

 assert.equal((await request('/api/projects/p/local-agents/'+first.id,undefined,'operator','DELETE')).status,200);
 for(const id of [firstJob,siblingJob]){const row=await job(id);assert.equal(row.status,'revoked');assert.equal(row.delivery_state,'authority_revoked');}
 assert.equal((await request('/api/local-agents/heartbeat',{},sibling.token)).status,401);

 const raced=await job('raced-job');
 assert.equal(raced.status,'queued','Revoking one device must not rewrite work on a different, earlier revoked device');
 assert.equal(raced.completed_at,null);
 assert.equal((await job(otherJob)).status,'running');
 assert.equal((await db.prepare('SELECT revoked_at FROM local_devices WHERE id=?').bind(other.id).first()).revoked_at,null);
});

test('a claim id replay never hands terminal work back to a connector',async()=>{
 // Work the device itself finished.
 const worker=await pair('operator','Replay fixture worker');
 const finished=await delegate('c12',worker.id,'replay-finished');
 const claim=await claimed(worker,'replay-claim',finished);
 const reported=await request('/api/local-agents/jobs/'+finished+'/result',{run_id:claim.run_id,event_id:'replay-result',status:'completed',result:completedResult('Finished before the claim response was replayed')},worker.token);
 assert.equal(reported.status,200,JSON.stringify(reported));assert.equal(reported.data.status,'completed');
 const replay=await request('/api/local-agents/claim',{claim_id:'replay-claim'},worker.token);
 assert.equal(replay.status,200,JSON.stringify(replay));
 assert.equal(replay.data,null,'A finished job is never returned for its old claim id');

 // A spent claim id never claims other queued work either; a fresh claim id does.
 const waiting=await delegate('c13',worker.id,'replay-waiting');
 const spent=await request('/api/local-agents/claim',{claim_id:'replay-claim'},worker.token);
 assert.equal(spent.status,200,JSON.stringify(spent));
 assert.equal(spent.data,null);
 assert.equal((await job(waiting)).status,'queued');
 await claimed(worker,'replay-fresh-claim',waiting);

 // Work withdrawn by membership loss stays withdrawn even after access returns.
 const fourth=await pair('operator4','Membership replay worker');
 const withdrawn=await delegate('c14',fourth.id,'replay-withdrawn','operator4');
 await claimed(fourth,'withdrawn-claim',withdrawn);
 await db.prepare("DELETE FROM memberships WHERE project_id='p' AND user_id='u4'").run();
 assert.equal((await request('/api/local-agents/heartbeat',{},fourth.token)).status,200);
 await db.prepare("INSERT INTO memberships VALUES('p','u4','owner')").run();
 const withdrawnReplay=await request('/api/local-agents/claim',{claim_id:'withdrawn-claim'},fourth.token);
 assert.equal(withdrawnReplay.status,200,JSON.stringify(withdrawnReplay));
 assert.equal(withdrawnReplay.data,null);
 assert.equal((await job(withdrawn)).status,'revoked');
});

test('the result-effect sweep never collides with a replacement delegation and isolates failing rows',async()=>{
 // A completed report whose note write crashed leaves its effects pending.
 async function crashedCompletion(conversation,requestId,{revoke=true}={}){
  const worker=await pair('operator','Effect fixture '+requestId);
  const created=await delegate(conversation,worker.id,requestId);
  const claim=await claimed(worker,requestId+'-claim',created);
  assert.equal((await request('/test/fail-note-once',{})).status,200);
  const crashed=await request('/api/local-agents/jobs/'+created+'/result',{run_id:claim.run_id,event_id:requestId+'-result',status:'completed',result:completedResult('Investigated before the note write failed')},worker.token);
  assert.equal(crashed.status,500,JSON.stringify(crashed));
  assert.equal((await job(created)).status,'completed');
  assert.equal(await effectState(created),'pending');
  if(revoke)assert.equal((await request('/api/projects/p/local-agents/'+worker.id,undefined,'operator','DELETE')).status,200);
  return created;
 }

 // Authority lost: the report records why and stays terminal, with or without a replacement delegation.
 const contested=await crashedCompletion('c7','effects-contested');
 const successor=await pair('operator','Effect replacement worker');
 const successorJob=await delegate('c7',successor.id,'effects-replacement');
 const alone=await crashedCompletion('c8','effects-alone');
 const swept=await request('/test/recover-local-effects',{});
 assert.equal(swept.status,200,JSON.stringify(swept));
 for(const id of [contested,alone]){
  const row=await job(id);
  assert.equal(row.status,'completed','Lost authority never reopens a report for input nobody can act on');
  assert.equal(row.delivery_state,'authorization_lost');
  assert.equal(await effectState(id),'blocked');
 }
 assert.equal((await job(successorJob)).status,'queued');
 assert.equal((await job(await delegate('c8',successor.id,'effects-alone-next'))).status,'queued','The conversation stays free for new delegations');

 // Delivery failure with authority intact: review reopens the report only while no replacement holds the conversation.
 const replier=await pair('operator','Reply fixture worker');
 const reply=await delegate('c15',replier.id,'effects-reply','operator','resolve_reply');
 const replyClaim=await claimed(replier,'effects-reply-claim',reply);
 assert.equal((await request('/test/fail-revision-once',{})).status,200);
 const replyCrash=await request('/api/local-agents/jobs/'+reply+'/result',{run_id:replyClaim.run_id,event_id:'effects-reply-result',status:'completed',result:{...completedResult('Resolved; reply prepared'),reply_draft:'Your issue is fixed.'}},replier.token);
 assert.equal(replyCrash.status,500,JSON.stringify(replyCrash));
 assert.equal((await job(reply)).status,'completed');
 const replySuccessor=await delegate('c15',successor.id,'effects-reply-replacement');
 assert.equal((await request('/test/fail-delivery-once',{})).status,200);
 const reviewSweep=await request('/test/recover-local-effects',{});
 assert.equal(reviewSweep.status,200,JSON.stringify(reviewSweep));
 const reviewed=await job(reply);
 assert.equal(reviewed.status,'completed','The replacement keeps the conversation; the report stays terminal');
 assert.equal(reviewed.delivery_state,'review');
 assert.equal((await db.prepare("SELECT status FROM local_receipts WHERE job_id=? AND kind='reply'").bind(reply).first()).status,'needs_review');
 assert.equal(await effectState(reply),'completed');
 assert.ok(await db.prepare('SELECT id FROM conversation_notes WHERE id=?').bind('delegation:'+reply).first(),'The report note is still recorded');
 assert.equal((await job(replySuccessor)).status,'queued');

 // One failing row never stops the rows after it.
 const first=await crashedCompletion('c16','effects-isolated-one',{revoke:false});
 const second=await crashedCompletion('c17','effects-isolated-two',{revoke:false});
 assert.equal((await request('/test/fail-note-once',{})).status,200);
 const isolated=await request('/test/recover-local-effects',{});
 assert.equal(isolated.status,200,JSON.stringify(isolated));
 assert.deepEqual([await effectState(first),await effectState(second)].sort(),['completed','pending'],'Exactly the injected row stays pending');
 assert.equal((await request('/test/recover-local-effects',{})).status,200);
 assert.deepEqual([await effectState(first),await effectState(second)],['completed','completed'],'The failed row is retried on the next sweep');
});

test('the scheduled tick still runs later recoveries after the local result-effect sweep',async()=>{
 const sweepFolder=await mkdtemp(join(tmpdir(),'h2h-local-sweep-'));
 const sweep=new Miniflare(convertV4MiniflareOptions({modules:true,script:await(async()=>{await build({entryPoints:['tests/local-computer-sweep-worker.ts'],outfile:join(sweepFolder,'worker.mjs'),bundle:true,format:'esm',platform:'node',logLevel:'silent'});return readFile(join(sweepFolder,'worker.mjs'),'utf8');})(),compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],queueProducers:{JOBS:'sweep-tests'}}));
 try{
  const sdb=await sweep.getD1Database('DB');
  for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('migrations/'+file,'utf8')).split(/;(?=\s*(?:CREATE|ALTER|PRAGMA|$))/).filter(s=>s.trim()))await sdb.prepare(sql).run();
  const now=Date.now(),stamp=new Date(now).toISOString();
  await sdb.batch([
   sdb.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','http://localhost',1)"),
   sdb.prepare("INSERT INTO users VALUES('u','u@example.test','Owner',1)"),sdb.prepare("INSERT INTO memberships VALUES('p','u','owner')"),
   sdb.prepare("INSERT INTO contacts(id,project_id,name,email,external_id,created_at) VALUES('contact','p','Customer','c@example.test',NULL,1)"),
   sdb.prepare("INSERT INTO conversations(id,project_id,contact_id,revision,created_at,updated_at) VALUES('c','p','contact',0,1,1)"),
   sdb.prepare("INSERT INTO local_devices(id,user_id,project_id,token_hash,name,provider,capabilities,revoked_at) VALUES('revoked-device','u','p','revoked-hash','Revoked','codex','[]',?)").bind(stamp),
   sdb.prepare("INSERT INTO local_devices(id,user_id,project_id,token_hash,name,provider,capabilities) VALUES('live-device','u','p','live-hash','Live','codex','[]')"),
   // A report completed on a device that was revoked before its effects ran, and a replacement delegation on the same conversation.
   sdb.prepare("INSERT INTO local_jobs(id,project_id,conversation_id,operator_id,device_id,request_id,mode,instructions,status,result,created_at,completed_at) VALUES('reported','p','c','u','revoked-device','reported','investigate','Inspect','completed',?,?,?)").bind(JSON.stringify(completedResult('Done')),stamp,stamp),
   sdb.prepare("INSERT INTO local_result_effects(job_id,event_id,payload) VALUES('reported','reported-result',?)").bind(JSON.stringify(completedResult('Done'))),
   sdb.prepare("INSERT INTO local_jobs(id,project_id,conversation_id,operator_id,device_id,request_id,mode,instructions,created_at) VALUES('replacement','p','c','u','live-device','replacement','investigate','Inspect again',?)").bind(stamp),
   // Later recoveries in the same tick: an expired brand generation and an interrupted lead job.
   sdb.prepare("INSERT INTO brand_generations(id,project_id,actor_id,request_id,prompt,model,size,quality,state,created_at,started_at,expires_at) VALUES('brand','p','u','brand-request','Mark','fixture','1024x1024','low','running',?,?,?)").bind(now-7200000,now-7200000,now-1000),
   sdb.prepare("INSERT INTO leads(id,name,email,created_at,status) VALUES('lead','Lead','lead@example.test',?,'processing')").bind(now),
   sdb.prepare("INSERT INTO lead_jobs(id,lead_id,state,provider_started,created_at,started_at) VALUES('lead-job','lead','running',0,?,?)").bind(now-3600000,now-3600000),
  ]);
  const response=await sweep.dispatchFetch('http://localhost/');const tick=await response.json();
  assert.equal(response.status,200,JSON.stringify(tick));
  const reported=await sdb.prepare("SELECT status,delivery_state FROM local_jobs WHERE id='reported'").first();
  assert.deepEqual({...reported},{status:'completed',delivery_state:'authorization_lost'});
  assert.equal((await sdb.prepare("SELECT state FROM local_result_effects WHERE job_id='reported'").first()).state,'blocked');
  assert.equal((await sdb.prepare("SELECT status FROM local_jobs WHERE id='replacement'").first()).status,'queued');
  assert.equal((await sdb.prepare("SELECT state FROM brand_generations WHERE id='brand'").first()).state,'uncertain','recoverBrandJobs ran in the same tick');
  assert.equal((await sdb.prepare("SELECT state FROM lead_jobs WHERE id='lead-job'").first()).state,'failed','recoverLeadJobs ran in the same tick');
 }finally{await sweep.dispose();await rm(sweepFolder,{recursive:true,force:true});}
});
