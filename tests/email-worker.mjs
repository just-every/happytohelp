import {migrationStatements} from './helpers/migration-statements.mjs';
import {registerHooks,createRequire} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const require=createRequire(import.meta.url),{build}=require('esbuild'),{Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
const compiled=await build({entryPoints:['tests/conversation-worker.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],logLevel:'silent'})
async function notificationRuntime(){
 const runtime=new Miniflare(convertV4MiniflareOptions({name:'email-worker',modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}}}))
 return {env:await runtime.getBindings(),dispose:()=>runtime.dispose()}
}
const {recipientReplyAddress}=await import('../src/modules/integrations/email-reply-address.ts'),{inboundTarget}=await import('../src/modules/integrations/inbound-routing.ts')
const protectedAddress=async(env,to,from)=>{const target=inboundTarget(to);return target?.conversationId?await recipientReplyAddress(env,target.mailbox,'p',target.conversationId,from):to}
const {handleEmail}=await import('../src/modules/integrations/email-worker.ts'),proxy=await notificationRuntime()
try{const env={...proxy.env,INBOUND_EMAIL_TOKEN:'worker-fixture',OPENAI_API_KEY:undefined,EMAIL_API_KEY:undefined},DB=env.DB;for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','0070_management.sql','0071_management_preferences.sql','0080_integrations.sql','123_operator_notifications.sql','0100_inbound_email_claims.sql','0104_inbound_email_classification.sql','122_email_content.sql','123_email_reply_grants.sql','112_conversation_outcomes.sql'])for(const sql of migrationStatements(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))await DB.prepare(sql).run();await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)").run();await DB.prepare("INSERT INTO email_settings VALUES('p','Support','support@example.com','inbound@example.com',1,1)").run();let rejected;const promises=[];const execution={waitUntil:p=>promises.push(p)};async function deliver(id,to,text,attachment=false){to=await protectedAddress(env,to,'customer@example.com');const raw=`From: Customer <customer@example.com>\r\nTo: ${to}\r\nMessage-ID: <${id}>\r\nMIME-Version: 1.0\r\n${attachment?'Content-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain\r\n\r\n'+text+'\r\n--b\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="example.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYXR0YWNobWVudA==\r\n--b--':'Content-Type: '+(text.startsWith('<')?'text/html':'text/plain')+'\r\n\r\n'+text}`;return handleEmail({from:'customer@example.com',to,rawSize:raw.length,raw:new Response(raw).body,setReject:reason=>{rejected=reason}},env,execution)}await deliver('first@example.com','inbound@example.com','First email',true);await Promise.all(promises);assert.equal(rejected,undefined);const c=await DB.prepare('SELECT * FROM conversations').first();assert.equal(c.revision,1);assert.equal((await DB.prepare('SELECT * FROM media').first()).filename,'example.txt');await deliver('second@example.com',`inbound+${c.id}@example.com`,'Reply email');await Promise.all(promises);assert.equal((await DB.prepare('SELECT count(*) n FROM conversations').first()).n,1);assert.equal((await DB.prepare('SELECT revision FROM conversations').first()).revision,2);await deliver('second@example.com',`inbound+${c.id}@example.com`,'Reply email');assert.equal((await DB.prepare('SELECT revision FROM conversations').first()).revision,2);await deliver('html@example.com',`inbound+${c.id}@example.com`,'<p>HTML <b>reply</b></p><script>secret()</script>');assert.match((await DB.prepare('SELECT content FROM messages ORDER BY revision DESC LIMIT 1').first()).content,/HTML reply/);assert.ok(!(await DB.prepare('SELECT content FROM messages ORDER BY revision DESC LIMIT 1').first()).content.includes('secret()'));await deliver('only-file@example.com',`inbound+${c.id}@example.com`,'',true);assert.equal((await DB.prepare('SELECT content FROM messages ORDER BY revision DESC LIMIT 1').first()).content,'');assert.ok((await DB.prepare('SELECT m.id FROM media a JOIN messages m ON m.id=a.message_id ORDER BY m.revision DESC LIMIT 1').first()).id);console.log('Native Email Worker: MIME attachment R2/D1 admission, reply-address conversation continuity, duplicate delivery coalescing passed')}finally{await proxy.dispose()}

// Automatic mail (out-of-office, list, bounce) on the Worker and JSON gateway paths:
// admitted and labelled, but never answered by AI, notified or emailed onward.
{
 // message-effects imports module directories through their index.
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'/index.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
 const proxy=await notificationRuntime(),originalFetch=globalThis.fetch
 const {applyMessageEffects}=await import('../src/message-effects.ts')
 const {dispatchOperatorNotifications}=await import('../src/modules/integrations/notifications.ts')
 const {inboundEmail}=await import('../src/modules/integrations/inbound.ts')
 const {routes:conversationRoutes}=await import('../src/modules/conversations/routes.ts')
 const {bucketData}=await import('../src/modules/management/buckets.ts')
 const {dashboardActions}=await import('../src/modules/management/dashboard-actions.ts')
 const {hashToken}=await import('../src/platform/auth.ts')
 try{
  const jobs=[],outbound=[],pending=[],execution={waitUntil:promise=>pending.push(promise),passThroughOnException(){}}
  const env={...proxy.env,APP_ORIGIN:'https://app.example',OPENAI_API_KEY:'fixture-openai',EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'fixture-resend',EMAIL_FROM:'support@example.com',INBOUND_EMAIL_TOKEN:'fixture-gateway',JOBS:{send:async job=>{jobs.push(job)}}},DB=env.DB
  const flushAlerts=()=>dispatchOperatorNotifications(env,{now:Date.now()+61000})
  globalThis.fetch=async(url,init)=>{outbound.push({url:String(url),body:JSON.parse(String(init.body))});return Response.json({id:`resend-${outbound.length}`})}
  for(const file of ['0001_identity.sql','0002_conversations.sql','0003_identity_credentials.sql','0004_message_intent.sql','0005_widget_identity.sql','0007_conversation_history.sql','0070_management.sql','0071_management_preferences.sql','0080_integrations.sql','123_operator_notifications.sql','0100_inbound_email_claims.sql','0102_public_abuse_limits.sql','0104_inbound_email_classification.sql','0050_knowledge.sql','0060_customer_context.sql','0060_customer_context_engine.sql','020_ai_support.sql','0110_move_in.sql','111_move_in_identity_audit.sql','112_conversation_outcomes.sql','122_email_content.sql','123_email_reply_grants.sql'])for(const sql of migrationStatements(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))await DB.prepare(sql).run()
  await DB.batch([
   DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)"),
   DB.prepare("INSERT INTO email_settings VALUES('p','Support','support@example.com','inbound@example.com',1,1)"),
   DB.prepare("INSERT INTO users VALUES('op','op@example.com','Operator',1)"),
   DB.prepare("INSERT INTO memberships VALUES('p','op','operator')"),
   DB.prepare("INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES('ai','p','Assistant','Support','Answer customers.','gpt-5-mini',1)"),
   DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('customer','p','customer@example.com',1)"),
   // A widget conversation the AI answers, and one an operator owns. Their reply
   // addresses (inbound+<conversationId>@) are where autoresponders write back.
   DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('widget','p','customer',1,1)"),
   DB.prepare("INSERT INTO conversation_ai VALUES('widget','ai')"),
   DB.prepare("INSERT INTO conversations(id,project_id,contact_id,assigned_to,created_at,updated_at) VALUES('assigned','p','customer','op',1,1)"),
  ])
  const deliver=async({id,to,envelopeTo,from='customer@example.com',headerFrom='Customer <customer@example.com>',subject='Question about my order',headers='',text='Hello'})=>{
   let rejected;if(from&&from!=='<>')to=await protectedAddress(env,to,from);const raw=`From: ${headerFrom}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: <${id}>\r\n${headers}MIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\n${text}`
   await handleEmail({from,to:envelopeTo||to,rawSize:raw.length,raw:new Response(raw).body,setReject:reason=>{rejected=reason}},env,execution);await Promise.all(pending.splice(0))
   return rejected
  }
  // The Worker keeps the Message-ID as parsed, angle brackets included.
  const claim=async id=>DB.prepare('SELECT * FROM inbound_emails WHERE id IN (?,?)').bind(id,`<${id}>`).first()
  const admitted=async id=>DB.prepare('SELECT * FROM messages WHERE id=?').bind((await claim(id)).message_id).first()
  // The scheduler's outbox replay: the same actor reconstruction as src/jobs.ts.
  const replay=async message=>applyMessageEffects(env,message,{id:String(message.actor_id),projectId:'p',role:'contact',contactId:String(message.actor_id)})
  const count=async sql=>(await DB.prepare(sql).first()).n

  // Out-of-office to the AI-answered conversation: no generation, on first delivery or replay.
  assert.equal(await deliver({id:'ooo@example.com',to:'inbound+widget@example.com',subject:'Automatic reply: Question about my order',headers:'Auto-Submitted: auto-replied\r\nX-Auto-Response-Suppress: All\r\n',text:'I am out of the office until Monday.'}),undefined)
  const ooo=await claim('ooo@example.com'),oooMessage=await admitted('ooo@example.com')
  assert.equal(ooo.state,'delivered');assert.equal(ooo.automatic,1);assert.equal(oooMessage.conversation_id,'widget')
  assert.deepEqual(JSON.parse(ooo.evidence_json).reasons,['auto-submitted','x-auto-response-suppress','subject'])
  assert.equal(JSON.parse(ooo.evidence_json).headers['auto-submitted'],'auto-replied')
  assert.equal(await count('SELECT count(*) n FROM ai_generations'),0);assert.equal(jobs.length,0)
  await replay(oooMessage)
  assert.equal(await count('SELECT count(*) n FROM ai_generations'),0);assert.equal(jobs.length,0)
  assert.equal(await count('SELECT count(*) n FROM email_deliveries'),0);assert.equal(outbound.length,0)

  // List mail and an autoresponder subject to the operator-owned conversation: no notification.
  await deliver({id:'list@example.com',to:'inbound+assigned@example.com',subject:'Weekly product news',headers:'List-Id: <news.example.com>\r\nPrecedence: bulk\r\n'})
  await deliver({id:'away@example.com',to:'inbound+assigned@example.com',subject:'Out of Office: Re: Question about my order'})
  for(const id of ['list@example.com','away@example.com']){assert.equal((await claim(id)).automatic,1,id);await replay(await admitted(id))}
  assert.deepEqual(JSON.parse((await claim('list@example.com')).evidence_json).reasons,['precedence','list-id'])
  assert.deepEqual(JSON.parse((await claim('away@example.com')).evidence_json).reasons,['subject'])
  assert.equal(await count('SELECT count(*) n FROM email_deliveries'),0);assert.equal(outbound.length,0)

  // A mailer-daemon bounce opens its own conversation, which is also quiet.
  await deliver({id:'bounce@example.com',to:'inbound@example.com',from:'mailer-daemon@mx.example.net',headerFrom:'Mail Delivery System <MAILER-DAEMON@mx.example.net>',subject:'Undeliverable: Reply to your support conversation'})
  assert.deepEqual(JSON.parse((await claim('bounce@example.com')).evidence_json).reasons,['mailer-daemon','subject'])
  await replay(await admitted('bounce@example.com'))
  assert.equal(await count('SELECT count(*) n FROM ai_generations'),0);assert.equal(outbound.length,0)

  // A null envelope sender (delivery reports, auto-replies) is admitted under its
  // unverified header From, and stays quiet.
  for(const from of ['','<>']){
   assert.equal(await deliver({id:`null-${from.length}@example.com`,to:'inbound@example.com',from,headerFrom:'victim@example.org',subject:'Delivery Status Notification (Failure)'}),undefined)
   assert.deepEqual(JSON.parse((await claim(`null-${from.length}@example.com`)).evidence_json).reasons,['subject','null-sender'])
   await replay(await admitted(`null-${from.length}@example.com`))
  }
  assert.equal(outbound.length,0)

  // Ordinary customer mail still earns an AI reply and an operator notification.
  await deliver({id:'customer-widget@example.com',to:'inbound+widget@example.com',subject:'Re: Question about my order',text:'Is it shipping today?'})
  const customerMessage=await admitted('customer-widget@example.com')
  assert.equal((await claim('customer-widget@example.com')).automatic,0)
  const generation=await DB.prepare('SELECT * FROM ai_generations WHERE id=?').bind(`reply:${customerMessage.id}`).first()
  assert.equal(generation?.state,'queued');assert.deepEqual(jobs,[{type:'ai.generate',id:`reply:${customerMessage.id}`,projectId:'p'}])
  await deliver({id:'customer-assigned@example.com',to:'inbound+assigned@example.com',subject:'Re: Question about my order',text:'Any update?'})
  await replay(await admitted('customer-assigned@example.com'))
  assert.equal(outbound.length,0)
  await flushAlerts()
  assert.equal(outbound.length,1);assert.equal(outbound[0].url,'https://api.resend.com/emails');assert.deepEqual(outbound[0].body.to,['op@example.com'])
  assert.deepEqual(outbound[0].body.headers,{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'})

  // JSON gateway: supplied headers, subject and an empty envelope are classification evidence.
  const gateway=body=>inboundEmail.request('/email/inbound',{method:'POST',headers:{Authorization:'Bearer fixture-gateway','Content-Type':'application/json'},body:JSON.stringify(body)},env,execution)
  const gatewayAway=await gateway({messageId:'gateway-away',to:'inbound+assigned@example.com',from:'customer@example.com',text:'Away until Monday',subject:'Automatic reply: Any update?',headers:{'Auto-Submitted':'auto-replied'}})
  assert.equal(gatewayAway.status,201);assert.equal((await gatewayAway.json()).automatic,true)
  const gatewayBounce=await gateway({messageId:'gateway-bounce',to:'inbound+assigned@example.com',from:'customer@example.com',envelopeFrom:'',text:'Delivery failed'})
  assert.equal((await gatewayBounce.json()).automatic,true);assert.deepEqual(JSON.parse((await claim('gateway-bounce')).evidence_json).reasons,['null-sender'])
  const gatewayCustomer=await gateway({messageId:'gateway-customer',to:'inbound+assigned@example.com',from:'customer@example.com',text:'Thanks',subject:'Re: Any update?',headers:{'Auto-Submitted':'no'}})
  assert.equal((await gatewayCustomer.json()).automatic,false)
  for(const id of ['gateway-away','gateway-bounce'])await replay(await admitted(id))
  assert.equal(outbound.length,1)
  await replay(await admitted('gateway-customer'))
  assert.equal(outbound.length,1)
  await flushAlerts()
  assert.equal(outbound.length,2)

  // Operators see why: the transcript API and the dashboard bucket carry message.origin.
  await DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,'op','p','operator',NULL,?)").bind(await hashToken('operator-token'),Date.now()+60000).run()
  const authorization={Authorization:'Bearer operator-token'}
  const transcript=await (await conversationRoutes.request('/widget/messages',{headers:authorization},env,execution)).json()
  assert.deepEqual(transcript.messages.find(message=>message.id===oooMessage.id).origin,{channel:'email',automatic:true,reasons:['auto-submitted','x-auto-response-suppress','subject'],verified:false})
  assert.deepEqual(transcript.messages.find(message=>message.id===customerMessage.id).origin,{channel:'email',automatic:false,reasons:[],verified:false})
  // The original email body is operator-only; the customer's own session never receives it.
  await DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,'customer','p','contact','customer',?)").bind(await hashToken('customer-token'),Date.now()+60000).run()
  const bucket=await bucketData(env,await DB.prepare("SELECT * FROM conversations WHERE id='widget'").first(),'widget')
  assert.equal(bucket.messages.find(message=>message.id===oooMessage.id).origin.automatic,true)
  assert.equal(bucket.messages.find(message=>message.id===customerMessage.id).origin.automatic,false)
  // `email:` local ids belong to inbound claims; the message route refuses them.
  const revision=(await DB.prepare("SELECT revision FROM conversations WHERE id='widget'").first()).revision
  const forged=await conversationRoutes.request('/widget/messages',{method:'POST',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({localId:'email:forged',content:'Forged',expectedRevision:revision})},env,execution)
  assert.equal(forged.status,400);assert.equal((await DB.prepare("SELECT revision FROM conversations WHERE id='widget'").first()).revision,revision)
  const operatorReply=await conversationRoutes.request('/widget/messages',{method:'POST',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({localId:'operator-reply-1',content:'We are on it.',expectedRevision:revision})},env,execution)
  assert.equal(operatorReply.status,200)
  await Promise.all(pending.splice(0))
  // The operator digest is independent of assignment preferences, coalesces a
  // burst, and skips the recipient's read frontier at dispatch time.
  const unreadMail=async(messageId,text)=>{await gateway({messageId,to:'inbound+assigned@example.com',from:'customer@example.com',text});await replay(await admitted(messageId))}
  await DB.prepare("INSERT INTO user_settings(user_id,is_notifiable_on_conversation_assignment) VALUES('op',0)").run()
  await unreadMail('digest-first','First unread question')
  await unreadMail('digest-second','Second unread question')
  const firstDigest=await admitted('digest-first'),secondDigest=await admitted('digest-second'),beforeDigest=outbound.length
  await dispatchOperatorNotifications(env)
  assert.equal(outbound.length,beforeDigest)
  await DB.prepare("INSERT INTO conversation_reads VALUES('assigned','op',?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET revision=excluded.revision").bind(firstDigest.revision).run()
  await flushAlerts()
  assert.equal(outbound.length,beforeDigest+1)
  assert.match(outbound.at(-1).body.text,/Second unread question/)
  assert.equal(outbound.at(-1).body.text.split('Unread customer messages:')[1].includes('First unread question'),false)
  assert.match(outbound.at(-1).body.text,/Previous context:/)
  await replay(secondDigest);await flushAlerts()
  assert.equal(outbound.length,beforeDigest+1)
  await unreadMail('already-read','Read before email')
  await DB.prepare("UPDATE conversation_reads SET revision=? WHERE conversation_id='assigned' AND user_id='op'").bind((await admitted('already-read')).revision).run()
  await flushAlerts();assert.equal(outbound.length,beforeDigest+1)

  // Unassigned mail reaches opted-in members only, with an individual read
  // frontier, and no cross-workspace recipient leakage.
  await DB.batch([
   DB.prepare("INSERT INTO users VALUES('watcher','watcher@example.com','Watcher',1)"),
   DB.prepare("INSERT INTO users VALUES('quiet','quiet@example.com','Quiet',1)"),
   DB.prepare("INSERT INTO users VALUES('outsider','outsider@example.com','Outsider',1)"),
   DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('other','Other','other-key','https://other.example',1)"),
   DB.prepare("INSERT INTO memberships VALUES('p','watcher','operator')"),
   DB.prepare("INSERT INTO memberships VALUES('p','quiet','operator')"),
   DB.prepare("INSERT INTO memberships VALUES('other','outsider','owner')"),
   DB.prepare("INSERT INTO user_project_preferences(project_id,user_id,is_notified_on_unassigned_activity) VALUES('p','op',1),('p','watcher',1),('other','outsider',1)"),
   DB.prepare("UPDATE conversations SET assigned_to=NULL WHERE id='assigned'")
  ])
  await unreadMail('unassigned-burst-1','Unassigned first')
  await unreadMail('unassigned-burst-2','Unassigned second')
  await DB.prepare("UPDATE conversation_reads SET revision=? WHERE conversation_id='assigned' AND user_id='op'").bind((await admitted('unassigned-burst-2')).revision).run()
  const beforeUnassigned=outbound.length
  await Promise.all([flushAlerts(),flushAlerts()])
  assert.equal(outbound.length,beforeUnassigned+1)
  assert.deepEqual(outbound.at(-1).body.to,['watcher@example.com'])
  assert.match(outbound.at(-1).body.text,/Unassigned first/);assert.match(outbound.at(-1).body.text,/Unassigned second/)

  // A lost provider response is recorded once; outbox and scheduler replay never
  // send it again. A later read or preference edit cannot alter that identity.
  await DB.prepare("UPDATE user_project_preferences SET is_notified_on_unassigned_activity=0 WHERE user_id='op'").run()
  await unreadMail('uncertain-alert','A lost response')
  let attempts=0
  globalThis.fetch=async()=>{attempts++;throw new Error('response lost')}
  await flushAlerts()
  const uncertain=await DB.prepare("SELECT * FROM email_deliveries WHERE state='uncertain'").first()
  assert.equal(attempts,1);assert.equal(uncertain.recipient,'watcher@example.com')
  await replay(await admitted('uncertain-alert'));await flushAlerts()
  assert.equal(attempts,1)
  // The real operator mutation creates assignment-mail intent in the same
  // transaction as ownership. Same-owner writes and self assignment stay quiet.
  globalThis.fetch=async(url,init)=>{outbound.push({url:String(url),body:JSON.parse(String(init.body))});return Response.json({id:`resend-${outbound.length}`})}
  const assign=async(agent_id,requestEnv=env)=>{
   const response=await dashboardActions.request('/projects/p/conversations/assigned',{method:'PUT',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({agent_id})},requestEnv,execution)
   assert.equal(response.status,200,await response.text())
  }
  const beforeAssignment=outbound.length
  await assign('watcher')
  assert.equal(outbound.length,beforeAssignment+1);assert.deepEqual(outbound.at(-1).body.to,['watcher@example.com']);assert.ok(outbound.at(-1).body.text.includes('https://app.example/projects/p/conversations/assigned'))
  await assign('watcher');await assign('op')
  assert.equal(outbound.length,beforeAssignment+1)
  await DB.prepare("INSERT INTO user_settings(user_id,is_notifiable_on_conversation_assignment) VALUES('watcher',0)").run()
  await assign('watcher')
  assert.equal(outbound.length,beforeAssignment+1)
  await assign('quiet',{...env,EMAIL_API_KEY:undefined})
  assert.equal(outbound.length,beforeAssignment+1)
  await dispatchOperatorNotifications(env)
  assert.equal(outbound.length,beforeAssignment+2);assert.deepEqual(outbound.at(-1).body.to,['quiet@example.com'])
  await dispatchOperatorNotifications(env)
  assert.equal(outbound.length,beforeAssignment+2)
  console.log('Assignment email: real operator mutation, changed nonself ownership, preference off, same/self suppression and durable scheduled recovery passed')
  console.log('Operator unread mail: inactivity, coalescing, recipient read frontiers, assignment preference independence, opt-in unassigned scope, concurrent recovery and no uncertain replay passed')
  // Customer mail retains a readable visible reply and the original body. CC is
  // admitted with the message, scoped to this workspace, and is replay-safe.
  const rawReply='The export now works.\n\n-- \nMaya Chen\n\nOn Fri, 16 Oct 2026 Support wrote:\n> Can you retry?'
  const ccInput={messageId:'people-cc',to:'inbound+assigned@example.com',from:'customer@example.com',text:rawReply,cc:['finance@example.com','op@example.com','customer@example.com']}
  const ccResponse=await gateway(ccInput);assert.equal(ccResponse.status,201)
  const ccBody=await ccResponse.json(),ccMessage=await admitted('people-cc')
  assert.equal(ccMessage.content,'The export now works.');assert.equal(ccMessage.content_raw,rawReply)
  const participant=await DB.prepare("SELECT ct.id FROM contacts ct JOIN conversation_participants cp ON cp.contact_id=ct.id WHERE cp.conversation_id='assigned' AND ct.project_id='p' AND ct.email='finance@example.com'").first()
  assert.ok(participant)
  assert.equal((await gateway(ccInput)).status,200)
  assert.equal((await gateway({...ccInput,cc:['outsider@example.com']})).status,409)
  const reply=await gateway({messageId:'participant-reply',to:'inbound+assigned@example.com',from:'finance@example.com',text:'I can confirm the report totals.'})
  assert.equal(reply.status,201);assert.equal((await admitted('participant-reply')).actor_id,participant.id)
  // Somebody outside a thread who writes to its address starts their own conversation.
  const outside=async(response,id)=>{assert.equal(response.status,201);assert.notEqual((await admitted(id)).conversation_id,'assigned')}
  await outside(await gateway({messageId:'forged-person',to:'inbound+assigned@example.com',from:'unrelated@example.com',text:'Pretend to be the customer',cc:['hijack@example.com']}),'forged-person')
  assert.equal(await DB.prepare("SELECT cp.id FROM conversation_participants cp JOIN contacts ct ON ct.id=cp.contact_id WHERE cp.conversation_id='assigned' AND ct.email='hijack@example.com'").first(),null)
  await DB.prepare("DELETE FROM conversation_participants WHERE conversation_id='assigned' AND contact_id=?").bind(participant.id).run()
  await outside(await gateway({messageId:'removed-person',to:'inbound+assigned@example.com',from:'finance@example.com',text:'No longer a participant'}),'removed-person')
  const customerView=await (await conversationRoutes.request('/assigned/messages',{headers:{Authorization:'Bearer customer-token'}},env,execution)).json()
  assert.ok(customerView.messages.length>1&&customerView.messages.every(message=>!('content_raw' in message)))
  assert.equal((await (await conversationRoutes.request('/assigned/messages',{headers:authorization},env,execution)).json()).messages.find(message=>message.id===ccMessage.id).content_raw,rawReply)
  assert.equal(await deliver({id:'worker-operator@example.com',to:'inbound+assigned@example.com',from:'op@example.com',headerFrom:'Operator <op@example.com>',text:'Reply from the operator mail client'}),undefined)
  assert.equal((await admitted('worker-operator@example.com')).actor_id,'op')
  const operatorAddress=await recipientReplyAddress(env,'inbound@example.com','p','assigned','op@example.com')
  assert.equal(await deliver({id:'stolen-address@example.com',to:operatorAddress,from:'forged@example.com',headerFrom:'forged@example.com',text:'Forged sender with somebody else’s reply address'}),undefined)
  assert.notEqual((await admitted('stolen-address@example.com')).conversation_id,'assigned')
  const operator=await gateway({messageId:'operator-email',to:'inbound+assigned@example.com',from:'op@example.com',text:'Your export is ready.\n\nOn Fri, 16 Oct 2026 Maya wrote:\n> Please help'})
  assert.equal(operator.status,201);assert.equal((await admitted('operator-email')).actor_role,'operator');assert.equal((await admitted('operator-email')).actor_id,'op')
  await DB.prepare("DELETE FROM memberships WHERE project_id='p' AND user_id='op'").run()
  assert.equal(await deliver({id:'revoked-worker@example.com',to:operatorAddress,from:'op@example.com',headerFrom:'Operator <op@example.com>',text:'Reply after leaving the workspace'}),undefined)
  assert.equal((await admitted('revoked-worker@example.com')).actor_role,'contact')
  await outside(await gateway({messageId:'revoked-operator',to:'inbound+assigned@example.com',from:'op@example.com',text:'Revoked reply'}),'revoked-operator')
  await DB.prepare("INSERT INTO memberships VALUES('p','op','operator')").run()
  // A preferred notification address replies as the customer only through its own
  // reply address; elsewhere it is a separate sender.
  await DB.prepare("UPDATE contacts SET is_verified=1,metadata_json=json_set(metadata_json,'$.provided_email','preferred@example.com') WHERE id='customer'").run()
  await outside(await gateway({messageId:'preferred-forgery',to:'inbound+assigned@example.com',from:'preferred@example.com',text:'Not canonical identity'}),'preferred-forgery')
  assert.equal(await deliver({id:'preferred-reply@example.com',to:await recipientReplyAddress(env,'inbound@example.com','p','assigned','preferred@example.com'),from:'preferred@example.com',headerFrom:'preferred@example.com',text:'Replying from my preferred address'}),undefined)
  assert.deepEqual([(await admitted('preferred-reply@example.com')).conversation_id,(await admitted('preferred-reply@example.com')).actor_id],['assigned','customer'])
  // Bare mailbox follows the most recently active open thread and starts afresh
  // after resolution.
  const bare=async id=>gateway({messageId:id,to:'inbound@example.com',from:'new-customer@example.com',text:'Question about the account'})
  const firstBare=await (await bare('bare-first')).json(),secondBare=await (await bare('bare-second')).json()
  assert.equal(secondBare.conversationId,firstBare.conversationId)
  await DB.prepare('UPDATE conversations SET resolved_at=? WHERE id=?').bind(Date.now(),firstBare.conversationId).run()
  const nextBare=await (await bare('bare-after-close')).json();assert.notEqual(nextBare.conversationId,firstBare.conversationId)
  await DB.prepare('UPDATE conversations SET resolved_at=NULL WHERE id=?').bind(firstBare.conversationId).run()
  assert.equal((await (await bare('bare-two-open')).json()).conversationId,nextBare.conversationId)
  // Ordinary Worker mail is never bounced. The contact is the header From (a VERP or
  // forwarding SRS envelope is delivery metadata); only Cloudflare's own topmost
  // verdict verifies it, and only a verified sender's CC recipients join the thread.
  const verdict=(domain,result='pass')=>`Authentication-Results: mx.cloudflare.net; dkim=${result} header.d=${domain} header.s=s1; dmarc=${result} header.from=${domain}\r\n`
  const forwardedCc='Delivered-To: support@company.example\r\nCc: Colleague <colleague@customer.example>, support@company.example, inbound@example.com\r\n'
  const people=async id=>{const message=await admitted(id);return {contact:(await DB.prepare('SELECT email FROM contacts WHERE id=?').bind(message.actor_id).first()).email,verified:JSON.parse((await claim(id)).evidence_json).sender_verified,participants:(await DB.prepare('SELECT ct.email FROM conversation_participants cp JOIN contacts ct ON ct.id=cp.contact_id WHERE cp.conversation_id=?').bind(message.conversation_id).all()).results.map(row=>row.email)}}
  const forwarded=(id,headerFrom,headers)=>deliver({id,to:'support@company.example',envelopeTo:'inbound@example.com',from:`SRS0=x1=AB=customer.example=${id}@company.example`,headerFrom,headers})
  assert.equal(await forwarded('first-cc','Ana <ana@customer.example>',forwardedCc),undefined)
  assert.deepEqual(await people('first-cc'),{contact:'ana@customer.example',verified:false,participants:[]})
  assert.equal(await forwarded('signed-cc','Ben <ben@customer.example>',verdict('customer.example')+forwardedCc),undefined)
  assert.deepEqual(await people('signed-cc'),{contact:'ben@customer.example',verified:true,participants:['colleague@customer.example']})
  assert.equal(await forwarded('forged-verdict','Cy <cy@customer.example>',verdict('customer.example','fail')+verdict('customer.example')+forwardedCc),undefined)
  assert.deepEqual(await people('forged-verdict'),{contact:'cy@customer.example',verified:false,participants:[]})
  // A widget-verified customer: signed mail continues their thread, and its Reply-To
  // never replaces the preference they chose.
  await DB.prepare("INSERT INTO contacts(id,project_id,email,is_verified,metadata_json,created_at) VALUES('signed-in','p','dana@customer.example',1,'{\"provided_email\":\"dana-home@customer.example\"}',1)").run()
  const dana=(id,headers)=>deliver({id,to:'inbound@example.com',from:'dana@customer.example',headerFrom:'Dana <dana@customer.example>',headers:headers+'Reply-To: attacker@attacker.example\r\n'})
  assert.equal(await dana('verified-first',verdict('customer.example')),undefined)
  const danaThread=(await admitted('verified-first')).conversation_id
  assert.equal((await admitted('verified-first')).actor_id,'signed-in')
  // Mail that may forge her From never writes as her: the gate's injections into
  // Cloudflare's own verdict, an honest fail and no verdict at all each land in one
  // separate conversation flagged as an unverified sender.
  const cloudflare=results=>`Authentication-Results: mx.cloudflare.net; ${results}\r\n`
  const forgeries={
   'quoted-mail-from':cloudflare('dkim=none; spf=pass smtp.mailfrom="x;dkim=pass header.d=customer.example z"@attacker.example; dmarc=fail header.from=customer.example'),
   'spf-comment':cloudflare('dkim=none (no signatures found); spf=pass (mx.cloudflare.net: domain of "a);dkim=pass header.d=customer.example (b"@attacker.example designates 192.0.2.1 as permitted sender) smtp.mailfrom=attacker.example; dmarc=fail header.from=customer.example'),
   'helo-semicolon':cloudflare('dkim=none; spf=none smtp.helo=evil;dmarc=pass header.from=customer.example; spf=pass smtp.mailfrom=attacker.example'),
   'honest-fail':cloudflare('dkim=fail header.d=customer.example; spf=fail smtp.mailfrom=attacker.example; dmarc=fail header.from=customer.example'),
   'unsigned':'',
  }
  for(const [id,header] of Object.entries(forgeries))assert.equal(await dana(id,header),undefined,id)
  const isolated=await Promise.all(Object.keys(forgeries).map(async id=>({...await people(id),conversation:(await admitted(id)).conversation_id})))
  assert.deepEqual(new Set(isolated.map(row=>JSON.stringify([row.verified,row.participants,row.conversation===danaThread]))),new Set([JSON.stringify([false,[],false])]))
  assert.equal(new Set(isolated.map(row=>row.conversation)).size,1)
  const impostor=await DB.prepare('SELECT ct.email,ct.metadata_json FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=?').bind(isolated[0].conversation).first()
  assert.deepEqual([impostor.email,JSON.parse(impostor.metadata_json)],['dana@customer.example',{unverified_sender:1}])
  assert.equal((await DB.prepare("SELECT json_extract(metadata_json,'$.provided_email') p FROM contacts WHERE id='signed-in'").first()).p,'dana-home@customer.example')
  // An operator's reply there goes only to the unverified From address.
  const isolatedHead=await DB.prepare('SELECT revision FROM conversations WHERE id=?').bind(isolated[0].conversation).first()
  assert.equal((await conversationRoutes.request(`/${isolated[0].conversation}/messages`,{method:'POST',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({localId:'isolated-reply',content:'Your refund code is 4417',expectedRevision:isolatedHead.revision})},env,execution)).status,200)
  await applyMessageEffects(env,await DB.prepare("SELECT * FROM messages WHERE local_id='isolated-reply'").first(),{id:'op',projectId:'p',role:'operator'})
  assert.deepEqual(outbound.filter(mail=>mail.body.text?.includes('4417')).map(mail=>mail.body.to),[['dana@customer.example']])
  // A reply-all to more than 50 addresses is routed, never refused.
  const crowd=[...Array.from({length:60},(_,index)=>`person${index}@crowd.example`),`${'x'.repeat(330)}@crowd.example`,'inbound@example.com'].join(', ')
  assert.equal(await deliver({id:'reply-all@example.com',to:crowd,envelopeTo:'inbound@example.com',from:'ana@customer.example',headerFrom:'ana@customer.example'}),undefined)
  assert.equal((await claim('reply-all@example.com')).state,'delivered')
  // A retry after an attempt that crashed mid-admission is never dropped: while the
  // claim may be live the sender is told to retry (thrown, not bounced); a stale
  // claim is reclaimed and the mail admitted exactly once.
  await DB.prepare("CREATE TRIGGER crash_admission BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'worker crashed'); END").run()
  const crashed=()=>deliver({id:'crashed@example.com',to:'inbound@example.com',from:'ana@customer.example',headerFrom:'ana@customer.example'})
  await assert.rejects(crashed(),/worker crashed/)
  await DB.prepare('DROP TRIGGER crash_admission').run()
  await DB.prepare("UPDATE inbound_emails SET state='processing' WHERE id='<crashed@example.com>'").run()
  await assert.rejects(crashed(),/already processing/)
  await DB.prepare("UPDATE inbound_emails SET created_at=created_at-180000 WHERE id='<crashed@example.com>'").run()
  assert.equal(await crashed(),undefined)
  assert.equal(await crashed(),undefined)
  assert.equal((await DB.prepare('SELECT count(*) n FROM messages WHERE local_id=?').bind((await claim('crashed@example.com')).local_id).first()).n,1)
  // Original body follows the same erasure custody as visible content.
  await DB.prepare("UPDATE messages SET content='' WHERE id=?").bind(ccMessage.id).run()
  assert.equal((await DB.prepare('SELECT content_raw FROM messages WHERE id=?').bind(ccMessage.id).first()).content_raw,null)
  console.log('Automatic inbound mail: Worker and gateway classification, no AI reply or notification on delivery and replay, null-envelope admission, loop-suppression headers, transcript and dashboard origin, reserved local ids passed')
 }finally{globalThis.fetch=originalFetch;await proxy.dispose()}
}
