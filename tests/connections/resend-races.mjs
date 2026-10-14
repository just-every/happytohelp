import assert from 'node:assert/strict';
import {harness,body} from './harness.mjs';

// Part of the high-stakes resend refusal test: use the public create, approve
// and explicit-test routes, the actual Worker dispatcher, D1 and HTTP receiver.
export async function assertResendPreparationRaces(){
 const root='/api/management/projects/p/connections',proof=[];
 for(const scenario of ['disabled','changed-url','changed-key','deleted-workspace','erased-contact']){
  const h=await harness();try{
   const create=url=>h.call(root+'/webhooks',body({name:'Race receiver',url,events:['conversation.created']}));
   const a=await create('https://receiver.example.com/original');await h.contact();await h.conversation();h.responses.push({status:500});await h.dispatch();
   const original=await h.db.prepare("SELECT * FROM integration_deliveries WHERE state='uncertain'").first();assert.ok(original);
   const history=(await h.db.prepare('SELECT * FROM integration_attempts WHERE delivery_id=? ORDER BY number').bind(original.id).all()).results;
   await h.call(root+'/deliveries/'+original.id+'/resend',body({attempt:1}));assert.equal(h.received.length,1,'approval alone never sends');
   const trigger=await create('https://receiver.example.com/'+(scenario==='changed-key'?'original':'trigger'));
   const cipher=(await h.db.prepare('SELECT secret_ciphertext FROM native_integration_destinations WHERE id=?').bind(a.id).first()).secret_ciphertext;
   const mutation={
    disabled:{sql:'UPDATE native_integration_destinations SET enabled=0 WHERE id=?',params:[a.id]},
    'changed-url':{sql:'UPDATE native_integration_destinations SET secret_ciphertext=(SELECT secret_ciphertext FROM native_integration_destinations WHERE id=?) WHERE id=?',params:[trigger.id,a.id]},
    'changed-key':{sql:'UPDATE native_integration_destinations SET secret_ciphertext=(SELECT secret_ciphertext FROM native_integration_destinations WHERE id=?) WHERE id=?',params:[trigger.id,a.id]},
    'deleted-workspace':{sql:"INSERT INTO project_settings VALUES('p','{\"deleted_at\":1}',1)"},
    'erased-contact':{sql:"UPDATE contacts SET metadata_json=json_set(metadata_json,'$.is_erasing',1) WHERE id='visitor'"}
   }[scenario];
   await h.db.prepare('CREATE TABLE resend_race_marker(state TEXT,attempts INTEGER)').run();
   // The tenth Base batch is its post-protocol get(), after both destination
   // reads and signing. The marker proves this targets the claimed resend.
   await h.call('/_test/race',body({path:root+'/webhooks/'+trigger.id+'/test',body:{},skipBatches:9,race:[
    {sql:'INSERT INTO resend_race_marker SELECT state,attempts FROM integration_deliveries WHERE id=?',params:[original.id]},mutation
   ]}));
   assert.deepEqual(await h.db.prepare('SELECT * FROM resend_race_marker').first(),{state:'sending',attempts:2});
   assert.equal(h.received.filter(r=>r.headers['webhook-id']===original.id).length,1,scenario+' must refuse before the receiver');
   const current=await h.db.prepare('SELECT * FROM integration_deliveries WHERE id=?').bind(original.id).first();
   if(scenario==='erased-contact')assert.equal(current,null,'erasure still removes the retained payload');
   else{
    assert.equal(current.state,'rejected');assert.equal(current.attempts,2);assert.equal(current.envelope,original.envelope);
    const attempts=(await h.db.prepare('SELECT * FROM integration_attempts WHERE delivery_id=? ORDER BY number').bind(original.id).all()).results;
    assert.deepEqual(attempts.slice(0,1),history);assert.deepEqual(JSON.parse(attempts[1].outcome),{kind:'rejected',code:'preflight_failed'});
   }
   assert.equal((await h.db.prepare("SELECT count(*) n FROM native_integration_audit WHERE resource_id=? AND action='delivery.resend.2'").bind(original.id).first()).n,1);
   await h.db.prepare('UPDATE native_integration_destinations SET enabled=1,secret_ciphertext=? WHERE id=?').bind(cipher,a.id).run();
   await h.db.prepare("DELETE FROM project_settings WHERE project_id='p'").run();await h.restart();await h.dispatch();
   assert.equal(h.received.filter(r=>r.headers['webhook-id']===original.id).length,1,'restoring configuration never replays refused work');assert.equal(h.external,0);
   proof.push({scenario,resendRequests:0,state:current?.state||'erased',externalRequests:h.external});
  }finally{await h.close()}
 }
 console.log(JSON.stringify({proof:'resend-final-native-admission',scenarios:proof}));
}
