import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {seedWorkspace,sha} from './helpers/identity-db.mjs'
import {getPlatformProxy} from 'wrangler'
const {activation}=await import('../src/modules/management/activation.ts')
const {receiveEmail}=await import('../src/modules/integrations/inbound-service.ts')
const {widgetEvents}=await import('../src/modules/management/widget-events.ts')
const {routes:identity}=await import('../src/modules/identity/routes.ts')
const {sendEmail}=await import('../src/modules/integrations/email.ts')
const {aiCeilings}=await import('../src/platform/limit-config.ts')
const {DEFAULT_WORKSPACE_COLOUR}=await import('../src/modules/management/workspace-colour.ts')
const proxy=await getPlatformProxy({persist:false,envFiles:[]}),DB=proxy.env.DB
for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort()) {
 const source=(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')).replace(/^\s*--[^\n]*$/gm,'')
 for(const [,sql] of source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))if(sql.trim()!==';')await DB.prepare(sql).run()
}
const primary=await seedWorkspace(DB,'activation'),other=await seedWorkspace(DB,'other')
const base={...proxy.env,EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'synthetic-fixture-email-key',EMAIL_FROM:'support@example.test',OPENAI_API_KEY:'synthetic-fixture-model-key',INBOUND_EMAIL_TOKEN:'synthetic-fixture-inbound-key',PREVIEW_ORIGIN:'https://preview.example'}
const path=`/projects/${primary.projectId}/activation`,origin='https://desk.example'
const call=(suffix='',{body,token=primary.tokens.owner,env=base}={})=>activation.request(origin+path+suffix,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)},env)
const snapshot=async(options)=>{const response=await call('',options);assert.equal(response.status,200,await response.clone().text());return(await response.json()).data}
const check=async(step,options={})=>{const response=await call('/check',{...options,body:step?{step}:{}});assert.equal(response.status,200,await response.clone().text());return(await response.json()).data.steps.find(row=>row.id===step)}
const step=(data,id)=>data.steps.find(row=>row.id===id)
let requests=[],sendCount=0,event='sent',modelStatus=200,dnsStatus='verified',statusMismatch=false,sendUncertain=false,domainListed=true,recipient='owner-activation@example.test',proposedStatus='pending',ownStatus='pending'
const messages=new Map()
// Resend's domain detail: public DNS names and values per record.
const domainRecords=status=>[{record:'SPF',name:'send',type:'MX',value:'feedback-smtp.example-region.amazonses.com',priority:10,status},{record:'SPF',name:'send',type:'TXT',value:'v=spf1 include:amazonses.com ~all',status},{record:'DKIM',name:'resend._domainkey',type:'TXT',value:'p=MIGfMA0GCSqGSIb3DQEB',status}]
const originalFetch=globalThis.fetch
globalThis.fetch=async(input,init={})=>{
 const url=String(input),method=init.method||'GET';requests.push({url,method})
 if(url.startsWith('https://cloudflare-dns.com/dns-query?')){
  const name=new URL(url).searchParams.get('name')
  const value=name.startsWith('_dmarc.')?'v=DMARC1; p=none':name.includes('._domainkey.')?'v=DKIM1; p=fixture-public-key':'v=spf1 include:fixture.test ~all'
  return Response.json({Status:0,Answer:[{type:16,data:JSON.stringify(value)}]})
 }
 for(const host of ['https://api.openai.com/v1/models/','https://api.anthropic.com/v1/models/'])if(url.startsWith(host)){const id=decodeURIComponent(url.slice(host.length));return Response.json(modelStatus===200?{id,object:'model'}:{error:'fixture'},{status:modelStatus})}
 if(url==='https://api.resend.com/domains')return Response.json({data:domainListed?[{id:'domain-1',name:'example.test'},{id:'domain-2',name:'acme.test'},{id:'domain-3',name:'mine.test'}]:[],has_more:false})
 if(url==='https://api.resend.com/domains/domain-1')return Response.json({id:'domain-1',name:'example.test',status:dnsStatus,records:domainRecords(dnsStatus)})
 if(url==='https://api.resend.com/domains/domain-2')return Response.json({id:'domain-2',name:'acme.test',status:proposedStatus,records:domainRecords(proposedStatus)})
 if(url==='https://api.resend.com/domains/domain-3')return Response.json({id:'domain-3',name:'mine.test',status:ownStatus,records:domainRecords(ownStatus)})
 if(url==='https://api.resend.com/emails'&&method==='POST'){
  sendCount++;if(sendUncertain)throw new Error('Fixture connection lost after provider accepted')
  const body=JSON.parse(init.body);assert.deepEqual(body.to,[recipient])
  if(init.headers['Idempotency-Key'].startsWith('activation:'))assert.equal(body.headers['Auto-Submitted'],'auto-generated')
  const id=`test-message-${sendCount}`;messages.set(id,body);return Response.json({id})
 }
 const sent=url.startsWith('https://api.resend.com/emails/')&&messages.get(url.split('/').pop())
 if(sent)return Response.json({id:url.split('/').pop(),to:statusMismatch?['someone@example.test']:sent.to,from:sent.from,last_event:event})
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
test('the help article step is hidden and never counts, whatever is published',async()=>{
 const insert=(id,project,status)=>DB.prepare('INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,project,id,'Returns','Return instructions',status,Date.now()).run()
 const before=await snapshot(),article=step(before,'published_article')
 assert.deepEqual([article.placement,article.applicable,article.state],['hidden',false,'not_checked'])
 await insert('own',primary.projectId,'published');await insert('foreign',other.projectId,'published')
 const checked=await check('published_article'),after=await snapshot()
 assert.deepEqual([checked.placement,checked.applicable,checked.state],['hidden',false,'not_checked'],'the step is never observed')
 assert.deepEqual([after.done,after.applicableTotal,after.total,after.steps.length],[before.done,before.applicableTotal,8,8],'publishing changes neither count')
 assert.ok(!('articles' in after.facts))
 await DB.prepare("DELETE FROM knowledge_articles WHERE project_id=?").bind(primary.projectId).run()
})
test('model presence does not complete validation; authenticated metadata, revoked key and stale receipts are distinguished',async()=>{
 await DB.prepare('INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES(?,?,?,?,?,?,?)').bind('assistant',primary.projectId,'Helper','Support','Help','gpt-5-mini',Date.now()).run()
 await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(primary.projectId,JSON.stringify({default_visitor_ai_id:'assistant'}),Date.now()).run()
 const missing=await check('model_key',{env:{...base,OPENAI_API_KEY:undefined}});assert.equal(missing.state,'unavailable');assert.match(missing.detail,/CONFIGURATION_REQUIRED: OPENAI_API_KEY/)
 assert.equal((await check('model_key')).state,'done')
 const before=requests.length,validated=await snapshot();assert.equal(step(validated,'model_key').state,'done');assert.equal(requests.length,before)
 assert.deepEqual([validated.facts.ai.provider,validated.facts.ai.checkable],['openai',true],'an OpenAI key can be checked automatically')
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
 const env={...base,EMAIL_API_KEY:'synthetic-rotated-fixture-key'}
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
 // A generated workers.dev address cannot receive email, even with a gateway token installed.
 await DB.prepare('UPDATE email_settings SET inbound_address=?,updated_at=102 WHERE project_id=?').bind(['support','in.workspace.account.workers.dev'].join('@'),primary.projectId).run()
 const blocked=await check('inbound_address');assert.equal(blocked.state,'unavailable');assert.ok(!blocked.receiptRef)
 assert.equal((await snapshot()).facts.inbound.customDomainRequired,true)
 await DB.prepare('UPDATE email_settings SET inbound_address=?,updated_at=103 WHERE project_id=?').bind('support@in.example.test',primary.projectId).run()
 assert.equal((await check('inbound_address')).state,'pending','a custom mailbox waits for a real inbound receipt')
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

// Automatic checks, placement, owner-mail evidence, sender records and the starter, each in a workspace of its own.
const localEnv={...proxy.env,H2H_LOCAL:'true',EMAIL_PROVIDER:'development',APP_ORIGIN:'http://127.0.0.1:8787',EMAIL_FROM:'support@local.test',INBOUND_EMAIL_TOKEN:'synthetic-fixture-inbound-key',PREVIEW_ORIGIN:'https://preview.example'}
const kit=(ws,env=base)=>{
 const send=async(suffix,body,options={})=>{
  const response=await activation.request(`${origin}/projects/${ws.projectId}/activation${suffix}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${ws.tokens.owner}`},body:body===undefined?undefined:JSON.stringify(body)},options.env||env)
  assert.equal(response.status,options.status||200,await response.clone().text())
  return response.status===200?(await response.json()).data:null
 }
 return {get:options=>send('',undefined,options),check:(body,options)=>send('/check',body,options),testMail:options=>send('/test-mail',{},options)}
}
const ids=(data,where)=>data.steps.filter(where).map(row=>row.id)
const since=start=>requests.slice(start).map(row=>row.url)
const receiptRows=async projectId=>JSON.stringify((await DB.prepare('SELECT * FROM activation_receipts WHERE project_id=? ORDER BY step_id').bind(projectId).all()).results)
const defaultAssistant=async(ws,id,model)=>{
 await DB.prepare('INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,ws.projectId,'Helper','Support','Help',model,Date.now()).run()
 await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(ws.projectId,JSON.stringify({default_visitor_ai_id:id,default_responder:id}),Date.now()).run()
}

test('automatic checks repeat no provider request while an observation is fresh, and re-run on expiry or change',async()=>{
 const ws=await seedWorkspace(DB,'auto'),api=kit(ws);await defaultAssistant(ws,'auto-assistant','gpt-5-mini')
 const model='https://api.openai.com/v1/models/gpt-5-mini',domain='https://api.resend.com/domains/domain-1'
 let start=requests.length
 await Promise.all(Array.from({length:5},()=>api.check({auto:true})))
 const burst=since(start);assert.ok(burst.includes(model)&&burst.includes(domain))
 assert.equal(new Set(burst).size,burst.length,'five rapid automatic checks make each provider request once')
 const data=await api.get();assert.equal(step(data,'model_key').state,'done');assert.equal(step(data,'sender_dns').state,'done')
 start=requests.length;for(let i=0;i<5;i++)await api.check({auto:true})
 assert.deepEqual(since(start),[],'fresh observations are kept')
 await api.check({step:'model_key'});assert.deepEqual(since(start),[model],'a check without auto runs now')
 const age=(id,ms)=>DB.prepare('UPDATE activation_receipts SET checked_at=? WHERE project_id=? AND step_id=?').bind(Date.now()-ms,ws.projectId,id).run()
 dnsStatus='pending';await api.check({step:'sender_dns'});dnsStatus='verified'
 start=requests.length;await api.check({auto:true});assert.deepEqual(since(start),[],'a waiting provider observation is kept for 60 seconds')
 await age('sender_dns',61000);await age('model_key',61000);await api.check({auto:true})
 assert.ok(since(start).includes(domain),'a waiting provider observation is read again after 60 seconds')
 assert.ok(!since(start).includes(model),'a done model validation holds for 15 minutes')
 // An expired validation reads as unknown on GET, which neither calls a provider nor writes; the next automatic check renews it.
 await age('model_key',16*60*1000);start=requests.length;const stored=await receiptRows(ws.projectId)
 assert.equal(step(await api.get(),'model_key').state,'unknown');assert.deepEqual(since(start),[]);assert.equal(await receiptRows(ws.projectId),stored)
 assert.equal(step(await api.check({auto:true}),'model_key').state,'done');assert.deepEqual(since(start),[model])
 // Local observations are read again on every automatic check until done: a real widget ping is seen at once.
 assert.equal(step(await api.check({auto:true}),'widget_seen').state,'pending')
 await DB.prepare('INSERT INTO contacts(id,project_id,created_at) VALUES(?,?,?)').bind('auto-contact',ws.projectId,Date.now()).run()
 await DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind('auto-conversation',ws.projectId,'auto-contact',Date.now(),Date.now()).run()
 await DB.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,?,?,?,?,?)').bind(sha('auto-contact-token'),'auto-contact',ws.projectId,'contact','auto-contact',Date.now()+600000).run()
 assert.equal((await widgetEvents.request(origin+'/auto-conversation/widget-events',{method:'POST',headers:{Authorization:'Bearer auto-contact-token',Origin:'https://auto.example','Content-Type':'application/json'},body:JSON.stringify({action:'pingActive',data:{opened:true}})},base)).status,200)
 const seen=step(await api.check({auto:true}),'widget_seen');assert.deepEqual([seen.state,seen.placement],['done','set'])
 // A changed configuration is checked again at once.
 start=requests.length;await api.check({auto:true},{env:{...base,OPENAI_API_KEY:'rotated-model-key'}});assert.deepEqual(since(start),[model])
 for(const body of [{auto:false},{auto:'yes'},{auto:true,done:true}])await api.check(body,{status:400})
})

test('placement and the applicable count follow the installation, and facts carry values but no secrets',async()=>{
 const ws=await seedWorkspace(DB,'place'),api=kit(ws)
 const hosted=await api.get()
 assert.deepEqual([hosted.environment,hosted.total,hosted.done,hosted.applicableTotal],['hosted',8,0,7])
 assert.deepEqual(ids(hosted,row=>row.placement==='needs_you'),['sender_dns','model_key','widget_seen'])
 assert.deepEqual(ids(hosted,row=>row.placement==='hidden'),['published_article'])
 assert.deepEqual(ids(hosted,row=>row.placement==='set'),['owner_mail','inbound_address','spend_ceilings','widget_origin'])
 const trial=await api.get({env:localEnv})
 assert.deepEqual([trial.environment,trial.applicableTotal,trial.facts.mail.mode],['local',5,'local'])
 assert.deepEqual(ids(trial,row=>row.placement==='needs_you'),['model_key','widget_seen'])
 assert.deepEqual(ids(trial,row=>row.placement==='hidden'),['sender_dns','published_article']);assert.deepEqual(ids(trial,row=>!row.applicable),['sender_dns','inbound_address','published_article'])
 const start=requests.length
 const other=await api.check({step:'sender_dns'},{env:{...base,EMAIL_PROVIDER:'sendgrid'}}),dns=step(other,'sender_dns')
 assert.deepEqual(since(start),[]);assert.deepEqual([dns.state,dns.placement,dns.applicable,other.applicableTotal,other.facts.mail.statusApi],['unavailable','set',false,6,false])
 const data=await api.check({auto:true})
 assert.deepEqual([data.facts.workspaceName,data.facts.website,data.facts.inboundAddress],[ws.name,'https://place.example',null])
 assert.deepEqual(data.facts.widget,{key:'widget-place',scriptUrl:origin+'/widget.js',apiOrigin:origin})
 assert.deepEqual(data.facts.ceilings,{...aiCeilings(base),resetUtc:'00:00',source:'defaults'})
 assert.deepEqual(data.facts.colour,{hex:DEFAULT_WORKSPACE_COLOUR,source:'default'})
 assert.deepEqual(data.facts.ai,{assistantId:null,provider:null,secretName:null,keyInstalled:true,checkable:false})
 assert.deepEqual(data.facts.inbound,{enabled:false,gateway:true,customDomainRequired:false,receiving:'no_address'});assert.equal(data.facts.starterAssistant,null)
 assert.equal((await api.get({env:{...base,OPENAI_API_KEY:undefined}})).facts.ai.keyInstalled,false)
 for(const response of [hosted,trial,other,data])assert.doesNotMatch(JSON.stringify(response),/fixture-|rotated-|fingerprint/)
})

test('a key only for a provider with no metadata check is a set row that is not counted, and never confirmed',async()=>{
 const noKey={...base,OPENAI_API_KEY:undefined}
 const ws=await seedWorkspace(DB,'deepseek'),api=kit(ws,{...noKey,DEEPSEEK_API_KEY:'fixture-deepseek-key'});await defaultAssistant(ws,'deepseek-assistant','deepseek-v4-pro')
 const withOpenAi=kit(await seedWorkspace(DB,'openai-count')),openai=await withOpenAi.get()
 const start=requests.length,data=await api.check({step:'model_key'}),row=step(data,'model_key')
 assert.deepEqual(since(start),[],'no provider request is made for a provider with no metadata check')
 assert.deepEqual([row.state,row.placement,row.applicable],['unavailable','set',false])
 assert.deepEqual([data.facts.ai.provider,data.facts.ai.checkable],['deepseek',false],'the snapshot says a DeepSeek key cannot be checked automatically')
 assert.equal(data.applicableTotal,openai.applicableTotal-1);assert.equal(data.done,0)
 // With no key at all it is still the owner's to add, and counted.
 const missing=await kit(ws,noKey).get(),absent=step(missing,'model_key')
 assert.deepEqual([absent.placement,absent.applicable,missing.applicableTotal],['needs_you',true,openai.applicableTotal])
})

test('skip for now is durable per workspace, owner or admin only, never confirms, and yields to an observation',async()=>{
 const ws=await seedWorkspace(DB,'skip'),untouched=await seedWorkspace(DB,'skip-other'),api=kit(ws),pings=widgetEvents
 const skip=(body,{token=ws.tokens.owner,workspace=ws,env=base,raw}={})=>activation.request(`${origin}/projects/${workspace.projectId}/activation/skip`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:raw??JSON.stringify(body)},env)
 const set=async(step_,skipped,options)=>{const response=await skip({step:step_,skipped},options);assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('Cache-Control'),'no-store');return (await response.json()).data}
 const fresh=await api.get(),start=requests.length,sends=sendCount
 assert.deepEqual([fresh.applicableTotal,fresh.done],[7,0])
 // Skipping a need moves it out of the count and confirms nothing; the settings row did not exist before.
 const skipped=await set('widget_seen',true),widget=step(skipped,'widget_seen')
 assert.deepEqual([widget.placement,widget.applicable,widget.state],['skipped',false,'not_checked'])
 assert.deepEqual([skipped.applicableTotal,skipped.done,skipped.total],[6,0,8])
 assert.deepEqual([requests.length,sendCount],[start,sends],'a skip makes no provider request and sends no mail')
 assert.doesNotMatch(JSON.stringify(skipped),/fixture-|rotated-|fingerprint/)
 const stamp=async()=>(await DB.prepare("SELECT settings_json,updated_at FROM project_settings WHERE project_id=?").bind(ws.projectId).first())
 const before=await stamp();assert.equal(JSON.parse(before.settings_json).activation_skips.widget_seen>0,true)
 assert.deepEqual(step(await set('widget_seen',true),'widget_seen').placement,'skipped');assert.deepEqual(await stamp(),before,'repeating a skip changes nothing')
 // Stored on the server: another session (an admin) and a fresh read see it, and no other workspace does.
 assert.equal(step(await api.get(),'widget_seen').placement,'skipped')
 const asAdmin=await activation.request(`${origin}/projects/${ws.projectId}/activation`,{headers:{Authorization:`Bearer ${ws.tokens.admin}`}},base)
 assert.equal(step((await asAdmin.json()).data,'widget_seen').placement,'skipped')
 assert.deepEqual(ids(await kit(untouched).get(),row=>row.placement==='skipped'),[])
 // Undo restores the step and the count exactly; undoing what is not skipped is a no-op.
 const undone=await set('widget_seen',false);assert.deepEqual([step(undone,'widget_seen').placement,undone.applicableTotal],['needs_you',7])
 assert.deepEqual(JSON.parse((await stamp()).settings_json).activation_skips,{});const idle=await stamp();await set('widget_seen',false);assert.deepEqual(await stamp(),idle)
 // An admin may skip; an operator, an anonymous caller, another workspace's owner and a widget visitor may not.
 assert.equal(step(await set('sender_dns',true,{token:ws.tokens.admin}),'sender_dns').placement,'skipped')
 await DB.prepare('INSERT INTO contacts(id,project_id,created_at) VALUES(?,?,?)').bind('skip-contact',ws.projectId,Date.now()).run()
 await DB.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,?,?,?,?,?)').bind(sha('skip-contact-token'),'skip-contact',ws.projectId,'contact','skip-contact',Date.now()+600000).run()
 assert.equal((await skip({step:'model_key',skipped:true},{token:''})).status,401)
 for(const token of [ws.tokens.operator,untouched.tokens.owner,'skip-contact-token'])assert.equal((await skip({step:'model_key',skipped:true},{token})).status,403)
 assert.equal((await skip({step:'model_key',skipped:true},{workspace:untouched,token:ws.tokens.owner})).status,403)
 // Only the owner's own steps can be skipped, and only by a strict body.
 const before400=JSON.stringify(await api.get())
 for(const body of [{step:'published_article',skipped:true},{step:'owner_mail',skipped:true},{step:'inbound_address',skipped:true},{step:'spend_ceilings',skipped:true},{step:'widget_origin',skipped:true},{step:'nope',skipped:true},
  {skipped:true},{step:'model_key'},{step:'model_key',skipped:'yes'},{step:'model_key',skipped:1},{step:'model_key',skipped:true,done:true},[],null,'model_key'])assert.equal((await skip(body)).status,400,JSON.stringify(body))
 assert.equal((await skip(null,{raw:'{not json'})).status,400)
 assert.equal(JSON.stringify(await api.get()),before400,'a refused skip changes nothing')
 // A step that is not a need now is unchanged: sender DNS on a local installation is hidden either way.
 const local=await set('sender_dns',true,{env:localEnv});assert.deepEqual([step(local,'sender_dns').placement,step(local,'sender_dns').applicable],['hidden',false])
 // An observation beats the skip: a real widget visit makes it a confirmed, counted row, and undoing the stale skip changes nothing.
 await set('widget_seen',true)
 await DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind('skip-conversation',ws.projectId,'skip-contact',Date.now(),Date.now()).run()
 const visit=await pings.request(origin+'/skip-conversation/widget-events',{method:'POST',headers:{Authorization:'Bearer skip-contact-token',Origin:'https://skip.example','Content-Type':'application/json'},body:JSON.stringify({action:'pingActive',data:{}})},base)
 assert.equal(visit.status,200)
 assert.equal(step(await api.get(),'widget_seen').placement,'skipped','nothing is confirmed until it is observed')
 const seen=await api.check({auto:true}),row=step(seen,'widget_seen')
 assert.deepEqual([row.state,row.placement,row.applicable],['done','set',true])
 assert.deepEqual(ids(seen,item=>item.state==='done'&&item.placement!=='set'),[],'every observed step is a confirmed row, skipped or not (the verified sending address too)')
 assert.deepEqual([seen.done,seen.applicableTotal],[ids(seen,item=>item.state==='done').length,ids(seen,item=>item.applicable).length],'done counts observed steps, all applicable')
 const stale=await set('widget_seen',false);assert.deepEqual([step(stale,'widget_seen').placement,stale.done,stale.applicableTotal],['set',seen.done,seen.applicableTotal])
 // A problem is never hidden by a skip: a rejected key stays under Needs you.
 const keyed=await seedWorkspace(DB,'skip-key'),keys=kit(keyed);await defaultAssistant(keyed,'skip-assistant','gpt-5-mini')
 assert.equal(step(await set('model_key',true,{workspace:keyed,token:keyed.tokens.owner}),'model_key').placement,'skipped')
 modelStatus=401;try{const failed=step(await keys.check({step:'model_key'}),'model_key');assert.deepEqual([failed.state,failed.placement,failed.applicable],['failed','needs_you',true])}finally{modelStatus=200}
 assert.deepEqual([step(await keys.check({step:'model_key'}),'model_key').placement],['set'])
})

test('local mail is suppressed and cannot confirm owner delivery or issue sign-in links',async()=>{
 const ws=await seedWorkspace(DB,'mail'),api=kit(ws,localEnv),owner='owner-mail@example.test'
 const identityCall=async(path,body)=>{const pending=[];const response=await identity.request('http://127.0.0.1:8787'+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.9'},body:JSON.stringify(body)},localEnv,{waitUntil:task=>pending.push(task),passThroughOnException(){}});await Promise.all(pending);return response}
 const deliveries=async()=>(await DB.prepare('SELECT count(*) n FROM email_deliveries WHERE project_id=?').bind(ws.projectId).first()).n
 const start=requests.length
 const result=await sendEmail(localEnv,{projectId:ws.projectId,to:owner,subject:'Welcome to HappyToHelp',text:'Your workspace is ready.',idempotencyKey:`welcome:${ws.projectId}`})
 assert.deepEqual(result,{id:null,state:'suppressed',mode:'local'})
 for(const data of [await api.check({step:'owner_mail'}),await api.testMail(),await api.testMail(),await api.check({auto:true})]){
  const mail=step(data,'owner_mail')
  assert.equal(mail.state,'pending');assert.ok(!mail.receiptRef)
 }
 assert.equal((await identityCall('/magic-link',{email:owner})).status,503)
 assert.equal(await deliveries(),0,'suppressed welcome and test mail create no delivery records')
 assert.equal(requests.length,start,'local sending and checks contact no provider')
})

test('one used sign-in link confirms owner mail in every workspace its owner owns, never where they are not an owner',async()=>{
 // Sign-in links are issued for the person's lowest-id workspace; the link proves their mailbox, wherever it was issued.
 const env={...base,APP_ORIGIN:origin},first=await seedWorkspace(DB,'two-a'),second=await seedWorkspace(DB,'two-b')
 await DB.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(second.projectId,'owner-two-a').run()
 // The owner of workspace p-two-0, whose links are issued for it, is only an admin of the second workspace.
 await seedWorkspace(DB,'two-0');await DB.prepare("INSERT INTO memberships VALUES(?,?,'admin')").bind(second.projectId,'owner-two-0').run()
 const apis=[kit(first,env),kit(second,env)]
 const identityCall=async(path,body)=>{const pending=[];const response=await identity.request(origin+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.10'},body:JSON.stringify(body)},env,{waitUntil:task=>pending.push(task),passThroughOnException(){}});await Promise.all(pending);return response}
 const usedLink=async email=>{
  recipient=email;const sends=sendCount
  assert.equal((await identityCall('/magic-link',{email})).status,202);assert.equal(sendCount,sends+1)
  const token=[...messages.values()].at(-1).text.match(/token=([a-f0-9]{64})/)[1]
  assert.equal((await identityCall('/magic-link/consume',{token})).status,200)
 }
 const ownerMail=async()=>Promise.all(apis.map(async api=>step(await api.check({step:'owner_mail'}),'owner_mail')))
 try {
  await usedLink('owner-two-0@example.test')
  assert.deepEqual((await ownerMail()).map(row=>row.state),['pending','pending'],"a non-owner's used link does not count")
  const sends=sendCount;await usedLink('owner-two-a@example.test')
  const rows=await ownerMail()
  assert.deepEqual(rows.map(row=>row.state),['done','done'],'both workspaces the owner owns confirm owner mail')
  assert.equal(rows[0].receiptRef,rows[1].receiptRef,'the same used link confirms both');assert.match(rows[1].receiptRef,/^signin:owner-two-a:/)
  assert.equal(sendCount,sends+1,'checks send nothing')
 } finally {recipient='owner-activation@example.test'}
})

test('a hosted welcome email confirms owner mail only on provider delivery, and uncertain mail is never resent',async()=>{
 try {
  for(const [key,lost] of [['welcome',false],['welcome-lost',true]]){
   const ws=await seedWorkspace(DB,key),api=kit(ws);recipient=`owner-${key}@example.test`;event='sent';sendUncertain=lost
   await sendEmail(base,{projectId:ws.projectId,to:recipient,subject:'Welcome to HappyToHelp',text:'Your workspace is ready.',idempotencyKey:`welcome:${ws.projectId}`}).catch(()=>null)
   sendUncertain=false;const sends=sendCount
   let mail=step(await api.check({step:'owner_mail'}),'owner_mail')
   if(lost)assert.equal(mail.state,'unknown')
   else {
    assert.equal(mail.state,'pending');assert.doesNotMatch(mail.detail,/delivered/i)
    event='delivered';mail=step(await api.check({step:'owner_mail'}),'owner_mail');assert.equal(mail.state,'done');assert.match(mail.receiptRef,/:delivered$/)
   }
   for(let i=0;i<3;i++)await api.check({auto:true})
   await api.check({});await api.get()
   assert.equal(sendCount,sends,'checks never send or resend')
  }
 } finally {recipient='owner-activation@example.test';event='sent';sendUncertain=false}
})

test('sender DNS reports the provider records as facts, read back without a provider request',async()=>{
 const ws=await seedWorkspace(DB,'dns'),api=kit(ws),expected=status=>domainRecords(status).map(({type,name,value})=>({type,name,value,status}))
 try {
  dnsStatus='pending';const checked=await api.check({step:'sender_dns'})
  assert.equal(step(checked,'sender_dns').state,'pending');assert.deepEqual(checked.facts.senderRecords,expected('pending'))
  const start=requests.length;assert.deepEqual((await api.get()).facts.senderRecords,expected('pending'));assert.deepEqual(since(start),[])
  domainListed=false;const absent=await api.check({step:'sender_dns'})
  assert.equal(step(absent,'sender_dns').state,'pending');assert.deepEqual(absent.facts.senderRecords,[])
  domainListed=true;dnsStatus='verified';const verified=await api.check({step:'sender_dns'})
  assert.equal(step(verified,'sender_dns').state,'done');assert.deepEqual(verified.facts.senderRecords,expected('verified'))
  assert.deepEqual((await api.get({env:{...base,EMAIL_FROM:'support@other.test'}})).facts.senderRecords,[],'records belong to the configuration they were read under')
 } finally {dnsStatus='verified';domainListed=true}
})

test('a verified proposed sender is adopted in the same observation, never over an address the owner chose',async()=>{
 const workspace=async(key,fromAddress)=>{
  const ws=await seedWorkspace(DB,key)
  await DB.prepare('INSERT INTO email_settings VALUES(?,?,?,?,?,?)').bind(ws.projectId,'Support',fromAddress,null,0,1).run()
  await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(ws.projectId,JSON.stringify({proposed_sender:'support@acme.test'}),Date.now()).run()
  return {ws,api:kit(ws)}
 }
 const saved=async ws=>DB.prepare('SELECT from_address,updated_at FROM email_settings WHERE project_id=?').bind(ws.projectId).first()
 try {
  // Mail goes out from the seeded installation sender, welcome email included, until the workspace's own domain is verified.
  const seeded=await workspace('switch','support@example.test');recipient='owner-switch@example.test';event='delivered'
  await sendEmail(base,{projectId:seeded.ws.projectId,to:recipient,subject:'Welcome to HappyToHelp',text:'Your workspace is ready.',idempotencyKey:`welcome:${seeded.ws.projectId}`})
  let data=await seeded.api.check({})
  assert.deepEqual([step(data,'sender_dns').state,step(data,'owner_mail').state],['pending','done'])
  assert.deepEqual([data.facts.mail.sender,data.facts.mail.proposedSender,data.facts.mail.senderSwitch],['support@example.test','support@acme.test',null])
  assert.equal((await saved(seeded.ws)).from_address,'support@example.test','an unverified domain is not adopted')
  proposedStatus='verified';data=await seeded.api.check({})
  assert.equal(step(data,'sender_dns').state,'done');assert.deepEqual({...await saved(seeded.ws)},{from_address:'support@acme.test',updated_at:1},'the sender switches; the mailbox version does not')
  assert.deepEqual([data.facts.mail.sender,data.facts.mail.senderSwitch?.from,data.facts.mail.senderSwitch?.to],['support@acme.test','support@example.test','support@acme.test'])
  assert.equal(step(data,'owner_mail').state,'done','the welcome email from the replaced installation sender still counts')
  const read=await seeded.api.get();assert.deepEqual([step(read,'sender_dns').state,step(read,'owner_mail').state],['done','done'],'the observation describes the sender now in use')
  // An address the owner chose is never overwritten, even though the proposed domain is verified: it is that address that is checked.
  const chosen=await workspace('switch-own','help@mine.test')
  data=await chosen.api.check({step:'sender_dns'})
  assert.equal(step(data,'sender_dns').state,'pending');assert.equal((await saved(chosen.ws)).from_address,'help@mine.test');assert.equal(data.facts.mail.senderSwitch,null)
 } finally {recipient='owner-activation@example.test';event='sent';proposedStatus='pending'}
})

test('sender DNS follows an address the owner chose: its own domain is checked and mail never switches',async()=>{
 const ws=await seedWorkspace(DB,'dns-own'),api=kit(ws),sentFrom=async()=>(await DB.prepare('SELECT from_address FROM email_settings WHERE project_id=?').bind(ws.projectId).first()).from_address
 await DB.prepare('INSERT INTO email_settings VALUES(?,?,?,?,?,?)').bind(ws.projectId,'Support','help@mine.test',null,0,1).run()
 await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(ws.projectId,JSON.stringify({proposed_sender:'support@acme.test'}),Date.now()).run()
 proposedStatus='verified'
 try {
  // The proposed domain is verified, but the address in use is help@mine.test, whose domain is the one checked.
  ownStatus='pending';let start=requests.length,data=await api.check({step:'sender_dns'})
  assert.equal(step(data,'sender_dns').state,'pending');assert.equal(data.facts.mail.senderDnsDomain,'mine.test')
  assert.ok(since(start).some(url=>url.endsWith('/domains/domain-3'))&&!since(start).some(url=>url.endsWith('/domains/domain-2')),'only the domain of the address in use is read')
  ownStatus='verified';data=await api.check({step:'sender_dns'})
  assert.equal(step(data,'sender_dns').state,'done');assert.equal(data.facts.mail.senderDnsDomain,'mine.test')
  assert.deepEqual([await sentFrom(),data.facts.mail.sender,data.facts.mail.proposedSender,data.facts.mail.senderSwitch],['help@mine.test','help@mine.test','support@acme.test',null],'verifying the chosen address never switches the sender')
  assert.equal(step(await api.get(),'sender_dns').state,'done')
  // Still on the seeded installation sender, the proposed domain is the one named.
  await DB.prepare('UPDATE email_settings SET from_address=? WHERE project_id=?').bind('support@example.test',ws.projectId).run()
  assert.equal((await api.get()).facts.mail.senderDnsDomain,'acme.test')
 } finally {proposedStatus='pending';ownStatus='pending'}
})

test('an untouched starter moves to the installed provider before validation; an edited assistant never changes',async()=>{
 const seed={name:'Support helper',role:'Support',prompt:'Answer from published help articles.',model:'claude-haiku-4-5-20251001',is_enabled:true}
 const starter=async(key,profile=seed)=>{
  const ws=await seedWorkspace(DB,key),id=`${key}-assistant`
  await DB.prepare('INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,is_enabled,created_at) VALUES(?,?,?,?,?,?,1,?)').bind(id,ws.projectId,profile.name,profile.role,profile.prompt,profile.model,Date.now()).run()
  await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(ws.projectId,JSON.stringify({default_visitor_ai_id:id,default_responder:id,starter_ai:{id,seed}}),Date.now()).run()
  return {ws,id,api:kit(ws)}
 }
 const stored=async({ws,id})=>({model:(await DB.prepare('SELECT model FROM ai_profiles WHERE id=?').bind(id).first()).model,seed:JSON.parse((await DB.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(ws.projectId).first()).settings_json).starter_ai.seed.model})
 // Only an OpenAI key is installed: the untouched starter follows it, and its marker with it, so it still reads as untouched.
 const moved=await starter('starter')
 assert.equal(step(await moved.api.get(),'model_key').state,'not_checked');assert.deepEqual(await stored(moved),{model:seed.model,seed:seed.model},'GET changes nothing')
 const data=await moved.api.check({auto:true}),now=await stored(moved)
 assert.notEqual(now.model,seed.model);assert.equal(now.seed,now.model)
 // The starter fact is the assistant itself and whether it is untouched; it answers visitors by itself, with nothing to switch.
 assert.deepEqual(data.facts.starterAssistant,{id:moved.id,name:seed.name,model:now.model,provider:'openai',edited:false})
 assert.deepEqual([data.facts.ai.assistantId,data.facts.ai.secretName],[moved.id,'OPENAI_API_KEY'],'the starter is the default visitor assistant')
 assert.equal(step(data,'model_key').state,'done')
 // With its own provider's key installed it stays where it is.
 const own=await starter('starter-own')
 assert.equal(step(await own.api.check({step:'model_key'},{env:{...base,ANTHROPIC_API_KEY:'synthetic-fixture-anthropic-key'}}),'model_key').state,'done');assert.equal((await stored(own)).model,seed.model)
 // An assistant the owner edited is never changed, and the missing key stays stated.
 const edited=await starter('starter-edited',{...seed,prompt:'My own instructions.'})
 const kept=await edited.api.check({auto:true}),missing=step(kept,'model_key')
 assert.equal((await stored(edited)).model,seed.model);assert.equal(kept.facts.starterAssistant.edited,true)
 assert.equal(missing.state,'unavailable');assert.match(missing.detail,/ANTHROPIC_API_KEY/)
})
