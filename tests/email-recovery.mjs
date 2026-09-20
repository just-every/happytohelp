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
 for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','0070_management.sql','0080_integrations.sql','0100_inbound_email_claims.sql'])for(const sql of(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await DB.prepare(sql).run()
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
