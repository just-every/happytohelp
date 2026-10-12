import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {harness,body,sha} from '../connections/harness.mjs';

test('complete native schema admits one magic-link session despite authority triggers and preserves admission guards',async()=>{
 const h=await harness();
 try{
  assert.ok(await h.db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='integration_epoch_sessions_insert'").first());
  const issue=async({user='owner',project='p',email='owner@example.test',expires=Date.now()+60000}={})=>{
   const token=randomBytes(32).toString('hex');
   await h.db.prepare('INSERT INTO magic_signins VALUES(?,?,?,?,?,NULL)').bind(sha(token),user,project,email,expires).run();
   return token;
  };
  const consume=token=>h.raw('/api/identity/magic-link/consume',{token:null,...body({token}),headers:{'Content-Type':'application/json',Origin:'https://app.example'}});
  const count=async()=>Number((await h.db.prepare('SELECT count(*) n FROM sessions').first()).n);
  const token=await issue(),before=await count(),epoch=Number((await h.db.prepare('SELECT revision FROM integration_authority_epoch WHERE id=1').first()).revision);
  const responses=await Promise.all([consume(token),consume(token)]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,400]);
  assert.equal(await count(),before+1,'exactly one authenticated row is inserted');
  assert.equal(Number((await h.db.prepare('SELECT revision FROM integration_authority_epoch WHERE id=1').first()).revision),epoch+1,'the native authority trigger still runs');
  const admitted=responses.find(response=>response.status===200);
  const cookie=admitted.headers.get('Set-Cookie');assert.ok(cookie?.includes('HttpOnly'));
  const session=await h.raw('/api/identity/session',{token:null,headers:{Cookie:cookie.split(';')[0]}});
  assert.equal(session.status,200);assert.equal((await session.json()).id,'owner');
  assert.equal((await consume(token)).status,400);assert.equal(await count(),before+1);
  const denied=async(candidate)=>{const prior=await count();assert.equal((await consume(candidate)).status,400);assert.equal(await count(),prior);assert.equal((await h.db.prepare('SELECT consumed_at FROM magic_signins WHERE token_hash=?').bind(sha(candidate)).first()).consumed_at,null);};
  await denied(await issue({expires:Date.now()-1}));
  const removed=await issue();await h.db.prepare("DELETE FROM memberships WHERE project_id='p' AND user_id='owner'").run();await denied(removed);
  await h.db.prepare("INSERT INTO memberships VALUES('p','owner','admin')").run();
  const role=await issue(),roleResponse=await consume(role);assert.equal(roleResponse.status,200);
  const roleSession=await h.raw('/api/identity/session',{token:null,headers:{Cookie:roleResponse.headers.get('Set-Cookie').split(';')[0]}});assert.equal((await roleSession.json()).role,'admin');
  const renamed=await issue();await h.db.prepare("UPDATE users SET email='changed@example.test' WHERE id='owner'").run();await denied(renamed);await h.db.prepare("UPDATE users SET email='owner@example.test' WHERE id='owner'").run();
  const deleted=await issue();await h.db.prepare("INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('p',?,1) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json").bind(JSON.stringify({deleted_at:Date.now()})).run();await denied(deleted);
  const erased=await issue({user:'foreign',project:'q',email:'foreign@example.test'});
  // Erasing an account must remove its capability before its FK-protected user.
  await h.db.batch([h.db.prepare("DELETE FROM memberships WHERE user_id='foreign'"),h.db.prepare("DELETE FROM magic_signins WHERE user_id='foreign'"),h.db.prepare("DELETE FROM users WHERE id='foreign'")]);
  const beforeErased=await count();assert.equal((await consume(erased)).status,400);assert.equal(await count(),beforeErased);assert.equal(await h.db.prepare('SELECT token_hash FROM magic_signins WHERE token_hash=?').bind(sha(erased)).first(),null);
  assert.equal(h.external,0);
 }finally{await h.close();}
});
