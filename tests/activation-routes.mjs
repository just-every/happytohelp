import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {seedWorkspace,sha} from './helpers/identity-db.mjs'
import {getPlatformProxy} from 'wrangler'
const {activation}=await import('../src/modules/management/activation.ts')
const {receiveEmail}=await import('../src/modules/integrations/inbound-service.ts')
const {widgetEvents}=await import('../src/modules/management/widget-events.ts')
const proxy=await getPlatformProxy({persist:false,envFiles:[]}),DB=proxy.env.DB
for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort()) {
 const source=(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')).replace(/^\s*--[^\n]*$/gm,'')
 for(const [,sql] of source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))if(sql.trim()!==';')await DB.prepare(sql).run()
}
const primary=await seedWorkspace(DB,'activation'),other=await seedWorkspace(DB,'other')
const base={...proxy.env,EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'fixture-email-key',EMAIL_FROM:'support@example.test',OPENAI_API_KEY:'fixture-model-key',INBOUND_EMAIL_TOKEN:'fixture-inbound-key',PREVIEW_ORIGIN:'https://preview.example'}
const path=`/projects/${primary.projectId}/activation`,origin='https://desk.example'
const call=(suffix='',{body,token=primary.tokens.owner,env=base}={})=>activation.request(origin+path+suffix,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)},env)
const snapshot=async(options)=>{const response=await call('',options);assert.equal(response.status,200,await response.clone().text());return(await response.json()).data}
const check=async(step,options={})=>{const response=await call('/check',{...options,body:step?{step}:{}});assert.equal(response.status,200,await response.clone().text());return(await response.json()).data.steps.find(row=>row.id===step)}
const step=(data,id)=>data.steps.find(row=>row.id===id)
let requests=[],sendCount=0,event='sent',modelStatus=200,dnsStatus='verified',statusMismatch=false,sendUncertain=false
const originalFetch=globalThis.fetch
globalThis.fetch=async(input,init={})=>{
 const url=String(input),method=init.method||'GET';requests.push({url,method})
 if(url==='https://api.openai.com/v1/models/gpt-5-mini')return Response.json(modelStatus===200?{id:'gpt-5-mini',object:'model'}:{error:'fixture'},{status:modelStatus})
 if(url==='https://api.resend.com/domains')return Response.json({data:[{id:'domain-1',name:'example.test'}],has_more:false})
 if(url==='https://api.resend.com/domains/domain-1')return Response.json({id:'domain-1',name:'example.test',status:dnsStatus,records:[{record:'SPF',status:dnsStatus},{record:'DKIM',status:dnsStatus}]})
 if(url==='https://api.resend.com/emails'&&method==='POST'){
  sendCount++;if(sendUncertain)throw new Error('Fixture connection lost after provider accepted')
  const body=JSON.parse(init.body);assert.deepEqual(body.to,['owner-activation@example.test']);assert.equal(body.headers['Auto-Submitted'],'auto-generated')
  return Response.json({id:'test-message-1'})
 }
 if(url==='https://api.resend.com/emails/test-message-1')return Response.json({id:'test-message-1',to:[statusMismatch?'someone@example.test':'owner-activation@example.test'],from:'support@example.test',last_event:event})
 throw new Error(`Unexpected provider request ${method} ${url}`)
}
test.after(async()=>{globalThis.fetch=originalFetch;await proxy.dispose()})

test('fresh checklist is zero of eight and GET has no provider effects',async()=>{
 const data=await snapshot();assert.equal(data.done,0);assert.equal(data.total,8);assert.equal(data.steps.length,8);assert.ok(data.steps.every(row=>row.state==='not_checked'));assert.equal(requests.length,0)
 const text=JSON.stringify(data);assert.ok(!text.includes('fixture-'));assert.ok(!text.includes('fingerprint'))
})
test('route rejects unauthenticated, non-admin, other tenant and user supplied done/recipient',async()=>{
 for(const token of ['',primary.tokens.operator,other.tokens.owner])for(const [suffix,body] of [['',undefined],['/check',{}],['/test-mail',{}]])assert.ok([401,403].includes((await call(suffix,{token,body})).status))
 assert.equal((await call('/check',{body:{step:'widget_origin',done:true}})).status,400)
 assert.equal((await call('/test-mail',{body:{to:'other@example.test'}})).status,400)
 assert.equal((await call('/test-mail',{token:primary.tokens.admin,body:{}})).status,403)
 assert.equal(requests.length,0)
})
test('explicit local checks persist, default ceilings disclose scope, changed origin invalidates receipts',async()=>{
 assert.equal((await check('widget_origin')).state,'done')
 const limits=await check('spend_ceilings');assert.equal(limits.state,'done');assert.match(limits.detail,/defaults/);assert.match(limits.detail,/2000 automatic replies\/installation/);assert.match(limits.detail,/00:00 UTC/)
 assert.equal((await snapshot()).done,2)
 assert.equal((await check('spend_ceilings',{env:{...base,AI_DAILY_CEILINGS:'{"spendUsdPerProject":-1}'}})).state,'failed')
 await DB.prepare('UPDATE projects SET allowed_origin=? WHERE id=?').bind('https://changed.example',primary.projectId).run()
 assert.equal(step(await snapshot(),'widget_origin').state,'unknown')
 await DB.prepare('UPDATE projects SET allowed_origin=? WHERE id=?').bind('https://activation.example',primary.projectId).run()
 assert.equal(step(await snapshot(),'widget_origin').state,'unknown','reverting config does not revive an invalidated observation')
 assert.equal((await check('widget_origin')).state,'done')
})
test('published article observes only current project publication and invalidates on unpublish',async()=>{
 const insert=(id,project,status)=>DB.prepare('INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,project,id,'Returns','Return instructions',status,Date.now()).run()
 await insert('foreign',other.projectId,'published');await insert('own',primary.projectId,'draft')
 assert.equal((await check('published_article')).state,'pending')
 await DB.prepare("UPDATE knowledge_articles SET status='published' WHERE id='own'").run()
 const article=await check('published_article');assert.equal(article.state,'done');assert.equal(article.receiptRef,'article:own');assert.match(article.detail,/require their own proof/)
 await DB.prepare("UPDATE knowledge_articles SET status='draft' WHERE id='own'").run()
 assert.equal(step(await snapshot(),'published_article').state,'unknown')
})
test('model presence does not complete validation; authenticated metadata, revoked key and stale receipts are distinguished',async()=>{
 await DB.prepare('INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES(?,?,?,?,?,?,?)').bind('assistant',primary.projectId,'Helper','Support','Help','gpt-5-mini',Date.now()).run()
 await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(primary.projectId,JSON.stringify({default_visitor_ai_id:'assistant'}),Date.now()).run()
 const missing=await check('model_key',{env:{...base,OPENAI_API_KEY:undefined}});assert.equal(missing.state,'unavailable');assert.match(missing.detail,/CONFIGURATION_REQUIRED: OPENAI_API_KEY/)
 assert.equal((await check('model_key')).state,'done')
 const before=requests.length;assert.equal(step(await snapshot(),'model_key').state,'done');assert.equal(requests.length,before)
 modelStatus=401;assert.equal((await check('model_key')).state,'failed');modelStatus=200
 assert.equal((await check('model_key')).state,'done')
 await DB.prepare("UPDATE activation_receipts SET checked_at=? WHERE project_id=? AND step_id='model_key'").bind(Date.now()-16*60*1000,primary.projectId).run()
 assert.equal(step(await snapshot(),'model_key').state,'unknown')
 assert.equal(step(await snapshot({env:{...base,OPENAI_API_KEY:undefined}}),'model_key').state,'unknown')
})
test('DNS requires current provider domain and every SPF/DKIM record',async()=>{
 assert.equal((await check('sender_dns')).state,'done');dnsStatus='failed';assert.equal((await check('sender_dns')).state,'failed');dnsStatus='pending';assert.equal((await check('sender_dns')).state,'pending');dnsStatus='verified'
})
test('test email is idempotent, queued is pending, wrong identity is unknown and delivered requires provider status',async()=>{
 assert.equal((await check('owner_mail')).state,'pending');assert.equal(sendCount,0)
 const send=await call('/test-mail',{body:{}});assert.equal(send.status,200);assert.equal(step((await send.json()).data,'owner_mail').state,'pending');assert.equal(sendCount,1)
 await call('/test-mail',{body:{}});assert.equal(sendCount,1)
 statusMismatch=true;event='delivered';assert.equal((await check('owner_mail')).state,'unknown');statusMismatch=false
 assert.equal((await check('owner_mail')).state,'done');assert.equal(step(await snapshot(),'owner_mail').state,'done')
 event='bounced';assert.equal((await check('owner_mail')).state,'failed')
 const before=sendCount;sendUncertain=true
 const env={...base,EMAIL_API_KEY:'rotated-fixture-key'}
 assert.equal(step((await(await call('/test-mail',{body:{},env})).json()).data,'owner_mail').state,'unknown')
 await call('/test-mail',{body:{},env});assert.equal(sendCount,before+1,'uncertain message never replayed');sendUncertain=false
})
test('inbound completion needs a delivered receipt captured under current enabled mailbox, not an address alone',async()=>{
 await DB.prepare('INSERT INTO email_settings VALUES(?,?,?,?,?,?)').bind(primary.projectId,'Support','support@example.test','inbound@example.test',1,100).run()
 assert.equal((await check('inbound_address')).state,'pending')
 await receiveEmail(base,{messageId:'inbound-1',to:'inbound@example.test',from:'visitor@example.test',text:'Plain text activation receipt',evidence:{envelope_from:'visitor@example.test',header_from:'visitor@example.test',subject:'Test',headers:{'auto-submitted':'auto-generated'}}})
 assert.equal((await check('inbound_address')).state,'done')
 await DB.prepare('UPDATE email_settings SET inbound_address=?,updated_at=101 WHERE project_id=?').bind('new@example.test',primary.projectId).run()
 assert.equal(step(await snapshot(),'inbound_address').state,'unknown');assert.equal((await check('inbound_address')).state,'pending')
 // Even a raced snapshot cannot reattribute an immutable old-address ingress intent.
 await DB.prepare("UPDATE activation_inbound_receipts SET address='new@example.test',settings_updated_at=101 WHERE inbound_id='inbound-1'").run()
 assert.equal((await check('inbound_address')).state,'pending')
})
test('widget instruction, wrong origin and owner preview do not count; only authenticated contact ping does',async()=>{
 await DB.prepare('INSERT INTO contacts(id,project_id,created_at) VALUES(?,?,?)').bind('contact',primary.projectId,Date.now()).run()
 await DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind('conversation',primary.projectId,'contact',Date.now(),Date.now()).run()
 await DB.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,?,?,?,?,?)').bind(sha('contact-token'),'contact',primary.projectId,'contact','contact',Date.now()+600000).run()
 const ping=(action,site='https://activation.example',token='contact-token')=>widgetEvents.request(origin+'/conversation/widget-events',{method:'POST',headers:{Authorization:`Bearer ${token}`,Origin:site,'Content-Type':'application/json'},body:JSON.stringify({action,data:{opened:true}})},base)
 assert.equal((await ping('instruction')).status,200);assert.equal((await check('widget_seen')).state,'pending')
 for(const site of ['https://wrong.example',base.PREVIEW_ORIGIN])assert.equal((await ping('pingActive',site)).status,200)
 assert.equal((await check('widget_seen')).state,'pending')
 assert.equal((await ping('pingActive','https://activation.example',primary.tokens.owner)).status,403)
 assert.equal((await ping('pingActive')).status,200);assert.equal((await check('widget_seen')).state,'done')
 await DB.prepare('UPDATE projects SET allowed_origin=? WHERE id=?').bind('https://new.example',primary.projectId).run()
 assert.equal(step(await snapshot(),'widget_seen').state,'unknown');assert.equal((await check('widget_seen')).state,'pending')
})
test('deleted project denies activation even if a membership was retained',async()=>{
 await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.deleted_at',1) WHERE project_id=?").bind(primary.projectId).run()
 assert.ok([401,403].includes((await call()).status))
})
