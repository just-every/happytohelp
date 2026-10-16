import assert from 'node:assert/strict'
import {activationApp,hosted,local,origin,step,ids} from './activation-app.mjs'
const {aiCeilings}=await import('../../../src/platform/limit-config.ts')
const {DEFAULT_WORKSPACE_COLOUR}=await import('../../../src/modules/management/workspace-colour.ts')

// Setup's automatic checks, placement, skips and the starter assistant, each in a workspace of its own: automatic
// checks repeat no provider request while an observation is fresh, a skip never confirms and yields to an observation,
// and facts carry values but never secrets.
export async function automaticJourney(){
 const a=await activationApp(),{app,s}=a,since=a.since,sent=()=>app.requests.length
 const receiptRows=async projectId=>JSON.stringify(await app.sql('SELECT * FROM activation_receipts WHERE project_id=? ORDER BY step_id',projectId))
 try{
  // Five rapid automatic checks make each provider request once; fresh observations are kept.
  const ws=await app.seedWorkspace('auto'),api=a.kit(ws);await a.defaultAssistant(ws,'auto-assistant','gpt-5-mini')
  const model='https://api.openai.com/v1/models/gpt-5-mini',domain='https://api.resend.com/domains/domain-1'
  let start=sent()
  await Promise.all(Array.from({length:5},()=>api.check({auto:true})))
  const burst=since(start);assert.ok(burst.includes(model)&&burst.includes(domain))
  assert.equal(new Set(burst).size,burst.length,'five rapid automatic checks make each provider request once')
  const data=await api.get();assert.equal(step(data,'model_key').state,'done');assert.equal(step(data,'sender_dns').state,'done')
  start=sent();for(let i=0;i<5;i++)await api.check({auto:true})
  assert.deepEqual(since(start),[],'fresh observations are kept')
  await api.check({step:'model_key'});assert.deepEqual(since(start),[model],'a check without auto runs now')
  const age=(id,ms)=>app.db.prepare('UPDATE activation_receipts SET checked_at=? WHERE project_id=? AND step_id=?').bind(Date.now()-ms,ws.projectId,id).run()
  s.dnsStatus='pending';await api.check({step:'sender_dns'});s.dnsStatus='verified'
  start=sent();await api.check({auto:true});assert.deepEqual(since(start),[],'a waiting provider observation is kept for 60 seconds')
  await age('sender_dns',61000);await age('model_key',61000);await api.check({auto:true})
  assert.ok(since(start).includes(domain),'a waiting provider observation is read again after 60 seconds')
  assert.ok(!since(start).includes(model),'a done model validation holds for 15 minutes')
  // An expired validation reads as unknown on GET, which neither calls a provider nor writes; the next automatic check renews it.
  await age('model_key',16*60*1000);start=sent();const stored=await receiptRows(ws.projectId)
  assert.equal(step(await api.get(),'model_key').state,'unknown');assert.deepEqual(since(start),[]);assert.equal(await receiptRows(ws.projectId),stored)
  assert.equal(step(await api.check({auto:true}),'model_key').state,'done');assert.deepEqual(since(start),[model])
  // Local observations are read again on every automatic check until done: a real widget ping is seen at once.
  assert.equal(step(await api.check({auto:true}),'widget_seen').state,'pending')
  const visitor=await a.visitor(ws,'auto-contact',{conversation:true})
  assert.equal((await a.ping(visitor.conversationId,{site:'https://auto.example',token:visitor.token})).status,200)
  const seen=step(await api.check({auto:true}),'widget_seen');assert.deepEqual([seen.state,seen.placement],['done','set'])
  // A changed configuration is checked again at once.
  start=sent();await api.check({auto:true},{env:{OPENAI_API_KEY:'rotated-model-key'}});assert.deepEqual(since(start),[model])
  for(const body of [{auto:false},{auto:'yes'},{auto:true,done:true}])await api.check(body,{status:400})

  // Placement and the applicable count follow the installation; facts carry values but no secrets.
  const place=await app.seedWorkspace('place'),placed=a.kit(place)
  const hostedView=await placed.get()
  assert.deepEqual([hostedView.environment,hostedView.total,hostedView.done,hostedView.applicableTotal],['hosted',8,0,7])
  assert.deepEqual(ids(hostedView,row=>row.placement==='needs_you'),['sender_dns','model_key','widget_seen'])
  assert.deepEqual(ids(hostedView,row=>row.placement==='hidden'),['published_article'])
  assert.deepEqual(ids(hostedView,row=>row.placement==='set'),['owner_mail','inbound_address','spend_ceilings','widget_origin'])
  const trial=await placed.get({env:local})
  assert.deepEqual([trial.environment,trial.applicableTotal,trial.facts.mail.mode],['local',5,'local'])
  assert.deepEqual(ids(trial,row=>row.placement==='needs_you'),['model_key','widget_seen'])
  assert.deepEqual(ids(trial,row=>row.placement==='hidden'),['sender_dns','published_article']);assert.deepEqual(ids(trial,row=>!row.applicable),['sender_dns','inbound_address','published_article'])
  start=sent()
  const sendgrid=await placed.check({step:'sender_dns'},{env:{EMAIL_PROVIDER:'sendgrid'}}),dns=step(sendgrid,'sender_dns')
  assert.deepEqual(since(start),[]);assert.deepEqual([dns.state,dns.placement,dns.applicable,sendgrid.applicableTotal,sendgrid.facts.mail.statusApi],['unavailable','set',false,6,false])
  const facts=await placed.check({auto:true})
  assert.deepEqual([facts.facts.workspaceName,facts.facts.website,facts.facts.inboundAddress],[place.name,'https://place.example',null])
  assert.deepEqual(facts.facts.widget,{key:'widget-place',scriptUrl:origin+'/widget.js',apiOrigin:origin})
  assert.deepEqual(facts.facts.ceilings,{...aiCeilings(hosted),resetUtc:'00:00',source:'defaults'})
  assert.deepEqual(facts.facts.colour,{hex:DEFAULT_WORKSPACE_COLOUR,source:'default'})
  assert.deepEqual(facts.facts.ai,{assistantId:null,provider:null,secretName:null,keyInstalled:true,checkable:false})
  assert.deepEqual(facts.facts.inbound,{enabled:false,gateway:true,customDomainRequired:false,receiving:'no_address'});assert.equal(facts.facts.starterAssistant,null)
  assert.equal((await placed.get({env:{OPENAI_API_KEY:undefined}})).facts.ai.keyInstalled,false)
  for(const response of [hostedView,trial,sendgrid,facts])assert.doesNotMatch(JSON.stringify(response),/fixture-|rotated-|fingerprint/)

  // A key only for a provider with no metadata check is a set row that is not counted, and never confirmed.
  const noKey={OPENAI_API_KEY:undefined},deepseek=await app.seedWorkspace('deepseek'),viaDeepseek=a.kit(deepseek,{...noKey,DEEPSEEK_API_KEY:'fixture-deepseek-key'})
  await a.defaultAssistant(deepseek,'deepseek-assistant','deepseek-v4-pro')
  const openai=await a.kit(await app.seedWorkspace('openai-count')).get()
  start=sent();const unchecked=await viaDeepseek.check({step:'model_key'}),row=step(unchecked,'model_key')
  assert.deepEqual(since(start),[],'no provider request is made for a provider with no metadata check')
  assert.deepEqual([row.state,row.placement,row.applicable],['unavailable','set',false])
  assert.deepEqual([unchecked.facts.ai.provider,unchecked.facts.ai.checkable],['deepseek',false],'the snapshot says a DeepSeek key cannot be checked automatically')
  assert.equal(unchecked.applicableTotal,openai.applicableTotal-1);assert.equal(unchecked.done,0)
  // With no key at all it is still the owner's to add, and counted.
  const keyless=await a.kit(deepseek,noKey).get(),absent=step(keyless,'model_key')
  assert.deepEqual([absent.placement,absent.applicable,keyless.applicableTotal],['needs_you',true,openai.applicableTotal])

  await skipJourney(a)
  await starterJourney(a)
  await probesJourney(a)
 }finally{await a.close()}
}

// Skip for now is durable per workspace, owner or admin only, never confirms, and yields to an observation.
async function skipJourney(a){
 const {app,s}=a,sent=()=>app.requests.length
 const ws=await app.seedWorkspace('skip'),untouched=await app.seedWorkspace('skip-other'),api=a.kit(ws)
 const skip=(body,{token=ws.tokens.owner,workspace=ws,env,raw}={})=>a.call(workspace.projectId,'/skip',{body,raw,token,env})
 const set=async(id,skipped,options)=>{const response=await skip({step:id,skipped},options);assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(response.headers.get('Cache-Control'),'no-store');return response.data.data}
 const fresh=await api.get(),start=sent(),sends=s.sendCount
 assert.deepEqual([fresh.applicableTotal,fresh.done],[7,0])
 // Skipping a need moves it out of the count and confirms nothing; the settings row did not exist before.
 const skipped=await set('widget_seen',true),widget=step(skipped,'widget_seen')
 assert.deepEqual([widget.placement,widget.applicable,widget.state],['skipped',false,'not_checked'])
 assert.deepEqual([skipped.applicableTotal,skipped.done,skipped.total],[6,0,8])
 assert.deepEqual([sent(),s.sendCount],[start,sends],'a skip makes no provider request and sends no mail')
 assert.doesNotMatch(JSON.stringify(skipped),/fixture-|rotated-|fingerprint/)
 const stamp=()=>app.first('SELECT settings_json,updated_at FROM project_settings WHERE project_id=?',ws.projectId)
 const before=await stamp();assert.equal(JSON.parse(before.settings_json).activation_skips.widget_seen>0,true)
 assert.equal(step(await set('widget_seen',true),'widget_seen').placement,'skipped');assert.deepEqual(await stamp(),before,'repeating a skip changes nothing')
 // Stored on the server: another session (an admin) and a fresh read see it, and no other workspace does.
 assert.equal(step(await api.get(),'widget_seen').placement,'skipped')
 assert.equal(step((await a.call(ws.projectId,'',{token:ws.tokens.admin,status:200})).data.data,'widget_seen').placement,'skipped')
 assert.deepEqual(ids(await a.kit(untouched).get(),row=>row.placement==='skipped'),[])
 // Undo restores the step and the count exactly; undoing what is not skipped is a no-op.
 const undone=await set('widget_seen',false);assert.deepEqual([step(undone,'widget_seen').placement,undone.applicableTotal],['needs_you',7])
 assert.deepEqual(JSON.parse((await stamp()).settings_json).activation_skips,{});const idle=await stamp();await set('widget_seen',false);assert.deepEqual(await stamp(),idle)
 // An admin may skip; an operator, an anonymous caller, another workspace's owner and a widget visitor may not.
 assert.equal(step(await set('sender_dns',true,{token:ws.tokens.admin}),'sender_dns').placement,'skipped')
 const visitor=await a.visitor(ws,'skip-contact',{conversation:true})
 assert.equal((await skip({step:'model_key',skipped:true},{token:''})).status,401)
 for(const token of [ws.tokens.operator,untouched.tokens.owner,visitor.token])assert.equal((await skip({step:'model_key',skipped:true},{token})).status,403)
 assert.equal((await skip({step:'model_key',skipped:true},{workspace:untouched,token:ws.tokens.owner})).status,403)
 // Only the owner's own steps can be skipped, and only by a strict body.
 const before400=JSON.stringify(await api.get())
 for(const body of [{step:'published_article',skipped:true},{step:'owner_mail',skipped:true},{step:'inbound_address',skipped:true},{step:'spend_ceilings',skipped:true},{step:'widget_origin',skipped:true},{step:'nope',skipped:true},
  {skipped:true},{step:'model_key'},{step:'model_key',skipped:'yes'},{step:'model_key',skipped:1},{step:'model_key',skipped:true,done:true},[],null,'model_key'])assert.equal((await skip(body)).status,400,JSON.stringify(body))
 assert.equal((await skip(undefined,{raw:'{not json'})).status,400)
 assert.equal(JSON.stringify(await api.get()),before400,'a refused skip changes nothing')
 // A step that is not a need now is unchanged: sender DNS on a local installation is hidden either way.
 const localView=await set('sender_dns',true,{env:local});assert.deepEqual([step(localView,'sender_dns').placement,step(localView,'sender_dns').applicable],['hidden',false])
 // An observation beats the skip: a real widget visit makes it a confirmed, counted row, and undoing the stale skip changes nothing.
 await set('widget_seen',true)
 assert.equal((await a.ping(visitor.conversationId,{site:'https://skip.example',token:visitor.token,data:{}})).status,200)
 assert.equal(step(await api.get(),'widget_seen').placement,'skipped','nothing is confirmed until it is observed')
 const seen=await api.check({auto:true}),row=step(seen,'widget_seen')
 assert.deepEqual([row.state,row.placement,row.applicable],['done','set',true])
 assert.deepEqual(ids(seen,item=>item.state==='done'&&item.placement!=='set'),[],'every observed step is a confirmed row, skipped or not (the verified sending address too)')
 assert.deepEqual([seen.done,seen.applicableTotal],[ids(seen,item=>item.state==='done').length,ids(seen,item=>item.applicable).length],'done counts observed steps, all applicable')
 const stale=await set('widget_seen',false);assert.deepEqual([step(stale,'widget_seen').placement,stale.done,stale.applicableTotal],['set',seen.done,seen.applicableTotal])
 // A problem is never hidden by a skip: a rejected key stays under Needs you.
 const keyed=await app.seedWorkspace('skip-key'),keys=a.kit(keyed);await a.defaultAssistant(keyed,'skip-assistant','gpt-5-mini')
 assert.equal(step(await set('model_key',true,{workspace:keyed,token:keyed.tokens.owner}),'model_key').placement,'skipped')
 s.modelStatus=401;try{const failed=step(await keys.check({step:'model_key'}),'model_key');assert.deepEqual([failed.state,failed.placement,failed.applicable],['failed','needs_you',true])}finally{s.modelStatus=200}
 assert.equal(step(await keys.check({step:'model_key'}),'model_key').placement,'set')
}

// An untouched starter moves to the installed provider before validation; an edited assistant never changes.
async function starterJourney(a){
 const {app}=a,seed={name:'Support helper',role:'Support',prompt:'Answer from published help articles.',model:'claude-haiku-4-5-20251001',is_enabled:true}
 const starter=async(key,profile=seed)=>{
  const ws=await app.seedWorkspace(key),id=`${key}-assistant`
  await app.db.batch([
   app.db.prepare('INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,is_enabled,created_at) VALUES(?,?,?,?,?,?,1,?)').bind(id,ws.projectId,profile.name,profile.role,profile.prompt,profile.model,Date.now()),
   app.db.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(ws.projectId,JSON.stringify({default_visitor_ai_id:id,default_responder:id,starter_ai:{id,seed}}),Date.now()),
  ])
  return {ws,id,api:a.kit(ws)}
 }
 const stored=async({ws,id})=>({model:(await app.first('SELECT model FROM ai_profiles WHERE id=?',id)).model,seed:JSON.parse((await app.first('SELECT settings_json FROM project_settings WHERE project_id=?',ws.projectId)).settings_json).starter_ai.seed.model})
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
 assert.equal(step(await own.api.check({step:'model_key'},{env:{ANTHROPIC_API_KEY:'synthetic-fixture-anthropic-key'}}),'model_key').state,'done');assert.equal((await stored(own)).model,seed.model)
 // An assistant the owner edited is never changed, and the missing key stays stated.
 const edited=await starter('starter-edited',{...seed,prompt:'My own instructions.'})
 const kept=await edited.api.check({auto:true}),missing=step(kept,'model_key')
 assert.equal((await stored(edited)).model,seed.model);assert.equal(kept.facts.starterAssistant.edited,true)
 assert.equal(missing.state,'unavailable');assert.match(missing.detail,/ANTHROPIC_API_KEY/)
}

// What the provider probes accept: OpenRouter validates the selected mapped model, never just the key; sender DNS
// needs SPF, DKIM and DMARC published; a check in flight reads as checking.
async function probesJourney(a){
 const {app,s}=a,since=a.since,router={OPENROUTER_API_KEY:'fixture-openrouter-key'}
 const ws=await app.seedWorkspace('router'),api=a.kit(ws,router);await a.defaultAssistant(ws,'router-assistant','gpt-oss-120b')
 const model=async(env)=>step(await api.check({step:'model_key'},env?{env}:undefined),'model_key')
 let start=app.requests.length
 assert.equal((await model({})).state,'unavailable');assert.deepEqual(since(start),[],'no key, no request')
 const valid=await model();assert.equal(valid.state,'done');assert.equal(valid.receiptRef,'provider:openrouter:model:openai/gpt-oss-120b')
 for(const [models,state] of [[{data:[{id:'different/model'}]},'failed'],[{data:[]},'failed'],[{},'unknown']]){s.routerModels=models;assert.equal((await model()).state,state,JSON.stringify(models))}
 s.routerModels={data:[{id:'openai/gpt-oss-120b'}]}
 for(const [status,state] of [[401,'failed'],[302,'unknown']]){s.routerKeyStatus=status;assert.equal((await model()).state,state,String(status))}
 s.routerKeyStatus=200
 assert.ok(since(start).every(url=>url==='https://openrouter.ai/api/v1/key'||url==='https://openrouter.ai/api/v1/models/user'),'metadata only, never a completion, and a redirect is not followed')

 const dns=await app.seedWorkspace('records'),records=a.kit(dns),sender=async()=>step(await records.check({step:'sender_dns'}),'sender_dns')
 start=app.requests.length;assert.equal((await sender()).state,'done')
 assert.deepEqual(since(start).filter(url=>url.startsWith('https://cloudflare-dns.com/')).map(url=>new URL(url).searchParams.get('name')).sort(),['_dmarc.example.test','example.test','resend._domainkey.example.test'])
 for(const record of ['SPF','DKIM','DMARC']){s.dnsMissing=record;const result=await sender();assert.equal(result.state,'pending');assert.match(result.detail,new RegExp(record))}
 s.dnsMissing='';s.dnsDown=true;assert.equal((await sender()).state,'unknown');s.dnsDown=false

 const gated=await app.seedWorkspace('gated'),checks=a.kit(gated);await a.defaultAssistant(gated,'gated-assistant','gpt-5-mini')
 let release;s.modelGate=new Promise(done=>{release=done});start=app.requests.length
 const pending=checks.check({step:'model_key'})
 try{
  await app.until(()=>since(start).includes('https://api.openai.com/v1/models/gpt-5-mini'),{message:'the model request'})
  assert.equal(step(await checks.get(),'model_key').state,'checking','a check in flight reads as checking')
 }finally{release();s.modelGate=null}
 assert.equal(step(await pending,'model_key').state,'done')
}
