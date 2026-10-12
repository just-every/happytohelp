import assert from 'node:assert/strict';
import test from 'node:test';
import {profileHarness,hash} from './profile-harness.mjs';

test('visitor profile reads current saved fields without writes, metadata disclosure, or verification promotion',async()=>{
 const h=await profileHarness();
 try{
  await h.contact('visitor');await h.contact('signed','p',{verified:true});await h.contact('foreign','q');
  const before=await h.snapshot();
  for(const [actor,verified] of [['visitor',false],['signed',true]]){
   const response=await h.raw(undefined,{actor});assert.equal(response.status,200);
   assert.match(response.headers.get('Cache-Control'),/no-store/);
   assert.deepEqual(await response.json(),{contact:{id:actor,name:'Saved '+actor,email:actor+'@example.test',verified}});
  }
  const own=await h.raw('/api/identity/widget/profile?contactId=foreign&projectId=q');
  assert.equal(own.status,200);assert.equal((await own.json()).contact.id,'visitor','caller IDs cannot select a profile');
  for(const id of ['foreign','missing'])assert.equal((await h.raw('/api/identity/widget/profile/'+id)).status,404);
  assert.deepEqual(await h.snapshot(),before,'profile hydration is a read, including native authority epochs and outboxes');
  assert.equal(h.external,0);
 }finally{await h.close();}
});

test('visitor profile refuses non-visitor, missing, expired, revoked, blocked, deleted and cross-project authority',async()=>{
 const h=await profileHarness();
 try{
  await h.contact('visitor');await h.contact('foreign','q');
  await h.db.prepare("INSERT INTO users VALUES('owner','owner@example.test','Owner',1)").run();
  await h.db.prepare("INSERT INTO memberships VALUES('p','owner','owner')").run();await h.session('owner','p','owner',{role:'owner'});
  for(const headers of [{},{Cookie:'h2h_session='+h.token('visitor')},{Authorization:'Bearer invalid',Cookie:'h2h_session='+h.token('visitor')}])assert.equal((await h.raw(undefined,{actor:null,headers})).status,401);
  assert.equal((await h.raw(undefined,{actor:'owner'})).status,404);
  await h.session('mismatched','p','foreign');assert.equal((await h.raw(undefined,{actor:'mismatched'})).status,404);
  for(const [field,value] of [['expires_at',Date.now()-1],['revoked_at',Date.now()]]){
   await h.db.prepare('UPDATE sessions SET '+field+'=? WHERE token_hash=?').bind(value,hash(h.token('visitor'))).run();
   assert.equal((await h.raw()).status,401);await h.session('visitor','p','visitor');
  }
  for(const flag of ['is_blocked','is_deleted','is_erasing','is_erased']){
   await h.db.prepare('UPDATE contacts SET metadata_json=? WHERE id=?').bind(JSON.stringify({[flag]:true}),'visitor').run();
   const response=await h.raw();assert.ok([401,404].includes(response.status));assert.doesNotMatch(await response.text(),/Saved visitor|visitor@example/);
  }
  await h.db.prepare("UPDATE contacts SET metadata_json='{}' WHERE id='visitor'").run();
  await h.db.prepare("INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('p','{\"deleted_at\":1}',1)").run();
  assert.equal((await h.raw()).status,401);assert.equal(h.external,0);
 }finally{await h.close();}
});

test('native integration bearer and cookie-only profile requests do no database work',async()=>{
 const h=await profileHarness();
 try{
  for(const [headers,status] of [[{Authorization:'Bearer int_'+'a'.repeat(64)},404],[{Cookie:'h2h_session=untrusted'},401],[{Authorization:'Bearer int_'+'a'.repeat(64),Origin:'https://foreign.example'},404],[{Cookie:'h2h_session=untrusted',Origin:'https://foreign.example'},401]]){
   const response=await h.raw('/_test/profile-no-database',{actor:null,headers});
   assert.equal(response.status,status);assert.equal(response.headers.get('X-Test-Database-Reads'),'0');assert.match(response.headers.get('Cache-Control'),/no-store/);
  }
 }finally{await h.close();}
});

test('profile obeys native widget CORS and actual contact erasure permanently removes read authority',async()=>{
 const h=await profileHarness();
 try{
  await h.contact('visitor');
  await h.db.prepare("UPDATE projects SET allowed_origin='https://widget.example' WHERE id='p'").run();
  const allowed=await h.raw(undefined,{headers:{Origin:'https://widget.example'}});assert.equal(allowed.status,200);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),'https://widget.example');assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'),null);
  const foreign=await h.raw(undefined,{headers:{Origin:'https://foreign.example'}});assert.equal(foreign.status,403);assert.doesNotMatch(await foreign.text(),/Saved visitor|visitor@example/);
  await h.db.prepare("INSERT INTO users VALUES('owner','owner@example.test','Owner',1)").run();await h.db.prepare("INSERT INTO memberships VALUES('p','owner','owner')").run();await h.session('owner','p','owner',{role:'owner'});
  const erased=await h.raw('/api/management/projects/p/contacts/visitor/erase',{actor:'owner',method:'POST'});assert.equal(erased.status,200);
  assert.equal((await h.raw()).status,401);
  const row=await h.db.prepare("SELECT name,email,metadata_json FROM contacts WHERE id='visitor'").first();assert.equal(row.name,null);assert.equal(row.email,null);assert.equal(JSON.parse(row.metadata_json).is_erased,1);
  await h.session('visitor','p','visitor');assert.equal((await h.raw()).status,401,'even a newly injected session cannot disclose erased identity');assert.equal(h.external,0);
 }finally{await h.close();}
});

test('profile extraction rechecks current authority after admission, including erasure and epoch-changing races',async()=>{
 const h=await profileHarness();
 try{
  await h.contact('visitor');await h.contact('foreign','q');
  const races=[
   {sql:'UPDATE sessions SET revoked_at=1 WHERE token_hash=?',params:[hash(h.token('visitor'))]},
   {sql:'UPDATE sessions SET expires_at=1 WHERE token_hash=?',params:[]},
   {sql:"UPDATE sessions SET project_id='q' WHERE token_hash=?",params:[]},
   {sql:"UPDATE sessions SET actor_id='foreign',contact_id='foreign' WHERE token_hash=?",params:[]},
   {sql:"UPDATE contacts SET metadata_json='{\"is_erasing\":1}' WHERE id='visitor'",expectedContactMetadata:{is_erasing:1}},
   {sql:"UPDATE contacts SET metadata_json='{\"is_erased\":1}' WHERE id='visitor'",expectedContactMetadata:{is_erased:1}},
   {sql:"UPDATE contacts SET metadata_json='{\"is_blocked\":1}' WHERE id='visitor'",expectedContactMetadata:{is_blocked:1}},
   {sql:"UPDATE contacts SET metadata_json='{\"is_deleted\":1}' WHERE id='visitor'",expectedContactMetadata:{is_deleted:1}},
   {sql:"INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('p','{\"deleted_at\":1}',1) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json"},
  ];
  for(const race of races){
   await h.db.prepare("UPDATE contacts SET metadata_json='{}' WHERE id='visitor'").run();await h.db.prepare("DELETE FROM project_settings WHERE project_id='p'").run();await h.session('visitor','p','visitor');
   const epoch=await h.db.prepare('SELECT revision FROM integration_authority_epoch WHERE id=1').first();
   const command={...race,...(race.sql.includes('token_hash=?')?{params:[hash(h.token('visitor'))]}:{})};
   const response=await h.raw('/_test/profile-race',{method:'POST',body:{match:'JOIN contacts profile_contact',commands:[command]}});
   assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/Saved visitor|visitor@example|foreign@example/);
   const currentEpoch=await h.db.prepare('SELECT revision FROM integration_authority_epoch WHERE id=1').first();
   if(race.expectedContactMetadata){
    assert.deepEqual(JSON.parse((await h.db.prepare("SELECT metadata_json FROM contacts WHERE id='visitor'").first()).metadata_json),race.expectedContactMetadata,'the declared contact privacy mutation committed before extraction');
    assert.equal(currentEpoch.revision,epoch.revision,'contact privacy is fenced directly, not by the integration issuance epoch');
   }else assert.ok(currentEpoch.revision>epoch.revision,'native session/workspace authority mutation occurred before extraction');
  }
  assert.equal(h.external,0);
 }finally{await h.close();}
});
