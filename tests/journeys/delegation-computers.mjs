import test from 'node:test'
import assert from 'node:assert/strict'
import {computersApp,completed} from '../helpers/delegation/computers.mjs'
import {adoptionJourney,adoptionFaultJourney} from '../helpers/delegation/adoption.mjs'

// Local computers on the real application: pairing and device authorization,
// scoped claims, results and their effects, revocation and draft adoption.
// Faults are real D1 triggers or storage failures at the request edge.

test('a computer pairs once or through an approved device authorization; claims are scoped and replay-safe, results are kept whole and recorded once, a reply is sent only on Send or advance authorization and exactly once, and lost membership or a spent claim id hands no work back',async()=>{
 const t=await computersApp({operators:['u','u4'],conversations:['c','c12','c13','c14','strict-resolve','strict-reply','ordinary']})
 const {request,pair,delegate,claimed,report,job,app}=t
 try{
  const pairing=await request('/api/projects/p/local-agents/pairings',{});const paired=await request('/api/local-agents/pair',{code:pairing.data.code,name:'Fixture worker',provider:'codex',capabilities:['terminal']});assert.equal(paired.status,200)
  const worker={token:paired.data.token,id:paired.data.device.id}
  assert.equal((await request('/api/local-agents/pair',{code:pairing.data.code,name:'Reuse',provider:'codex'})).status,401,'a pairing code is single use')

  // An investigation: a claim id replays its own run, a foreign run is refused, a result is recorded once.
  const queued=await delegate('c',worker.id,'request1'),claim=await claimed(worker,'claim1',queued)
  assert.equal((await request('/api/local-agents/claim',{claim_id:'claim1'},worker.token)).data.run_id,claim.run_id)
  assert.equal((await request(`/api/local-agents/jobs/${queued}/context?run_id=wrong`,undefined,worker.token,'GET')).status,409)
  const investigated={summary:'Fixture inspected',actions:[{description:'Read fixture',evidence:'Fixture content checked'}],verified:true,replies:[]}
  assert.equal((await report(queued,claim,'event1',investigated,worker.token)).data.status,'completed');assert.equal((await report(queued,claim,'event1',investigated,worker.token)).status,200)

  // Offered replies wait for Send; Send admits once and never resolves the conversation.
  const offered=await delegate('c',worker.id,'request2','operator','resolve_reply'),offeredClaim=await claimed(worker,'claim2',offered)
  assert.equal((await report(offered,offeredClaim,'event2',{summary:'Verified result',actions:[],verified:true,reply_draft:'Must never auto send',replies:[{id:'reply1',title:'Reply',body:'Customer response'}]},worker.token)).data.status,'completed')
  assert.equal((await app.first("SELECT COUNT(*) n FROM messages WHERE project_id='p'")).n,0)
  const send=`/api/projects/p/conversations/c/delegations/${offered}/result/replies/reply1/send`,sent=await request(send,{});assert.equal(sent.data.status,'sent',JSON.stringify(sent))
  assert.equal((await request(send,{})).data.message_id,sent.data.message_id)
  assert.equal((await app.first("SELECT COUNT(*) n FROM messages WHERE project_id='p'")).n,1);assert.equal((await app.first("SELECT resolved_at FROM conversations WHERE id='c'")).resolved_at,null)

  // A verified draft with no offered replies is advance-authorized only for Resolve and reply.
  for(const [conversation,mode,messages] of [['strict-resolve','resolve',0],['strict-reply','resolve_reply',1]]){
   const id=await delegate(conversation,worker.id,'strict-'+mode,'operator',mode),run=await claimed(worker,'strict-'+mode,id)
   assert.equal((await report(id,run,'strict-'+mode,{...completed('Verified the test state'),reply_draft:'Advance-authorized verified response'},worker.token)).data.status,'completed')
   assert.equal((await app.first('SELECT COUNT(*) n FROM messages WHERE conversation_id=?',conversation)).n,messages,mode)
  }
  // Needs-input and completed reports keep their full content; ordinary Resolve adds no customer message.
  const ordinary=await delegate('ordinary',worker.id,'ordinary-report','operator','resolve'),ordinaryClaim=await claimed(worker,'ordinary-report',ordinary)
  for(const status of ['needs_input','completed']){
   const result={summary:'Input: the operator chose a support option.',actions:[{description:'Read credential documentation',evidence:'Confirmed the documented instructions.'}],verified:status==='completed',reply_draft:'Your request is ready for review.',question:'May I continue?',replies:[{id:'review',title:'Review reply',body:'The configuration is correct.'}],follow_up_actions:[{id:'inspect',title:'Inspect again',instructions:'Check the current configuration.',mode:'investigate'}]}
   const admitted=await report(ordinary,ordinaryClaim,'ordinary-'+status,result,worker.token,status);assert.equal(admitted.status,200);assert.equal(admitted.data.status,status);assert.deepEqual(admitted.data.result,result)
  }
  assert.equal((await app.first("SELECT COUNT(*) n FROM messages WHERE conversation_id='ordinary'")).n,0)

  // Device authorization: the token waits for a person's decision, is issued once, and a revoked grant ends the session.
  const auth=await request('/api/local-agents/device-authorizations',{client_session_id:'native-test',name:'Fixture skill',provider:'codex',capabilities:['computer']})
  assert.equal((await request('/api/local-agents/device-authorizations/token',{device_code:auth.data.device_code})).status,428)
  assert.equal((await request('/api/projects/p/local-agent-authorizations/decision',{user_code:auth.data.user_code,decision:'approve'})).status,200)
  const grant=await request('/api/local-agents/device-authorizations/token',{device_code:auth.data.device_code});assert.equal(grant.status,200)
  assert.equal((await request('/api/local-agents/device-authorizations/token',{device_code:auth.data.device_code})).status,403)
  const task=await request('/api/local-agents/task-sessions',{client_session_id:'native-test',name:'Fixture skill',capabilities:[]},grant.data.grant_token);assert.equal(task.status,200);assert.equal(task.data.device.worker_ready_at,null)
  await delegate('c12',task.data.device.id,'request3');assert.ok((await request('/api/local-agents/claim',{claim_id:'skill-claim'},task.data.token)).data.run_id)
  assert.equal((await request('/api/local-agents/task-sessions',{client_session_id:'native-test',name:'Fixture skill',capabilities:[]},grant.data.grant_token)).status,409)
  assert.equal((await request('/api/projects/p/local-agent-grants/'+task.data.device.grant_id,undefined,'operator','DELETE')).status,200)
  assert.equal((await request('/api/local-agents/heartbeat',{},task.data.token)).status,401)

  // A spent claim id never hands back finished work or claims other queued work; a fresh claim id does.
  const replayWorker=await pair('operator','Replay fixture worker'),finished=await delegate('c13',replayWorker.id,'replay-finished'),finishedClaim=await claimed(replayWorker,'replay-claim',finished)
  assert.equal((await report(finished,finishedClaim,'replay-result',completed('Finished before the claim response was replayed'),replayWorker.token)).data.status,'completed')
  assert.equal((await request('/api/local-agents/claim',{claim_id:'replay-claim'},replayWorker.token)).data,null)
  const waiting=await delegate('c13',replayWorker.id,'replay-waiting');assert.equal((await request('/api/local-agents/claim',{claim_id:'replay-claim'},replayWorker.token)).data,null);assert.equal((await job(waiting)).status,'queued')
  await claimed(replayWorker,'replay-fresh-claim',waiting)
  // Work withdrawn by membership loss stays withdrawn after access returns.
  const fourth=await pair('operator2','Membership replay worker'),withdrawn=await delegate('c14',fourth.id,'replay-withdrawn','operator2');await claimed(fourth,'withdrawn-claim',withdrawn)
  await t.run("DELETE FROM memberships WHERE project_id='p' AND user_id='u4'");assert.equal((await request('/api/local-agents/heartbeat',{},fourth.token)).status,200)
  await t.run("INSERT INTO memberships VALUES('p','u4','owner')");assert.equal((await request('/api/local-agents/claim',{claim_id:'withdrawn-claim'},fourth.token)).data,null);assert.equal((await job(withdrawn)).status,'revoked')

  // Membership loss: the operator session ends and the still-valid device token is refused the work.
  await t.run("DELETE FROM memberships WHERE project_id='p' AND user_id='u'")
  assert.equal((await request('/api/projects/p/conversations/c/delegations')).status,401)
  assert.equal((await request(`/api/local-agents/jobs/${queued}/context?run_id=${claim.run_id}`,undefined,worker.token,'GET')).status,403)
  assert.equal((await request('/api/local-agents/claim',{claim_id:'claim1'},worker.token)).data,null)
 }finally{await t.close()}
})

test('revoking a device, its grant or a membership withdraws authority without claiming the process stopped, and touches only that device and its grant siblings',async()=>{
 const t=await computersApp({operators:['u','u2','u3'],conversations:Array.from({length:11},(_,index)=>'c'+(index+1))})
 const {request,pair,delegate,claimed,report,grantDevice,job}=t
 try{
  const worker=await pair('operator','Revocation fixture worker'),started=await delegate('c1',worker.id,'started-work'),claim=await claimed(worker,'claim-started',started)
  const neverStarted=await delegate('c3',worker.id,'never-started');assert.equal((await job(neverStarted)).status,'queued')
  // Another operator's live device, and a device revoked earlier holding a delegation inserted after its revocation.
  const other=await pair('operator2','Second operator worker'),otherJob=await delegate('c2',other.id,'other-running','operator2');await claimed(other,'other-claim',otherJob)
  const stale=await pair('operator2','Earlier revoked worker');assert.equal((await request('/api/projects/p/local-agents/'+stale.id,undefined,'operator2','DELETE')).status,200)
  await t.run("INSERT INTO local_jobs(id,project_id,conversation_id,operator_id,device_id,request_id,mode,instructions,created_at) VALUES('raced-job','p','c9','u2',?,'raced-insert','investigate','Inserted after revocation',?)",stale.id,new Date().toISOString())

  assert.equal((await request('/api/projects/p/local-agents/'+worker.id,undefined,'operator','DELETE')).status,200)
  const revoked=await job(started);assert.equal(revoked.status,'revoked','started work is revoked, never reported as cancelled');assert.equal(revoked.delivery_state,'authority_revoked');assert.equal(revoked.cancel_requested,1);assert.ok(revoked.completed_at)
  const cancelled=await job(neverStarted);assert.equal(cancelled.status,'cancelled','queued work never started, so it is cancelled');assert.equal(cancelled.delivery_state,null)
  // The revoked device can no longer report anything about work it may still be running.
  assert.equal((await request(`/api/local-agents/jobs/${started}/progress`,{run_id:claim.run_id,event_id:'late-progress',message:'Still working locally'},worker.token)).status,401)
  assert.equal((await report(started,claim,'late-result',completed('Late report'),worker.token)).status,401)
  assert.equal((await request('/api/local-agents/heartbeat',{},worker.token)).status,401)
  assert.equal((await job('raced-job')).status,'queued','an unrelated earlier-revoked device is not rewritten');assert.equal((await job(otherJob)).status,'running')
  assert.equal((await t.app.first('SELECT revoked_at FROM local_devices WHERE id=?',other.id)).revoked_at,null)
  // The terminal status frees the conversation for a replacement delegation.
  const replacement=await pair('operator','Replacement worker');assert.equal((await job(await delegate('c1',replacement.id,'after-revocation'))).status,'queued')

  // Grant revocation applies to every device the grant backs; revoking one sibling device revokes both.
  const skill=await grantDevice('revocation-test'),grantJob=await delegate('c4',skill.id,'grant-running');await claimed(skill,'grant-claim',grantJob)
  assert.equal((await request('/api/projects/p/local-agent-grants/'+skill.grantId,undefined,'operator','DELETE')).status,200)
  const grantRevoked=await job(grantJob);assert.equal(grantRevoked.status,'revoked');assert.equal(grantRevoked.delivery_state,'authority_revoked');assert.equal(grantRevoked.cancel_requested,1);assert.ok(grantRevoked.completed_at)
  const first=await grantDevice('sibling-one'),firstJob=await delegate('c10',first.id,'sibling-one-running');await claimed(first,'sibling-one-claim',firstJob)
  const second=await request('/api/local-agents/task-sessions',{client_session_id:'sibling-two',name:'Fixture skill',capabilities:[]},first.grantToken);assert.equal(second.status,200,JSON.stringify(second))
  const sibling={token:second.data.token,id:second.data.device.id},siblingJob=await delegate('c11',sibling.id,'sibling-two-running');await claimed(sibling,'sibling-two-claim',siblingJob)
  assert.equal((await request('/api/projects/p/local-agents/'+first.id,undefined,'operator','DELETE')).status,200)
  for(const id of [firstJob,siblingJob]){const row=await job(id);assert.equal(row.status,'revoked');assert.equal(row.delivery_state,'authority_revoked');assert.equal(row.cancel_requested,1);assert.ok(row.completed_at)}
  assert.equal((await request('/api/local-agents/heartbeat',{},sibling.token)).status,401)

  // Membership loss: started work is unconfirmed, queued work never ran, and no later claim hands it out.
  const third=await pair('operator3','Membership fixture worker'),thirdRunning=await delegate('c5',third.id,'membership-running','operator3');await claimed(third,'membership-claim',thirdRunning)
  const thirdQueued=await delegate('c6',third.id,'membership-queued','operator3')
  await t.run("DELETE FROM memberships WHERE project_id='p' AND user_id='u3'")
  const heartbeat=await request('/api/local-agents/heartbeat',{},third.token);assert.equal(heartbeat.status,200,JSON.stringify(heartbeat));assert.deepEqual(heartbeat.data.active_jobs,[])
  const lost=await job(thirdRunning);assert.equal(lost.status,'revoked');assert.equal(lost.delivery_state,'membership_lost');assert.equal(lost.cancel_requested,1);assert.ok(lost.completed_at)
  assert.equal((await request('/api/local-agents/claim',{claim_id:'membership-claim-2'},third.token)).data,null)
  const lostQueued=await job(thirdQueued);assert.equal(lostQueued.status,'cancelled');assert.equal(lostQueued.delivery_state,'membership_lost')
 }finally{await t.close()}
})

test('result effects happen exactly once across crashes: a report or reply interrupted after commit resumes on resubmission or the scheduled sweep, lost authority blocks it, failed delivery goes to review without taking a replacement\'s conversation, one failing row never stops the rest, and the tick still runs later recoveries',async()=>{
 const t=await computersApp({conversations:['c','c7','c8','c15','c16','c17','tick']})
 const {request,pair,delegate,claimed,report,job,effectState,fault,clear,app}=t
 const messages=localId=>app.first('SELECT COUNT(*) n FROM messages WHERE local_id=?',localId).then(row=>row.n)
 try{
  const worker=await pair()
  // A crash after the reply was admitted but before the note: resubmission completes the note, never a second reply.
  const crashJob=await delegate('c',worker.id,'crash-window','operator','resolve_reply'),crashClaim=await claimed(worker,'crash-claim',crashJob)
  const crashResult={...completed('Recovered completed work'),reply_draft:'Exactly once after crash'}
  await fault('note_crash','conversation_notes',`NEW.id='delegation:${crashJob}'`)
  assert.equal((await report(crashJob,crashClaim,'crash-result',crashResult,worker.token)).status,500)
  assert.equal(await effectState(crashJob),'pending');await clear('note_crash')
  assert.equal((await report(crashJob,crashClaim,'crash-result',crashResult,worker.token)).status,200)
  assert.equal(await messages(`delegation:${crashJob}:legacy`),1);assert.ok(await app.first('SELECT id FROM conversation_notes WHERE id=?','delegation:'+crashJob));assert.equal(await effectState(crashJob),'completed')
  // The process dies after admitting the reply but before acknowledging the receipt: recovery confirms the same message.
  const lostJob=await delegate('c',worker.id,'admission-loss','operator','resolve_reply'),lostClaim=await claimed(worker,'admission-loss-claim',lostJob)
  const lostResult={...completed('Admission survived response loss'),reply_draft:'Exactly once across admission response loss'}
  await fault('receipt_loss','local_receipts',`NEW.job_id='${lostJob}'`,'BEFORE UPDATE')
  assert.equal((await report(lostJob,lostClaim,'admission-loss-result',lostResult,worker.token)).status,500)
  assert.equal((await app.first("SELECT status FROM local_receipts WHERE job_id=? AND proposal_id='legacy'",lostJob)).status,'sending');assert.equal(await messages(`delegation:${lostJob}:legacy`),1)
  await clear('receipt_loss')
  assert.equal((await report(lostJob,lostClaim,'admission-loss-result',lostResult,worker.token)).data.status,'completed')
  assert.equal((await app.first("SELECT status FROM local_receipts WHERE job_id=? AND proposal_id='legacy'",lostJob)).status,'sent');assert.equal(await messages(`delegation:${lostJob}:legacy`),1)

  // A completed report whose note write crashed, optionally followed by revocation of its device.
  async function crashedCompletion(conversation,requestId,{revoke=true}={}){
   const device=await pair('operator','Effect fixture '+requestId),created=await delegate(conversation,device.id,requestId),claim=await claimed(device,requestId+'-claim',created)
   await fault('note_'+requestId.replaceAll('-','_'),'conversation_notes',`NEW.id='delegation:${created}'`)
   assert.equal((await report(created,claim,requestId+'-result',completed('Investigated before the note write failed'),device.token)).status,500)
   await clear('note_'+requestId.replaceAll('-','_'))
   assert.equal((await job(created)).status,'completed');assert.equal(await effectState(created),'pending')
   if(revoke)assert.equal((await request('/api/projects/p/local-agents/'+device.id,undefined,'operator','DELETE')).status,200)
   return created
  }
  // Authority lost: the sweep records why and the report stays terminal, with or without a replacement delegation.
  const contested=await crashedCompletion('c7','effects-contested'),successor=await pair('operator','Effect replacement worker'),successorJob=await delegate('c7',successor.id,'effects-replacement')
  const alone=await crashedCompletion('c8','effects-alone');await app.scheduled()
  for(const id of [contested,alone]){const row=await job(id);assert.equal(row.status,'completed','lost authority never reopens a report nobody can act on');assert.equal(row.delivery_state,'authorization_lost');assert.equal(await effectState(id),'blocked')}
  assert.equal((await job(successorJob)).status,'queued');assert.equal((await job(await delegate('c8',successor.id,'effects-alone-next'))).status,'queued','the conversation stays free')

  // Delivery failure with authority intact: review, while the replacement keeps the conversation.
  const replier=await pair('operator','Reply fixture worker'),reply=await delegate('c15',replier.id,'effects-reply','operator','resolve_reply'),replyClaim=await claimed(replier,'effects-reply-claim',reply)
  await fault('receipt_crash','local_receipts',`NEW.job_id='${reply}'`)
  assert.equal((await report(reply,replyClaim,'effects-reply-result',{...completed('Resolved; reply prepared'),reply_draft:'Your issue is fixed.'},replier.token)).status,500)
  await clear('receipt_crash');assert.equal((await job(reply)).status,'completed')
  const replySuccessor=await delegate('c15',successor.id,'effects-reply-replacement')
  await fault('delivery_outage','messages',`NEW.local_id='delegation:${reply}:legacy'`);await app.scheduled();await clear('delivery_outage')
  const reviewed=await job(reply);assert.equal(reviewed.status,'completed','the replacement keeps the conversation; the report stays terminal');assert.equal(reviewed.delivery_state,'review')
  assert.equal((await app.first("SELECT status FROM local_receipts WHERE job_id=? AND kind='reply'",reply)).status,'needs_review');assert.equal(await effectState(reply),'completed')
  assert.ok(await app.first('SELECT id FROM conversation_notes WHERE id=?','delegation:'+reply),'the report note is still recorded');assert.equal((await job(replySuccessor)).status,'queued')

  // One failing row never stops the rows after it, and is retried on the next sweep.
  const first=await crashedCompletion('c16','effects-isolated-one',{revoke:false}),second=await crashedCompletion('c17','effects-isolated-two',{revoke:false})
  await fault('note_isolated','conversation_notes',`NEW.id='delegation:${first}'`);await app.scheduled();await clear('note_isolated')
  assert.deepEqual([await effectState(first),await effectState(second)],['pending','completed'])
  await app.scheduled();assert.deepEqual([await effectState(first),await effectState(second)],['completed','completed'])

  // The same tick still runs later recoveries after the local sweep: an expired brand generation and an interrupted lead job.
  const now=Date.now(),stamp=new Date(now).toISOString()
  await app.db.batch([
   app.db.prepare("INSERT INTO local_devices(id,user_id,project_id,token_hash,name,provider,capabilities,revoked_at) VALUES('revoked-device','u','p','revoked-hash','Revoked','codex','[]',?)").bind(stamp),
   app.db.prepare("INSERT INTO local_devices(id,user_id,project_id,token_hash,name,provider,capabilities) VALUES('live-device','u','p','live-hash','Live','codex','[]')"),
   app.db.prepare("INSERT INTO local_jobs(id,project_id,conversation_id,operator_id,device_id,request_id,mode,instructions,status,result,created_at,completed_at) VALUES('reported','p','tick','u','revoked-device','reported','investigate','Inspect','completed',?,?,?)").bind(JSON.stringify(completed('Done')),stamp,stamp),
   app.db.prepare("INSERT INTO local_result_effects(job_id,event_id,payload) VALUES('reported','reported-result',?)").bind(JSON.stringify(completed('Done'))),
   app.db.prepare("INSERT INTO local_jobs(id,project_id,conversation_id,operator_id,device_id,request_id,mode,instructions,created_at) VALUES('replacement','p','tick','u','live-device','replacement','investigate','Inspect again',?)").bind(stamp),
   app.db.prepare("INSERT INTO brand_generations(id,project_id,actor_id,request_id,prompt,model,size,quality,state,created_at,started_at,expires_at) VALUES('brand','p','u','brand-request','Mark','fixture','1024x1024','low','running',?,?,?)").bind(now-7200000,now-7200000,now-1000),
   app.db.prepare("INSERT INTO leads(id,name,email,created_at,status) VALUES('lead','Lead','lead@example.test',?,'processing')").bind(now),
   app.db.prepare("INSERT INTO lead_jobs(id,lead_id,state,provider_started,created_at,started_at) VALUES('lead-job','lead','running',0,?,?)").bind(now-3600000,now-3600000),
  ])
  await app.scheduled()
  assert.deepEqual({...await app.first("SELECT status,delivery_state FROM local_jobs WHERE id='reported'")},{status:'completed',delivery_state:'authorization_lost'});assert.equal(await effectState('reported'),'blocked')
  assert.equal((await job('replacement')).status,'queued')
  assert.equal((await app.first("SELECT state FROM brand_generations WHERE id='brand'")).state,'uncertain','brand recovery ran in the same tick')
  assert.equal((await app.first("SELECT state FROM lead_jobs WHERE id='lead-job'")).state,'failed','lead recovery ran in the same tick')
 }finally{await t.close()}
})

test('Use turns a reported reply into an editable native draft with the operator\'s own copy of its files, once, and ordinary Send admits it exactly once; every authority, selection, frontier and source check refuses without creating a message or media',adoptionJourney)

test('a storage failure, lost acknowledgement or concurrent change during Use leaves no rows, messages or staged copies, and an explicit Use recovers the same media after a lost D1 acknowledgement',adoptionFaultJourney)
