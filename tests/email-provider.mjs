import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {notifyMessage,dispatchOperatorNotifications}=await import('../src/modules/integrations/notifications.ts')
const {inboundTarget}=await import('../src/modules/integrations/inbound-routing.ts')
const {resolveReplyRecipient}=await import('../src/modules/integrations/email-reply-address.ts')
const {sendEmail}=await import('../src/modules/integrations/email.ts')
const {getPlatformProxy}=await import('wrangler'),proxy=await getPlatformProxy({persist:false}),originalFetch=globalThis.fetch
try{
 for(const file of ['0001_identity.sql','0002_conversations.sql','0005_widget_identity.sql','0070_management.sql','0071_management_preferences.sql','0080_integrations.sql','123_operator_notifications.sql','123_email_reply_grants.sql'])for(const sql of(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await proxy.env.DB.prepare(sql).run()
 const env={...proxy.env,EMAIL_API_KEY:'fixture',EMAIL_FROM:'test@example.com',INBOUND_EMAIL_TOKEN:'fixture-inbound'},input={to:'recipient@example.com',subject:'Test',text:'Body',idempotencyKey:'send-1'}
 let calls=0
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(init.headers['Idempotency-Key'],'send-1');return Response.json({id:'provider-1'})}
 assert.equal((await sendEmail(env,input)).state,'sent')
 assert.equal((await sendEmail(env,input)).state,'sent')
 assert.equal(calls,1)
 await assert.rejects(sendEmail(env,{...input,text:'Changed'}),/identity conflict/)
 globalThis.fetch=async()=>{calls++;throw new Error('lost response')}
 await assert.rejects(sendEmail(env,{...input,idempotencyKey:'send-2'}),/lost response/)
 await assert.rejects(sendEmail(env,{...input,idempotencyKey:'send-2'}),/uncertain/)
 assert.equal(calls,2)
 assert.equal((await env.DB.prepare("SELECT state FROM email_deliveries WHERE id='send-2'").first()).state,'uncertain')
 await env.DB.batch([
  env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1),('other','Other','other-w','https://other.example.com',1)"),
  env.DB.prepare("INSERT INTO users VALUES('operator','agent@example.com','Agent',1)"),
  env.DB.prepare("INSERT INTO memberships VALUES('p','operator','operator')"),
  env.DB.prepare("INSERT INTO contacts(id,project_id,email,is_verified,metadata_json,created_at) VALUES('contact','p','first@example.com',1,'{}',1),('participant','p','teammate@example.com',0,'{}',1),('foreign','other','foreign@example.com',0,'{}',1)"),
  env.DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('c','p','contact',1,1),('foreign-c','other','foreign',1,1)"),
  env.DB.prepare("INSERT INTO email_settings VALUES('p','Support','sender@example.com','inbound@example.com',1,1)"),
 ])
 const message={id:'message',conversation_id:'c',actor_role:'ai',content:'A reply'},actor={id:'contact',projectId:'p',contactId:'contact',role:'contact'}
 assert.equal((await notifyMessage(env,message,actor)).state,'uncertain')
 assert.equal(calls,3)
 await env.DB.batch([
  env.DB.prepare("UPDATE contacts SET email='changed@example.com',metadata_json='{\"provided_email\":\"preferred@example.com\"}' WHERE id='contact'"),
  env.DB.prepare("INSERT INTO conversation_participants VALUES('cp','c','participant',1),('invalid-tenant','c','foreign',1)"),
 ])
 const replay=await notifyMessage(env,message,actor)
 assert.equal(replay.state,'uncertain')
 assert.equal(replay.recipient,'first@example.com')
 assert.equal(calls,3)
 const content='**Resolved**\n\n- Try again\n\n[Guide](https://example.com/help)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))'
 const rich={...message,id:'rich',actor_role:'operator',actor_id:'operator',content}
 const png=Uint8Array.from([137,80,78,71,13,10,26,10]),pdf=new TextEncoder().encode('%PDF-fixture')
 await env.DB.batch([
  env.DB.prepare("INSERT INTO messages VALUES('rich','p','c','rich','operator','operator',?,1,1)").bind(content),
  env.DB.prepare("INSERT INTO messages VALUES('foreign-m','other','foreign-c','foreign-m','foreign','contact','private',1,1)"),
  env.DB.prepare("INSERT INTO media VALUES('image','p','c','operator','image-key','screenshot.png','image/png',?,'rich',1)").bind(png.length),
  env.DB.prepare("INSERT INTO media VALUES('file','p','c','operator','file-key','guide.pdf','application/pdf',?,'rich',2)").bind(pdf.length),
  // Even an invalid legacy row sharing a message ID cannot leak another tenant's file.
  env.DB.prepare("INSERT INTO media VALUES('foreign-file','other','foreign-c','foreign','foreign-key','private.txt','text/plain',7,'rich',1)"),
 ])
 await proxy.env.FILES.put('image-key',png)
 await proxy.env.FILES.put('file-key',pdf)
 await proxy.env.FILES.put('foreign-key','private')
 const requests=[]
 globalThis.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);requests.push({url,body});return Response.json({id:`provider-${calls}`})}
 const notified=await notifyMessage(env,rich,actor)
 assert.equal(notified.state,'sent')
 assert.deepEqual(requests.map(r=>r.body.to[0]).sort(),['preferred@example.com','teammate@example.com'])
 assert.equal((await env.DB.prepare("SELECT email,is_verified FROM contacts WHERE id='contact'").first()).email,'changed@example.com')
 assert.equal((await env.DB.prepare("SELECT is_verified FROM contacts WHERE id='contact'").first()).is_verified,1)
 for(const {body} of requests){
  assert.match(body.html,/<strong>Resolved<\/strong>/)
  assert.match(body.html,/<li>Try again<\/li>/)
  assert.match(body.html,/href="https:\/\/example.com\/help"/)
  assert.doesNotMatch(body.html,/<script>|href="javascript:/)
  assert.deepEqual(body.attachments.map(a=>a.filename),['screenshot.png','guide.pdf'])
  assert.equal(body.attachments[0].content,btoa(String.fromCharCode(...png)))
  assert.equal(body.attachments[0].content_type,'image/png')
  assert.match(body.html,new RegExp('src="cid:'+body.attachments[0].content_id+'"'))
  assert.equal(body.attachments[1].content,btoa(String.fromCharCode(...pdf)))
  assert.match(body.text,/Attachment: guide.pdf/)
 }
 const sentCalls=calls
 // Concurrent and interrupted replay retains the original complete recipient snapshot.
 await env.DB.prepare("UPDATE email_deliveries SET state='sending' WHERE recipient='teammate@example.com' AND id LIKE 'message:rich:%'").run()
 await env.DB.prepare("DELETE FROM conversation_participants WHERE id='cp'").run()
 const frozen=await notifyMessage(env,{...rich,content:'edited'},actor)
 assert.equal(frozen.state,'sending')
 assert.deepEqual(frozen.recipients.map(r=>r.recipient).sort(),['preferred@example.com','teammate@example.com'])
 assert.equal(calls,sentCalls)
 // Other customers receive the reply immediately; the assigned operator gets
 // unread activity after the conversation is quiet. Neither sends to its author.
 const customerTime=Date.now(),customerContent='**More detail**\n\n- Try this export\n\n[Guide](https://example.com/help)\n\n<script>customerPrivateScript()</script>'
 const customerMessage={id:'customer-message',conversation_id:'c',actor_role:'contact',actor_id:'participant',content:customerContent,revision:2,created_at:customerTime}
 await env.DB.batch([
  env.DB.prepare("INSERT INTO conversation_participants VALUES('cp2','c','participant',2)"),
  env.DB.prepare("INSERT INTO messages VALUES('customer-message','p','c','customer-message','participant','contact',?,2,?)").bind(customerContent,customerTime),
  env.DB.prepare("UPDATE conversations SET assigned_to='operator',revision=2,last_message_id='customer-message',updated_at=? WHERE id='c'").bind(customerTime),
  env.DB.prepare("INSERT INTO media VALUES('customer-image','p','c','participant','customer-image-key','customer.png','image/png',?,'customer-message',?)").bind(png.length,customerTime),
  env.DB.prepare("INSERT INTO media VALUES('customer-file','p','c','participant','customer-file-key','customer.pdf','application/pdf',?,'customer-message',?)").bind(pdf.length,customerTime+1),
 ])
 await env.FILES.put('customer-image-key',png)
 await env.FILES.put('customer-file-key',pdf)
 requests.length=0
 await notifyMessage(env,customerMessage,{...actor,id:'participant',contactId:'participant'})
 assert.deepEqual(requests.map(r=>r.body.to[0]),['preferred@example.com'])
 await dispatchOperatorNotifications(env,{now:customerTime})
 assert.deepEqual(requests.map(r=>r.body.to[0]),['preferred@example.com'])
 await dispatchOperatorNotifications(env,{now:customerTime+61000})
 assert.deepEqual(requests.map(r=>r.body.to[0]).sort(),['agent@example.com','preferred@example.com'])
 for(const {body} of requests){
  assert.match(body.html,/<strong>More detail<\/strong>/)
  assert.match(body.html,/<li>Try this export<\/li>/)
  assert.match(body.html,/href="https:\/\/example.com\/help"/)
  assert.doesNotMatch(body.html,/<script>/)
  assert.deepEqual(body.attachments.map(file=>file.filename),['customer.png','customer.pdf'])
  assert.equal(body.attachments[0].content,btoa(String.fromCharCode(...png)))
  assert.equal(body.attachments[1].content,btoa(String.fromCharCode(...pdf)))
  assert.match(body.html,new RegExp('src="cid:'+body.attachments[0].content_id+'"'))
  const target=inboundTarget(body.reply_to)
  assert.equal(target.mailbox,'inbound@example.com');assert.ok(target.replyToken)
  assert.equal((await resolveReplyRecipient(env,'p',target.replyToken,body.to[0])).conversation_id,'c')
  assert.equal(await resolveReplyRecipient(env,'p',target.replyToken,'teammate@example.com'),null)
 }
 const operatorMail=requests.find(request=>request.body.to[0]==='agent@example.com').body
 assert.match(operatorMail.html,/<h2>Unread customer messages:<\/h2>/)
 assert.match(operatorMail.text,/Unread customer messages:/)
 await dispatchOperatorNotifications(env,{now:customerTime+122000})
 assert.equal(requests.length,2)
 // A file-only response is useful mail, including the attachment bytes.
 const onlyFile={...rich,id:'file-only',content:''}
 await env.DB.batch([
  env.DB.prepare("INSERT INTO messages VALUES('file-only','p','c','file-only','operator','operator','',3,3)"),
  env.DB.prepare("INSERT INTO media VALUES('file-only-media','p','c','operator','file-only-key','result.txt','text/plain',4,'file-only',2)"),
 ])
 await proxy.env.FILES.put('file-only-key','done')
 requests.length=0
 await Promise.all([notifyMessage(env,onlyFile,actor),notifyMessage(env,onlyFile,actor)])
 assert.deepEqual(requests.map(r=>r.body.to[0]).sort(),['preferred@example.com','teammate@example.com'])
 assert.ok(requests.every(r=>r.body.text.includes('result.txt')&&r.body.attachments[0].content===btoa('done')))
 // Every configured provider transports the same inline image and file content.
 const attachmentInput={...input,idempotencyKey:'provider-rich',html:'<p>Body <img src="cid:shot" /></p>',attachments:[{filename:'shot.png',content:btoa('image'),contentType:'image/png',contentId:'shot'},{filename:'note.txt',content:btoa('note'),contentType:'text/plain'}]}
 for(const provider of ['resend','cloudflare','sendgrid']){
  let wire
  globalThis.fetch=async(url,init)=>{wire=JSON.parse(init.body);if(provider==='sendgrid')return new Response(null,{status:202,headers:{'X-Message-Id':'sg-rich'}});return Response.json(provider==='cloudflare'?{success:true,result:{queued:[input.to]}}:{id:'resend-rich'})}
  const deliveryInput={...attachmentInput,idempotencyKey:`provider-rich-${provider}`}
  assert.equal((await sendEmail({...env,EMAIL_PROVIDER:provider,EMAIL_ACCOUNT_ID:'a'.repeat(32)},deliveryInput)).state,'sent')
  const files=wire.attachments
  assert.equal(files[0].content_id,'shot')
  assert.equal(files[0].content,btoa('image'))
  assert.equal(files[1].content,btoa('note'))
  if(provider!=='resend')assert.equal(files[0].disposition,'inline')
  assert.equal(provider==='sendgrid'?wire.content.find(c=>c.type==='text/html').value:wire.html,attachmentInput.html)
  await assert.rejects(sendEmail({...env,EMAIL_PROVIDER:provider,EMAIL_ACCOUNT_ID:'a'.repeat(32)},{...deliveryInput,attachments:[{...attachmentInput.attachments[0],content:btoa('changed')}]}),/identity conflict/)
 }
 console.log('Email boundary fixtures passed: rich media, tenant scope, participants/preference, sender exclusion, frozen fanout, exact intent and uncertain no replay')
}finally{globalThis.fetch=originalFetch;await proxy.dispose()}
