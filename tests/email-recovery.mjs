import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {receiveEmail}=await import('../src/modules/integrations/inbound-service.ts')
const {inboundRecoveryRoutes}=await import('../src/modules/integrations/inbound-recovery-routes.ts')
const {hashToken}=await import('../src/platform/auth.ts')
const {releaseInterruptedInbound}=await import('../src/modules/integrations/inbound-recovery.ts')
const {getPlatformProxy}=await import('wrangler'),proxy=await getPlatformProxy({persist:false})
try{
 const env=proxy.env,DB=env.DB
 for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','0070_management.sql','0080_integrations.sql','0100_inbound_email_claims.sql','0104_inbound_email_classification.sql'])for(const sql of(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await DB.prepare(sql).run()
 await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)").run()
 await DB.prepare("INSERT INTO email_settings VALUES('p','Support','support@example.com','inbound@example.com',1,1)").run()
 const input={messageId:'recover',to:'inbound@example.com',from:'customer@example.com',text:'Durable email',attachments:[{filename:'note.txt',contentType:'text/plain',content:new TextEncoder().encode('attachment').buffer}]}
 // Actual SQLite failure after staging R2 and conversation, before transcript admission.
 await DB.prepare("CREATE TRIGGER fail_email_admission BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'temporary admission failure'); END").run()
 await assert.rejects(receiveEmail(env,input),/temporary admission failure/)
 const failed=await DB.prepare("SELECT * FROM inbound_emails WHERE id='recover'").first()
 assert.equal(failed.state,'failed');assert.ok(failed.conversation_id)
 assert.equal((await DB.prepare('SELECT count(*) n FROM messages').first()).n,0)
 await assert.rejects(receiveEmail(env,{...input,text:'Changed intent'}),/identity conflict/)
 await assert.rejects(receiveEmail(env,{...input,attachments:[{...input.attachments[0],content:new TextEncoder().encode('changed').buffer}]}),/identity conflict/)
 await DB.prepare('DROP TRIGGER fail_email_admission').run()
 const recovered=await receiveEmail(env,input)
 assert.equal(recovered.state,'delivered');assert.equal(recovered.duplicate,false);assert.equal(recovered.conversationId,failed.conversation_id)
 assert.equal((await DB.prepare('SELECT count(*) n FROM conversations').first()).n,1)
 assert.equal((await DB.prepare('SELECT count(*) n FROM media').first()).n,1)
 assert.equal((await DB.prepare('SELECT count(*) n FROM messages').first()).n,1)
 assert.equal((await env.FILES.list()).objects.length,1)
 assert.equal((await receiveEmail(env,input)).duplicate,true)
 // Completion failure happens after atomic message/outbox admission. Retry only reconciles.
 const after={...input,messageId:'after-admission',conversationId:recovered.conversationId,attachments:[]}
 await DB.prepare("CREATE TRIGGER fail_email_completion BEFORE UPDATE OF state ON inbound_emails WHEN NEW.id='after-admission' AND NEW.state='delivered' BEGIN SELECT RAISE(ABORT,'temporary completion failure'); END").run()
 await assert.rejects(receiveEmail(env,after),/temporary completion failure/)
 await DB.prepare('DROP TRIGGER fail_email_completion').run()
 const reconciled=await receiveEmail(env,after)
 assert.equal(reconciled.state,'delivered');assert.equal(reconciled.duplicate,true);assert.equal(reconciled.message,undefined)
 assert.equal((await DB.prepare('SELECT revision FROM conversations').first()).revision,2)
 assert.equal((await DB.prepare('SELECT count(*) n FROM conversation_outbox').first()).n,2)
 // Old receipts had no conversation checkpoint; recover their committed admission too.
 await DB.prepare("UPDATE inbound_emails SET state='failed',conversation_id=NULL,claim_token=NULL WHERE id='after-admission'").run()
 assert.equal((await receiveEmail(env,after)).conversationId,recovered.conversationId)
 // A process loss after admission also reconciles from processing.
 await DB.prepare("UPDATE inbound_emails SET state='processing' WHERE id='after-admission'").run()
 assert.equal((await receiveEmail(env,after)).state,'delivered')
 // Receipts created before project-scoped local IDs remain replay-safe. The
 // old admission ID is readable, while new writes use the scoped form.
 const legacy={...input,messageId:'legacy-existing',from:'legacy@example.com',text:'Already committed',attachments:[]},legacyLocalId=`email:${await hashToken(legacy.messageId)}`
 await DB.batch([
  DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('legacy-contact','p','legacy@example.com',1)"),
  DB.prepare("INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,created_at,updated_at) VALUES('legacy-conversation','p','legacy-contact',1,'legacy-message',1,1)"),
  DB.prepare("INSERT INTO inbound_emails(id,project_id,conversation_id,intent_hash,state,error,created_at,claim_token) VALUES('legacy-existing','p','legacy-conversation',?,'processing',NULL,1,NULL)").bind(await hashToken(JSON.stringify({to:'inbound@example.com',from:'legacy@example.com',content:'Already committed',conversationId:null,attachments:[]}))),
  DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at,intent_hash) VALUES('legacy-message','p','legacy-conversation',?,'legacy-contact','contact','Already committed',1,1,NULL)").bind(legacyLocalId),
 ])
 const legacyReplay=await receiveEmail(env,legacy)
 assert.equal(legacyReplay.state,'delivered');assert.equal(legacyReplay.duplicate,true);assert.equal((await DB.prepare("SELECT count(*) n FROM messages WHERE conversation_id='legacy-conversation'").first()).n,1)
 // Explicit release requires an observed scoped receipt and operator confirmation.
 const interrupted={...input,messageId:'interrupted',attachments:[]}
 await DB.prepare("CREATE TRIGGER fail_interrupted BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'interrupted'); END").run()
 await assert.rejects(receiveEmail(env,interrupted),/interrupted/)
 await DB.prepare('DROP TRIGGER fail_interrupted').run()
 await DB.prepare("UPDATE inbound_emails SET state='processing' WHERE id='interrupted'").run()
 const receipt=await DB.prepare("SELECT * FROM inbound_emails WHERE id='interrupted'").first()
 const observed={projectId:'p',messageId:receipt.id,intentHash:receipt.intent_hash,createdAt:receipt.created_at,conversationId:receipt.conversation_id,claimToken:receipt.claim_token,priorExecutionEnded:true}
 await assert.rejects(releaseInterruptedInbound(env,{...observed,priorExecutionEnded:false}),/Confirm/)
 await assert.rejects(releaseInterruptedInbound(env,{...observed,projectId:'other'}),/outside/)
 await assert.rejects(releaseInterruptedInbound(env,{...observed,conversationId:null}),/changed/)
 await DB.prepare("INSERT INTO users VALUES('owner','owner@example.com','Owner',1)").run()
 await DB.prepare("INSERT INTO memberships VALUES('p','owner','owner')").run()
 await DB.prepare("INSERT INTO sessions VALUES(?,'owner','p','owner',NULL,?,NULL)").bind(await hashToken('owner-token'),Date.now()+60000).run()
 const route='/projects/p/inbound-emails/interrupted'
 assert.equal((await inboundRecoveryRoutes.request(route,{},env)).status,401)
 assert.equal((await inboundRecoveryRoutes.request(route,{headers:{Authorization:'Bearer owner-token'}},env)).status,200)
 assert.equal((await inboundRecoveryRoutes.request('/projects/other/inbound-emails/interrupted',{headers:{Authorization:'Bearer owner-token'}},env)).status,403)
 await DB.prepare("UPDATE memberships SET role='operator' WHERE user_id='owner'").run()
 await DB.prepare("UPDATE sessions SET role='operator'").run()
 assert.equal((await inboundRecoveryRoutes.request(route+'/reconcile',{method:'POST',headers:{Authorization:'Bearer owner-token','Content-Type':'application/json'},body:JSON.stringify(observed)},env)).status,403)
 await DB.prepare("UPDATE memberships SET role='owner' WHERE user_id='owner'").run()
 await DB.prepare("UPDATE sessions SET role='owner'").run()
 const releases=await Promise.all([inboundRecoveryRoutes.request(route+'/reconcile',{method:'POST',headers:{Authorization:'Bearer owner-token','Content-Type':'application/json'},body:JSON.stringify(observed)},env),inboundRecoveryRoutes.request(route+'/reconcile',{method:'POST',headers:{Authorization:'Bearer owner-token','Content-Type':'application/json'},body:JSON.stringify(observed)},env)])
 assert.equal(releases.filter(result=>result.status===200).length,1)
 await DB.prepare("CREATE TRIGGER interrupt_again BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'interrupted again'); END").run()
 await assert.rejects(receiveEmail(env,interrupted),/interrupted again/)
 await DB.prepare('DROP TRIGGER interrupt_again').run()
 await DB.prepare("UPDATE inbound_emails SET state='processing' WHERE id='interrupted'").run()
 await assert.rejects(releaseInterruptedInbound(env,observed),/changed/)
 const newer=await DB.prepare("SELECT claim_token FROM inbound_emails WHERE id='interrupted'").first()
 assert.notEqual(newer.claim_token,observed.claimToken)
 await releaseInterruptedInbound(env,{...observed,claimToken:newer.claim_token})
 assert.equal((await receiveEmail(env,interrupted)).state,'delivered')
 await DB.prepare("UPDATE inbound_emails SET state='processing' WHERE id='interrupted'").run()
 await assert.rejects(releaseInterruptedInbound(env,observed),/already admitted/)
 assert.equal((await receiveEmail(env,interrupted)).state,'delivered')
 await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('other','Other','other-w','https://example.com',1)").run()
 await DB.prepare("UPDATE email_settings SET project_id='other'").run()
 const crossProject=await receiveEmail(env,input)
 assert.equal(crossProject.state,'delivered')
 assert.notEqual(crossProject.conversationId,recovered.conversationId)
 console.log('Inbound email recovery: real D1 failures before/after admission, stable R2 staging, identity and tenant fences, exactly-once transcript/outbox passed')
}finally{await proxy.dispose()}

// Classification survives recovery: a lost completion write, a failed claim and a
// receipt written before classification existed all keep automatic mail quiet on replay.
{
 // message-effects imports module directories through their index.
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'/index.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
 const {applyMessageEffects}=await import('../src/message-effects.ts')
 const {isAutomaticInboundEmail}=await import('../src/modules/integrations/inbound-origin.ts')
 const {emailEvidence}=await import('../src/modules/integrations/email-classification.ts')
 const proxy=await getPlatformProxy({persist:false}),originalFetch=globalThis.fetch
 try{
  const outbound=[],env={...proxy.env,EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'fixture-resend',EMAIL_FROM:'support@example.com'},DB=env.DB
  globalThis.fetch=async(url,init)=>{outbound.push(JSON.parse(String(init.body)));return Response.json({id:`resend-${outbound.length}`})}
  for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','0070_management.sql','0080_integrations.sql','0100_inbound_email_claims.sql','0104_inbound_email_classification.sql'])for(const sql of(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await DB.prepare(sql).run()
  await DB.batch([
   DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)"),
   DB.prepare("INSERT INTO email_settings VALUES('p','Support','support@example.com','inbound@example.com',1,1)"),
   DB.prepare("INSERT INTO users VALUES('op','op@example.com','Operator',1)"),
   DB.prepare("INSERT INTO memberships VALUES('p','op','operator')"),
   DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('customer','p','customer@example.com',1)"),
   DB.prepare("INSERT INTO conversations(id,project_id,contact_id,assigned_to,created_at,updated_at) VALUES('assigned','p','customer','op',1,1)"),
  ])
  const evidence=(headers={},subject='Re: my order')=>emailEvidence({envelopeFrom:'customer@example.com',headerFrom:'customer@example.com',subject,headers:Object.entries(headers).map(([key,value])=>({key,value}))})
  const away=evidence({'Auto-Submitted':'auto-replied'},'Automatic reply: my order')
  const message=async messageId=>DB.prepare("SELECT m.* FROM messages m JOIN inbound_emails i ON i.local_id=m.local_id AND i.conversation_id=m.conversation_id WHERE i.id=?").bind(messageId).first()
  const replay=async row=>applyMessageEffects(env,row,{id:String(row.actor_id),projectId:'p',role:'contact',contactId:String(row.actor_id)})
  const claim=async messageId=>DB.prepare('SELECT * FROM inbound_emails WHERE id=?').bind(messageId).first()

  // Admission committed, completion write lost: the claim has no message_id yet, and
  // the scheduler's replay still finds the classification by local id and conversation.
  const lost={messageId:'lost-away',to:'inbound+assigned@example.com',from:'customer@example.com',text:'Away until Monday',evidence:away}
  await DB.prepare("CREATE TRIGGER fail_away_completion BEFORE UPDATE OF state ON inbound_emails WHEN NEW.state='delivered' BEGIN SELECT RAISE(ABORT,'completion lost'); END").run()
  await assert.rejects(receiveEmail(env,lost),/completion lost/)
  const lostCustomer={messageId:'lost-customer',to:'inbound+assigned@example.com',from:'customer@example.com',text:'Any news?',evidence:evidence()}
  await assert.rejects(receiveEmail(env,lostCustomer),/completion lost/)
  await DB.prepare('DROP TRIGGER fail_away_completion').run()
  assert.equal((await claim('lost-away')).message_id,null);assert.equal((await claim('lost-away')).automatic,1)
  const lostMessage=await message('lost-away')
  assert.ok(lostMessage);assert.equal(await isAutomaticInboundEmail(env,'p',lostMessage),true)
  await replay(lostMessage)
  assert.equal(outbound.length,0);assert.equal((await DB.prepare('SELECT count(*) n FROM email_deliveries').first()).n,0)
  // The same crash for customer mail still notifies the assigned operator.
  await replay(await message('lost-customer'))
  assert.equal(outbound.length,1);assert.deepEqual(outbound[0].to,['op@example.com']);assert.deepEqual(outbound[0].headers,{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'})
  // A redelivery through a relay that stripped the headers reconciles and keeps the first answer.
  const reconciled=await receiveEmail(env,{...lost,evidence:evidence()})
  assert.equal(reconciled.duplicate,true);assert.equal(reconciled.automatic,true)
  assert.equal((await claim('lost-away')).message_id,lostMessage.id);assert.equal((await claim('lost-away')).automatic,1)

  // Failure before admission: the retried claim keeps the first classification.
  const retried={messageId:'retried-away',to:'inbound+assigned@example.com',from:'customer@example.com',text:'Out of the office',evidence:away}
  await DB.prepare("CREATE TRIGGER fail_admission BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'admission failed'); END").run()
  await assert.rejects(receiveEmail(env,retried),/admission failed/)
  await DB.prepare('DROP TRIGGER fail_admission').run()
  assert.equal((await claim('retried-away')).state,'failed');assert.equal((await claim('retried-away')).automatic,1)
  const retry=await receiveEmail(env,{...retried,evidence:evidence()})
  assert.equal(retry.state,'delivered');assert.equal(retry.duplicate,false);assert.equal(retry.automatic,true)
  assert.deepEqual(JSON.parse((await claim('retried-away')).evidence_json).reasons,['auto-submitted','subject'])
  await replay(retry.message)
  assert.equal(outbound.length,1)

  // A failed receipt written before classification existed is classified when it is claimed again.
  const legacy={messageId:'legacy-away',to:'inbound@example.com',from:'customer@example.com',text:'I am away',evidence:away}
  await DB.prepare("INSERT INTO inbound_emails(id,project_id,conversation_id,intent_hash,state,error,created_at,claim_token) VALUES('legacy-away','p',NULL,?,'failed','interrupted',1,NULL)").bind(await hashToken(JSON.stringify({to:'inbound@example.com',from:'customer@example.com',content:'I am away',conversationId:null,attachments:[]}))).run()
  assert.equal((await claim('legacy-away')).local_id,null)
  const legacyRetry=await receiveEmail(env,legacy)
  assert.equal(legacyRetry.duplicate,false);assert.equal(legacyRetry.automatic,true);assert.equal((await claim('legacy-away')).automatic,1)
  assert.equal(await isAutomaticInboundEmail(env,'p',legacyRetry.message),true)
  // A message whose email: local id no claim owns is not classified automatic.
  assert.equal(await isAutomaticInboundEmail(env,'p',{...legacyRetry.message,conversation_id:'assigned',id:'another'}),false)
  console.log('Inbound email classification recovery: lost completion, failed claim retry, pre-classification receipts and replay suppression passed')
 }finally{globalThis.fetch=originalFetch;await proxy.dispose()}
}
