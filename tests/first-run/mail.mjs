import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {openIdentityDb,seedWorkspace} from '../helpers/identity-db.mjs';
const {routes}=await import('../../src/modules/identity/routes.ts');
const {sendEmail}=await import('../../src/modules/integrations/email.ts');
const {notifyMessage,dispatchOperatorNotifications}=await import('../../src/modules/integrations/notifications.ts');

test('local customer and teammate mail is validated and suppressed without storage or provider requests',async()=>{
 const db=await openIdentityDb(),{DB}=db,origin='http://127.0.0.1:8787';
 const originalFetch=globalThis.fetch;let calls=0;
 try{
  for(const file of ['0002_conversations.sql','123_operator_notifications.sql','0109_magic_signins.sql'])for(const sql of (await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8')).split(';').filter(x=>x.trim()))await DB.prepare(sql).run();
  const env={...db.env,H2H_LOCAL:'true',APP_ORIGIN:origin,EMAIL_PROVIDER:'development',EMAIL_FROM:'support@localhost.test'};
  const key=crypto.randomUUID(),owner=await seedWorkspace(DB,key);
  globalThis.fetch=async()=>{calls++;throw Error('Unexpected provider request');};
  const request=await routes.request(origin+'/magic-link',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email:`owner-${key}@example.test`})},env);
  assert.equal(request.status,503);
  assert.equal((await DB.prepare('SELECT count(*) n FROM magic_signins').first()).n,0);
  await DB.batch([
   DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('local-contact',?,'customer@example.test',1)").bind(owner.projectId),
   DB.prepare("INSERT INTO conversations(id,project_id,contact_id,assigned_to,created_at,updated_at) VALUES('local-conversation',?,'local-contact',?,1,1)").bind(owner.projectId,`owner-${key}`),
   DB.prepare("INSERT INTO email_settings VALUES(?,'Support','support@localhost.test','reply@localhost.test',1,1)").bind(owner.projectId),
  ]);
  const actor={id:`owner-${key}`,projectId:owner.projectId,role:'owner'};
  let revision=0;
  for(const actor_role of ['operator','contact']){
   const message={id:crypto.randomUUID(),conversation_id:'local-conversation',actor_role,content:'A real local reply'};
   await DB.prepare('INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(message.id,owner.projectId,message.conversation_id,message.id,actor_role==='contact'?'local-contact':actor.id,actor_role,message.content,++revision,Date.now()).run();
   await DB.prepare('UPDATE conversations SET revision=?,updated_at=? WHERE id=?').bind(revision,Date.now(),message.conversation_id).run();
   const receipt=await notifyMessage(env,message,actor);assert.equal(receipt.state,actor_role==='contact'?'queued':'suppressed');
   await notifyMessage(env,message,actor);
  }
  await dispatchOperatorNotifications(env,{now:Date.now()+61000});
  assert.equal((await DB.prepare("SELECT state FROM operator_notifications WHERE conversation_id='local-conversation'").first()).state,'complete');
  assert.equal((await DB.prepare('SELECT count(*) n FROM email_deliveries').first()).n,0);
  assert.equal(calls,0);
  await assert.rejects(sendEmail(env,{to:'invalid',subject:'Invalid recipient',text:'Message',idempotencyKey:crypto.randomUUID()}));
  await assert.rejects(sendEmail({...env,H2H_LOCAL:undefined},{to:'x@example.test',subject:'No provider',text:'Message',idempotencyKey:crypto.randomUUID()}));
  globalThis.fetch=async()=>{calls++;return new Response('Unavailable',{status:503});};
  await assert.rejects(sendEmail({...env,H2H_LOCAL:undefined,EMAIL_PROVIDER:'resend',EMAIL_API_KEY:randomBytes(24).toString('hex')},{to:'x@example.test',subject:'Provider failed',text:'Message',idempotencyKey:crypto.randomUUID()}));
  assert.equal(calls,1);
  const row=await DB.prepare('SELECT state FROM email_deliveries').first();assert.equal(row.state,'uncertain');
 }finally{globalThis.fetch=originalFetch;await db.dispose();}
});
