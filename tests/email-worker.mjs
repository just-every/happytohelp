import {migrationStatements} from './helpers/migration-statements.mjs';
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {handleEmail}=await import('../src/modules/integrations/email-worker.ts'),{getPlatformProxy}=await import('wrangler'),proxy=await getPlatformProxy({persist:false})
try{const env={...proxy.env,OPENAI_API_KEY:undefined,EMAIL_API_KEY:undefined,CONVERSATIONS:{idFromName:id=>id,get:()=>({fetch:async()=>new Response('ok')})}},DB=env.DB;for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','0070_management.sql','0080_integrations.sql','0100_inbound_email_claims.sql','0104_inbound_email_classification.sql','112_conversation_outcomes.sql'])for(const sql of migrationStatements(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))await DB.prepare(sql).run();await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)").run();await DB.prepare("INSERT INTO email_settings VALUES('p','Support','support@example.com','inbound@example.com',1,1)").run();let rejected;const promises=[];const execution={waitUntil:p=>promises.push(p)};async function deliver(id,to,text,attachment=false){const raw=`From: Customer <customer@example.com>\r\nTo: ${to}\r\nMessage-ID: <${id}>\r\nMIME-Version: 1.0\r\n${attachment?'Content-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain\r\n\r\n'+text+'\r\n--b\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="example.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nYXR0YWNobWVudA==\r\n--b--':'Content-Type: '+(text.startsWith('<')?'text/html':'text/plain')+'\r\n\r\n'+text}`;return handleEmail({from:'customer@example.com',to,rawSize:raw.length,raw:new Response(raw).body,setReject:reason=>{rejected=reason}},env,execution)}await deliver('first@example.com','inbound@example.com','First email',true);await Promise.all(promises);assert.equal(rejected,undefined);const c=await DB.prepare('SELECT * FROM conversations').first();assert.equal(c.revision,1);assert.equal((await DB.prepare('SELECT * FROM media').first()).filename,'example.txt');await deliver('second@example.com',`inbound+${c.id}@example.com`,'Reply email');await Promise.all(promises);assert.equal((await DB.prepare('SELECT count(*) n FROM conversations').first()).n,1);assert.equal((await DB.prepare('SELECT revision FROM conversations').first()).revision,2);await deliver('second@example.com',`inbound+${c.id}@example.com`,'Reply email');assert.equal((await DB.prepare('SELECT revision FROM conversations').first()).revision,2);await deliver('html@example.com',`inbound+${c.id}@example.com`,'<p>HTML <b>reply</b></p><script>secret()</script>');assert.match((await DB.prepare('SELECT content FROM messages ORDER BY revision DESC LIMIT 1').first()).content,/HTML reply/);assert.ok(!(await DB.prepare('SELECT content FROM messages ORDER BY revision DESC LIMIT 1').first()).content.includes('secret()'));console.log('Native Email Worker: MIME attachment R2/D1 admission, reply-address conversation continuity, duplicate delivery coalescing passed')}finally{await proxy.dispose()}

// Automatic mail (out-of-office, list, bounce) on the Worker and JSON gateway paths:
// admitted and labelled, but never answered by AI, notified or emailed onward.
{
 // message-effects imports module directories through their index.
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'/index.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
 const proxy=await getPlatformProxy({persist:false}),originalFetch=globalThis.fetch
 const {applyMessageEffects}=await import('../src/message-effects.ts')
 const {inboundEmail}=await import('../src/modules/integrations/inbound.ts')
 const {routes:conversationRoutes}=await import('../src/modules/conversations/routes.ts')
 const {bucketData}=await import('../src/modules/management/buckets.ts')
 const {hashToken}=await import('../src/platform/auth.ts')
 try{
  const jobs=[],outbound=[],pending=[],execution={waitUntil:promise=>pending.push(promise),passThroughOnException(){}}
  const env={...proxy.env,OPENAI_API_KEY:'fixture-openai',EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'fixture-resend',EMAIL_FROM:'support@example.com',INBOUND_EMAIL_TOKEN:'fixture-gateway',JOBS:{send:async job=>{jobs.push(job)}},CONVERSATIONS:{idFromName:id=>id,get:()=>({fetch:async()=>new Response('ok')})}},DB=env.DB
  globalThis.fetch=async(url,init)=>{outbound.push({url:String(url),body:JSON.parse(String(init.body))});return Response.json({id:`resend-${outbound.length}`})}
  for(const file of ['0001_identity.sql','0002_conversations.sql','0003_identity_credentials.sql','0004_message_intent.sql','0005_widget_identity.sql','0007_conversation_history.sql','0070_management.sql','0080_integrations.sql','0100_inbound_email_claims.sql','0102_public_abuse_limits.sql','0104_inbound_email_classification.sql','0050_knowledge.sql','0060_customer_context.sql','0060_customer_context_engine.sql','020_ai_support.sql','0110_move_in.sql','111_move_in_identity_audit.sql','112_conversation_outcomes.sql'])for(const sql of migrationStatements(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))await DB.prepare(sql).run()
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
  const deliver=async({id,to,from='customer@example.com',headerFrom='Customer <customer@example.com>',subject='Question about my order',headers='',text='Hello'})=>{
   let rejected;const raw=`From: ${headerFrom}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: <${id}>\r\n${headers}MIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\n${text}`
   await handleEmail({from,to,rawSize:raw.length,raw:new Response(raw).body,setReject:reason=>{rejected=reason}},env,execution);await Promise.all(pending.splice(0))
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

  // A null envelope sender is refused; the header From never becomes a contact.
  for(const from of ['','<>'])assert.equal(await deliver({id:`null-${from.length}@example.com`,to:'inbound@example.com',from,headerFrom:'victim@example.org',subject:'Delivery Status Notification (Failure)'}),'Envelope sender required')
  assert.equal(await count("SELECT count(*) n FROM contacts WHERE email='victim@example.org'"),0)
  assert.equal(await count("SELECT count(*) n FROM inbound_emails WHERE id LIKE '%null-%'"),0)

  // Ordinary customer mail still earns an AI reply and an operator notification.
  await deliver({id:'customer-widget@example.com',to:'inbound+widget@example.com',subject:'Re: Question about my order',text:'Is it shipping today?'})
  const customerMessage=await admitted('customer-widget@example.com')
  assert.equal((await claim('customer-widget@example.com')).automatic,0)
  const generation=await DB.prepare('SELECT * FROM ai_generations WHERE id=?').bind(`reply:${customerMessage.id}`).first()
  assert.equal(generation?.state,'queued');assert.deepEqual(jobs,[{type:'ai.generate',id:`reply:${customerMessage.id}`,projectId:'p'}])
  await deliver({id:'customer-assigned@example.com',to:'inbound+assigned@example.com',subject:'Re: Question about my order',text:'Any update?'})
  await replay(await admitted('customer-assigned@example.com'))
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
  assert.equal(outbound.length,2)

  // Operators see why: the transcript API and the dashboard bucket carry message.origin.
  await DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,'op','p','operator',NULL,?)").bind(await hashToken('operator-token'),Date.now()+60000).run()
  const authorization={Authorization:'Bearer operator-token'}
  const transcript=await (await conversationRoutes.request('/widget/messages',{headers:authorization},env,execution)).json()
  assert.deepEqual(transcript.messages.find(message=>message.id===oooMessage.id).origin,{channel:'email',automatic:true,reasons:['auto-submitted','x-auto-response-suppress','subject']})
  assert.deepEqual(transcript.messages.find(message=>message.id===customerMessage.id).origin,{channel:'email',automatic:false,reasons:[]})
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
  console.log('Automatic inbound mail: Worker and gateway classification, no AI reply or notification on delivery and replay, null-envelope refusal, loop-suppression headers, transcript and dashboard origin, reserved local ids passed')
 }finally{globalThis.fetch=originalFetch;await proxy.dispose()}
}
