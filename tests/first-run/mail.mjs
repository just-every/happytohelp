import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {openIdentityDb,seedWorkspace} from '../helpers/identity-db.mjs';
const {routes}=await import('../../src/modules/identity/routes.ts');
const {sendEmail}=await import('../../src/modules/integrations/email.ts');
const {notifyMessage}=await import('../../src/modules/integrations/notifications.ts');
const {localMailSender,localOutboxResponse}=await import('../../src/edition/local-mail/outbox.ts');
const {createD1DevelopmentOutbox}=await import('../../src/vendor/base/modules/mail/src/development/index.mjs');

test('explicit local mode captures real native sign-in and customer mail without a provider request',async()=>{
 const db=await openIdentityDb(),{DB}=db,origin='http://127.0.0.1:8787';
 const originalFetch=globalThis.fetch;let calls=0;
 try{
  for(const file of ['0002_conversations.sql','0109_magic_signins.sql','117_development_outbox.sql'])for(const sql of (await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8')).split(';').filter(x=>x.trim()))await DB.prepare(sql).run();
  const env={...db.env,H2H_LOCAL:'true',APP_ORIGIN:origin,EMAIL_PROVIDER:'development',EMAIL_FROM:'support@localhost.test'};
  const workspaceKey=crypto.randomUUID(),owner=await seedWorkspace(DB,workspaceKey),ownerEmail=`owner-${workspaceKey}@example.test`;
  globalThis.fetch=async()=>{calls++;throw Error('Unexpected provider request');};
  const call=async(path,body)=>{const pending=[];const response=await routes.request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)},env,{waitUntil:p=>pending.push(p),passThroughOnException(){}});await Promise.all(pending);return response};
  const request=await call('/magic-link',{email:ownerEmail});
  const unknown=await call('/magic-link',{email:'unknown@example.test'});
  assert.equal(request.status,202);assert.equal(unknown.status,202);assert.deepEqual(await request.json(),await unknown.json());
  const outbox=createD1DevelopmentOutbox({db:DB}),messages=await outbox.list();
  assert.equal(messages.length,1);assert.match(messages[0].message.subject,/Sign in/);
  const link=new URL(messages[0].message.text.match(/http:\/\/\S+/)[0]);
  assert.equal(link.origin,origin);const token=new URLSearchParams(link.hash.slice(1)).get('token');
  assert.ok(token&&token.length===64,'local link retains the native capability');
  const before=await DB.prepare('SELECT consumed_at FROM magic_signins').first();assert.equal(before.consumed_at,null);
  const consume=await call('/magic-link/consume',{token});assert.equal(consume.status,200);
  const session=await routes.request(origin+'/session',{headers:{Cookie:consume.headers.get('Set-Cookie').split(';')[0]}},env);
  assert.equal(session.status,200);assert.equal((await session.json()).projectId,owner.projectId);
  assert.equal((await call('/magic-link/consume',{token})).status,400);
  await DB.batch([
   DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('local-contact',?,'customer@example.test',1)").bind(owner.projectId),
   DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('local-conversation',?,'local-contact',1,1)").bind(owner.projectId),
   DB.prepare("INSERT INTO email_settings VALUES(?,'Support','support@localhost.test','reply@localhost.test',1,1)").bind(owner.projectId),
  ]);
  const message={id:crypto.randomUUID(),conversation_id:'local-conversation',actor_role:'operator',content:'A real local customer reply'},actor={id:`owner-${workspaceKey}`,projectId:owner.projectId,role:'owner'};
  assert.equal((await notifyMessage(env,message,actor)).mode,'local');await notifyMessage(env,message,actor);
  const captured=await outbox.list();assert.equal(captured.length,2);
  const reply=captured.find(row=>row.message.subject==='Reply to your support conversation');assert.ok(reply);
  assert.equal(reply.message.text,message.content);assert.deepEqual(reply.message.to,['customer@example.test']);
  assert.equal(reply.message.headers['Auto-Submitted'],'auto-generated');assert.equal(reply.message.headers['X-Auto-Response-Suppress'],'All');
  assert.equal(calls,0);
  await assert.rejects(sendEmail({...env,H2H_LOCAL:undefined},{to:'x@example.test',subject:'No fallback',text:'No provider',idempotencyKey:crypto.randomUUID()}));
  assert.equal((await outbox.list()).length,2);
  globalThis.fetch=async()=>{calls++;return new Response('Unavailable',{status:503});};
  await assert.rejects(sendEmail({...env,H2H_LOCAL:undefined,EMAIL_PROVIDER:'resend',EMAIL_API_KEY:randomBytes(24).toString('hex')},{to:'x@example.test',subject:'No fallback',text:'Provider failed',idempotencyKey:crypto.randomUUID()}));
  assert.equal(calls,1);assert.equal((await outbox.list()).length,2);
 }finally{globalThis.fetch=originalFetch;await db.dispose();}
});

test('production never constructs local mail or touches a database for forged outbox requests',async()=>{
 let touched=0;
 const configurations=[{},{EMAIL_PROVIDER:'development'},{H2H_LOCAL:'true',EMAIL_PROVIDER:'development',APP_ORIGIN:'https://production.example'},{H2H_LOCAL:'true',EMAIL_PROVIDER:'development',APP_ORIGIN:'http://127.0.0.1:8787',RER_INSTALLATION_ID:'installed'}].map(config=>Object.defineProperty(config,'DB',{get(){touched++;throw Error('Database must remain untouched');}}));
 for(const config of configurations){
  assert.equal(localMailSender(config),null);
  for(const method of ['GET','HEAD'])for(const url of ['https://production.example/__dev/outbox','http://127.0.0.1:8787/__dev/outbox','http://127.0.0.1:8787/__dev/outbox/'])for(const headers of [{},{Host:'127.0.0.1:8787',Origin:'http://127.0.0.1:8787'},{Host:'production.example',Forwarded:'host=127.0.0.1:8787;proto=http','X-Forwarded-Host':'127.0.0.1:8787','X-Forwarded-Proto':'http'}]){
   const response=await localOutboxResponse(new Request(url,{method,headers}),config);assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
 }
 const local=Object.defineProperty({H2H_LOCAL:'true',EMAIL_PROVIDER:'development',APP_ORIGIN:'http://127.0.0.1:8787'},'DB',{get(){touched++;throw Error('Rejected local requests must not open D1');}});
 for(const method of ['GET','HEAD'])for(const [url,headers] of [
  ['http://127.0.0.1:8787/__dev/outbox',{Host:'evil.example'}],
  ['http://127.0.0.1:8787/__dev/outbox',{Host:'127.0.0.1:8787',Origin:'https://evil.example'}],
  ['http://127.0.0.1:8787/__dev/outbox',{Host:'127.0.0.1:8787','Sec-Fetch-Site':'cross-site'}],
  ['https://evil.example/__dev/outbox',{Host:'evil.example',Forwarded:'host=127.0.0.1:8787;proto=http','X-Forwarded-Host':'127.0.0.1:8787','X-Forwarded-Proto':'http'}],
 ])assert.equal((await localOutboxResponse(new Request(url,{method,headers}),local)).status,404);
 assert.equal(touched,0);
});
