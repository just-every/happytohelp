import assert from 'node:assert/strict';
import test from 'node:test';
import {profileHarness,hash} from './profile-harness.mjs';

// Expected identity is declared before session creation or collector writes.
const trusted={name:'Trusted account name',email:'trusted-account@example.test',identifier:'account-verified-42'};
const signedMetadata={plan:'gold',private_note:'Keep this private',source:'https://example.test/é'};
const canonical=row=>({name:row.name,email:row.email,identifier:row.external_id,verified:row.is_verified===1});
const row=(h,id)=>h.db.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first();
const profile=(id,expected)=>({id,name:expected.name,email:expected.email,verified:expected.verified});
// Session admission collects request context before the collector runs. Its
// server time is bounded by this request, and collector edits must retain it.
async function observedContext(h,id,admittedAfter){
 const metadata=JSON.parse((await row(h,id)).metadata_json);
 assert.ok(metadata.last_seen_at>=admittedAfter&&metadata.last_seen_at<=Date.now());
 assert.equal(typeof metadata.ip_address,'string');assert.ok(metadata.ip_address.length);
 assert.match(metadata.country_code,/^[A-Z]{2}$/);
 assert.equal(typeof metadata.user_agent,'string');assert.ok(metadata.user_agent.length);
 return {last_seen_at:metadata.last_seen_at,ip_address:metadata.ip_address,country_code:metadata.country_code,user_agent:metadata.user_agent};
}

async function visitor(h,key,options={}){
 const session=await h.widgetSession(key,options);
 const response=await h.raw('/api/conversations',{actor:key,method:'POST',body:{projectId:session.projectId}});
 assert.equal(response.status,201);return {...session,conversationId:(await response.json()).id};
}
const collect=(h,key,id,data)=>h.raw('/api/conversations/'+id+'/widget-events',{actor:key,method:'POST',body:{action:'contact',data}});
async function owner(h){
 await h.db.prepare("INSERT INTO users VALUES('owner','owner@example.test','Owner',1)").run();
 await h.db.prepare("INSERT INTO memberships VALUES('p','owner','owner')").run();await h.session('owner','p','owner',{role:'owner'});
}

test('actual HMAC identity keeps canonical fields while signed and unsigned collectors retain distinct provided data',async()=>{
 const h=await profileHarness();
 try{
  const admittedAfter=Date.now(),signed=await visitor(h,'signed',{signed:true,...trusted,metadata:signedMetadata}),environment=await observedContext(h,signed.contactId,admittedAfter);assert.equal(signed.verified,true);
  assert.deepEqual(canonical(await row(h,signed.contactId)),{...trusted,verified:true});
  const invalid=await h.raw('/api/identity/widget/session',{actor:null,method:'POST',headers:{Origin:'https://app.example'},body:{widgetKey:'widget-p',identifier:trusted.identifier,contact_hash:'0'.repeat(64)}});
  assert.equal(invalid.status,403);
  for(const data of [
   {name:'Visitor alias',email:'visitor-alias@example.test'},
   {name:'Ignored alias',email:'ignored@example.test',provided_name:'Provided name',provided_email:'provided@example.test',external_id:'forged',is_verified:0,metadata:{plan:'forged'}},
  ]){
   const response=await collect(h,'signed',signed.conversationId,data);assert.equal(response.status,200);
   assert.deepEqual(await response.json(),{updated:true,contact:profile(signed.contactId,{...trusted,verified:true})});
   const current=await row(h,signed.contactId);assert.deepEqual(canonical(current),{...trusted,verified:true});
   assert.deepEqual(JSON.parse(current.metadata_json),{...signedMetadata,...environment,provided_name:data.provided_name??data.name,provided_email:data.provided_email??data.email,email_unproven:1});
   const saved=await h.raw(undefined,{actor:'signed'});assert.equal(saved.status,200);assert.deepEqual(await saved.json(),{contact:profile(signed.contactId,{...trusted,verified:true})});
  }
  const refreshedMetadata={plan:'platinum',fresh_private_note:'New signed metadata'};
  const resumedAfter=Date.now(),resumed=await h.widgetSession('resumed',{signed:true,...trusted,metadata:refreshedMetadata});assert.equal(resumed.contactId,signed.contactId);assert.equal(resumed.verified,true);
  assert.deepEqual(JSON.parse((await row(h,signed.contactId)).metadata_json),{...refreshedMetadata,...await observedContext(h,resumed.contactId,resumedAfter),provided_name:'Provided name',provided_email:'provided@example.test',email_unproven:1});
  assert.deepEqual(await (await h.raw(undefined,{actor:'resumed'})).json(),{contact:profile(signed.contactId,{...trusted,verified:true})});
  const guestAfter=Date.now(),unsigned=await visitor(h,'unsigned',{name:'Guest',email:'guest@example.test'}),guestEnvironment=await observedContext(h,unsigned.contactId,guestAfter);assert.equal(unsigned.verified,false);
  for(const data of [{name:'New guest',email:'new-guest@example.test'},{provided_name:'Collected guest',provided_email:'collected@example.test',is_verified:1,verified:true,external_id:trusted.identifier}]){
   const expected={name:data.provided_name??data.name,email:data.provided_email??data.email,identifier:null,verified:false};
   const response=await collect(h,'unsigned',unsigned.conversationId,data);assert.equal(response.status,200);
   assert.deepEqual(await response.json(),{updated:true,contact:profile(unsigned.contactId,expected)});
   const current=await row(h,unsigned.contactId);assert.deepEqual(canonical(current),expected);
   assert.deepEqual(JSON.parse(current.metadata_json),{...guestEnvironment,provided_name:expected.name,provided_email:expected.email,email_unproven:1});
   assert.deepEqual(await (await h.raw(undefined,{actor:'unsigned'})).json(),{contact:profile(unsigned.contactId,expected)});
  }
  await owner(h);
  const edited={name:'Operator correction',email:'operator-corrected@example.test',identifier:'operator-corrected-id',verified:true};
  const update=await h.raw('/api/management/projects/p/contacts/'+signed.contactId,{actor:'owner',method:'PUT',body:{name:edited.name,email:edited.email,external_id:edited.identifier,provided_email:'operator-note@example.test'}});
  assert.equal(update.status,200);assert.deepEqual(canonical(await row(h,signed.contactId)),edited);
  const afterOwner=await collect(h,'signed',signed.conversationId,{provided_email:'new-visitor-note@example.test'});assert.equal(afterOwner.status,200);
  assert.deepEqual((await afterOwner.json()).contact,profile(signed.contactId,edited));
  assert.deepEqual(await (await h.raw(undefined,{actor:'signed'})).json(),{contact:profile(signed.contactId,edited)});
  assert.equal(JSON.parse((await row(h,signed.contactId)).metadata_json).provided_email,'new-visitor-note@example.test');assert.equal(h.external,0);
 }finally{await h.close();}
});

test('email-identified HMAC session preserves its signed email through collector updates and profile hydration',async()=>{
 const expected={name:'Email account name',email:'verified-email@example.test',identifier:'verified-email@example.test',verified:true};
 const h=await profileHarness();
 try{
  // No identifier is supplied: the actual native fallback signs this email and
  // stores it as external_id. The name remains canonical data, not an HMAC claim.
  const admittedAfter=Date.now(),signed=await visitor(h,'email-signed',{signed:true,name:expected.name,email:expected.email}),environment=await observedContext(h,signed.contactId,admittedAfter);
  assert.equal(signed.verified,true);assert.deepEqual(canonical(await row(h,signed.contactId)),expected);
  for(const data of [
   {name:'Untrusted replacement',email:'replacement@example.test'},
   {provided_name:'Self-provided name',provided_email:'self-provided@example.test',external_id:'forged-email-id',is_verified:0},
  ]){
   const response=await collect(h,'email-signed',signed.conversationId,data);assert.equal(response.status,200);
   assert.deepEqual((await response.json()).contact,profile(signed.contactId,expected));
   const current=await row(h,signed.contactId);assert.deepEqual(canonical(current),expected);
   assert.deepEqual(JSON.parse(current.metadata_json),{...environment,provided_name:data.provided_name??data.name,provided_email:data.provided_email??data.email,email_unproven:1});
   const hydrated=await h.raw(undefined,{actor:'email-signed'});assert.equal(hydrated.status,200);
   assert.deepEqual(await hydrated.json(),{contact:profile(signed.contactId,expected)});
  }
  assert.equal(h.external,0);
 }finally{await h.close();}
});

test('signed collector rejects foreign ownership and revocation; actual erasure fences canonical and provided identities',async()=>{
 const h=await profileHarness();
 try{
  const signed=await visitor(h,'signed',{signed:true,...trusted});
  const other=await visitor(h,'other',{name:'Other'}),foreign=await visitor(h,'foreign',{project:'q',name:'Foreign'});
  const before=(await h.db.prepare('SELECT * FROM contacts ORDER BY id').all()).results;
  for(const conversationId of [other.conversationId,foreign.conversationId,'missing']){
   const response=await collect(h,'signed',conversationId,{provided_email:'forged@example.test'});assert.equal(response.status,404);
  }
  assert.deepEqual((await h.db.prepare('SELECT * FROM contacts ORDER BY id').all()).results,before);
  const provided='erase-provided@example.test';assert.equal((await collect(h,'signed',signed.conversationId,{provided_name:'Erase alias',provided_email:provided})).status,200);
  const refreshed=await h.widgetSession('signed',{signed:true,...trusted,metadata:{plan:'refreshed before erasure'}});assert.equal(refreshed.contactId,signed.contactId);
  assert.equal(JSON.parse((await row(h,signed.contactId)).metadata_json).provided_email,provided);
  await h.db.prepare('UPDATE sessions SET revoked_at=1 WHERE token_hash=?').bind(hash(h.token('signed'))).run();
  assert.equal((await collect(h,'signed',signed.conversationId,{email:'revoked@example.test'})).status,401);
  assert.equal((await h.raw(undefined,{actor:'signed'})).status,401);
  assert.deepEqual(canonical(await row(h,signed.contactId)),{...trusted,verified:true});
  assert.equal(JSON.parse((await row(h,signed.contactId)).metadata_json).provided_email,provided);
  await h.session('signed','p',signed.contactId);await owner(h);
  assert.equal((await h.raw('/api/management/projects/p/contacts/'+signed.contactId+'/erase',{actor:'owner',method:'POST'})).status,200);
  const erased=await row(h,signed.contactId);assert.deepEqual(canonical(erased),{name:null,email:null,identifier:null,verified:false});
  const metadata=JSON.parse(erased.metadata_json);assert.equal(metadata.is_erased,1);assert.equal(metadata.provided_name,undefined);assert.equal(metadata.provided_email,undefined);
  for(const [kind,value] of [['email',trusted.email],['email',provided],['external',trusted.identifier]]){
   const digest=hash(JSON.stringify(['move-in-erasure','p',kind,value]));
   assert.ok(await h.db.prepare('SELECT 1 FROM move_in_erased_identities WHERE project_id=? AND digest=?').bind('p',digest).first(),'actual erasure retains the canonical and provided identity fences');
  }
  for(const renewed of [false,true]){
   if(renewed)await h.session('signed','p',signed.contactId);
   assert.equal((await collect(h,'signed',signed.conversationId,{email:'revived@example.test'})).status,401);
   assert.equal((await h.raw(undefined,{actor:'signed'})).status,401);
  }
  assert.deepEqual(await row(h,signed.contactId),erased);assert.equal(h.external,0);
 }finally{await h.close();}
});

test('collector commit rechecks live session, privacy, workspace and conversation authority after admission',async()=>{
 const h=await profileHarness();
 try{
  const signed=await visitor(h,'signed',{signed:true,...trusted}),foreign=await visitor(h,'foreign',{project:'q',name:'Foreign'});
  const races=[
   {sql:'UPDATE sessions SET revoked_at=1 WHERE token_hash=?',token:true},
   {sql:'UPDATE sessions SET expires_at=1 WHERE token_hash=?',token:true},
   {sql:"UPDATE sessions SET project_id='q' WHERE token_hash=?",token:true},
   {sql:'UPDATE sessions SET actor_id=?,contact_id=? WHERE token_hash=?',params:[foreign.contactId,foreign.contactId],token:true},
   ...['is_erasing','is_erased','is_blocked','is_deleted'].map(flag=>({sql:"UPDATE contacts SET metadata_json=json_set(metadata_json,?,1) WHERE id=?",params:['$.'+flag,signed.contactId]})),
   {sql:"INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('p','{\"deleted_at\":1}',1)"},
   {sql:'UPDATE conversations SET contact_id=? WHERE id=?',params:[foreign.contactId,signed.conversationId]},
  ];
  for(const race of races){
   await h.db.prepare("UPDATE contacts SET metadata_json='{}' WHERE id=?").bind(signed.contactId).run();await h.db.prepare("DELETE FROM project_settings WHERE project_id='p'").run();
   await h.db.prepare('UPDATE conversations SET contact_id=? WHERE id=?').bind(signed.contactId,signed.conversationId).run();await h.session('signed','p',signed.contactId);
   const command={sql:race.sql,params:[...(race.params||[]),...(race.token?[hash(h.token('signed'))]:[])]};
   const response=await h.raw('/_test/collector-race',{actor:'signed',method:'POST',body:{conversationId:signed.conversationId,data:{name:'Stale write',email:'stale@example.test'},commands:[command]}});
   assert.equal(response.status,409);assert.doesNotMatch(await response.text(),/trusted-account|Stale write|stale@example/);
   const current=await row(h,signed.contactId);assert.deepEqual(canonical(current),{...trusted,verified:true});assert.equal(JSON.parse(current.metadata_json).provided_email,undefined);
  }
  assert.equal(h.external,0);
 }finally{await h.close();}
});

test('verification established between collector admission and commit protects the new canonical identity',async()=>{
 const h=await profileHarness();
 try{
  const admittedAfter=Date.now(),guest=await visitor(h,'guest',{name:'Before verification',email:'before@example.test'}),environment=await observedContext(h,guest.contactId,admittedAfter);
  const response=await h.raw('/_test/collector-race',{actor:'guest',method:'POST',body:{conversationId:guest.conversationId,data:{provided_name:'Untrusted alias',provided_email:'untrusted@example.test'},commands:[{sql:'UPDATE contacts SET name=?,email=?,external_id=?,is_verified=1 WHERE id=?',params:[trusted.name,trusted.email,trusted.identifier,guest.contactId]}]}});
  assert.equal(response.status,200);assert.deepEqual((await response.json()).contact,profile(guest.contactId,{...trusted,verified:true}));
  const current=await row(h,guest.contactId);assert.deepEqual(canonical(current),{...trusted,verified:true});assert.deepEqual(JSON.parse(current.metadata_json),{...environment,provided_name:'Untrusted alias',provided_email:'untrusted@example.test',email_unproven:1});
  assert.deepEqual(await (await h.raw(undefined,{actor:'guest'})).json(),{contact:profile(guest.contactId,{...trusted,verified:true})});assert.equal(h.external,0);
 }finally{await h.close();}
});
