import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import assert from 'node:assert/strict'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const limits=await import('../src/modules/knowledge/crawl-limits.ts')
const {validateDataset}=await import('../src/ui/native/pages/knowledge/dataset-validation.js')
const {validateManagementDraft,pluginUrlError}=await import('../src/ui/native/pages/management-validation.js')
const {validateTrainingRun,parseCases}=await import('../src/ui/native/pages/training-run-form.js')
const {startCrawl}=await import('../src/modules/knowledge/crawl.ts')

test('crawl limits accept whole numbers in range and refuse negative, fractional, absurd and non-numeric values',()=>{
 for(const [depth,pages] of [[0,1],[3,100],[100,1000],[100,10000],[undefined,undefined],[null,null]])assert.equal(limits.crawlLimitError({max_crawl_depth:depth,max_crawl_pages:pages}),null,`${depth}/${pages}`)
 for(const depth of [-5,-1,101,1.5,'3','',NaN,Infinity,99999999])assert.match(limits.crawlLimitError({max_crawl_depth:depth}),/Max crawl depth must|Max crawl depth is required/,String(depth))
 for(const pages of [0,-5,10001,99999999,2.5,'50','',NaN])assert.match(limits.crawlLimitError({max_crawl_pages:pages}),/Max crawl pages must|Max crawl pages is required/,String(pages))
 assert.match(limits.crawlDepthError(undefined,true),/required/);assert.equal(limits.crawlDepthError(undefined,false),null)
})
test('the crawler start refuses stored out-of-range limits before any provider call',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('provider must not be called')}
 try{
  const env={APIFY_TOKEN:'fixture',APIFY_CRAWLER_ACTOR_ID:'actor'}
  await assert.rejects(startCrawl(env,{url:'https://example.test',max_crawl_depth:-5}),/Max crawl depth/)
  await assert.rejects(startCrawl(env,{url:'https://example.test',max_crawl_pages:99999999}),/Max crawl pages/)
  assert.equal(calls,0)
 }finally{globalThis.fetch=original}
})
test('dataset form validation reports each field',()=>{
 assert.equal(validateDataset({url:'https://example.test',max_crawl_depth:100,max_crawl_pages:1000}),null)
 const bad=validateDataset({url:'',max_crawl_depth:-5,max_crawl_pages:99999999})
 assert.deepEqual(Object.keys(bad).sort(),['max_crawl_depth','max_crawl_pages','url'])
 assert.match(validateDataset({url:'ftp://example.test',max_crawl_depth:3,max_crawl_pages:10}).url,/https:\/\/ or http:\/\//)
 assert.match(validateDataset({url:'https://example.test',max_crawl_depth:'',max_crawl_pages:10}).max_crawl_depth,/required/)
})
test('management form validation: contacts need an identifier, plugin URLs must be https',()=>{
 for(const draft of [{},{name:'  ',email:'',external_id:''}])assert.match(validateManagementDraft('contacts',draft).name,/name, an email or an external ID/)
 assert.equal(validateManagementDraft('contacts',{external_id:'crm-1'}),null)
 assert.equal(validateManagementDraft('contacts',{id:'existing',name:''}),null,'existing visitors without a name can still be edited')
 assert.match(validateManagementDraft('contacts',{email:'nope'}).email,/valid email/)
 assert.equal(pluginUrlError('https://example.test/app'),null);assert.equal(pluginUrlError('http://localhost:3000/app'),null)
 for(const value of ['','javascript:alert(1)','http://example.test','not a url','ftp://example.test'])assert.ok(pluginUrlError(value),value)
 assert.deepEqual(Object.keys(validateManagementDraft('plugins',{name:' ',url:'javascript:alert(1)'})).sort(),['name','url'])
 assert.equal(validateManagementDraft('macros',{}),null)
})
test('training run validation names the field and never exposes a parser message',()=>{
 const valid={kind:'evaluation',models:'model-a\nmodel-b\n',cases:'[{"id":"one"},{"id":"two"}]',variants:'',max_cost:5,max_tokens:2000}
 const ok=validateTrainingRun(valid);assert.deepEqual(ok.value,{kind:'evaluation',models:['model-a','model-b'],cases:[{id:'one'},{id:'two'}],max_cost:5,max_tokens:2000})
 assert.deepEqual(validateTrainingRun({...valid,variants:'["prototype","baseline","prototype"]'}).value.variants,['prototype','baseline'])
 const raw=/Expected property name|JSON\.parse|Unexpected token|is not valid JSON|position \d/
 for(const text of ['{not json','[','[{"id":"a",}]'])assert.doesNotMatch(parseCases(text).error,raw,text)
 assert.match(parseCases('{not json').error,/Case definitions are not valid JSON/)
 assert.match(validateTrainingRun({...valid,variants:'['}).errors.variants,/Variants are not valid JSON/)
 const cases=[['',/at least one case/],['{"id":"a"}',/list of cases/],['[]',/at least one case/],['[1]',/Case 1 must be an object/],['[{"name":"x"}]',/Case 1 needs a text "id"/],['[{"id":"a"},{"id":"a"}]',/unique/]]
 for(const [text,message] of cases)assert.match(parseCases(text).error,message,text)
 assert.match(parseCases(JSON.stringify(Array.from({length:10001},(_,n)=>({id:`c${n}`})))).error,/at most 10,000/)
 assert.match(parseCases(JSON.stringify([{id:'big',text:'x'.repeat(100001)}])).error,/too large/)
 for(const [patch,field] of [[{models:''},'models'],[{models:'a\n'.repeat(65)},'models'],[{variants:'["other"]'},'variants'],[{max_cost:0},'max_cost'],[{max_cost:''},'max_cost'],[{max_cost:-1},'max_cost'],[{max_tokens:0},'max_tokens'],[{max_tokens:32001},'max_tokens'],[{max_tokens:1.5},'max_tokens'],[{max_tokens:''},'max_tokens'],[{kind:'training'},'kind']])assert.ok(validateTrainingRun({...valid,...patch}).errors[field],JSON.stringify(patch))
 assert.equal(validateTrainingRun({...valid,max_tokens:32000}).errors,undefined)
})

const {getPlatformProxy}=await import('wrangler')
test('server: datasets reject negative and absurd crawl limits, contacts reject an empty body',async()=>{
 const proxy=await getPlatformProxy({persist:false})
 try{
  const {routes:knowledge}=await import('../src/modules/knowledge/routes.ts')
  const {resources:management}=await import('../src/modules/management/resources.ts')
  const {hashToken}=await import('../src/platform/auth.ts')
  const env={...proxy.env},DB=env.DB
  for(const file of ['0001_identity.sql','0002_conversations.sql','123_operator_notifications.sql','0003_identity_credentials.sql','0004_message_intent.sql','0005_widget_identity.sql','0007_conversation_history.sql','0070_management.sql','0071_management_preferences.sql','0050_knowledge.sql','0051_knowledge_authoring.sql','0052_knowledge_imports.sql','0053_knowledge_recovery.sql','020_ai_support.sql'])for(const [,sql] of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await DB.prepare(sql).run()
  await DB.batch([DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://widget.example',1)"),DB.prepare("INSERT INTO users VALUES('u','owner@example.com','Owner',1)"),DB.prepare("INSERT INTO memberships VALUES('p','u','owner')"),DB.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(await hashToken('token'),Date.now()+999999)])
  const call=(app,path,method,body)=>app.request('https://app.example'+path,{method,headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},env)
  const base={name:'Docs',url:'https://example.test'}
  for(const patch of [{max_crawl_depth:-5},{max_crawl_pages:99999999},{max_crawl_depth:101},{max_crawl_pages:0},{max_crawl_depth:1.5},{max_crawl_pages:'50'},{max_crawl_depth:''}]){
   const response=await call(knowledge,'/p/datasets','POST',{...base,...patch});assert.equal(response.status,400,JSON.stringify(patch));assert.match((await response.json()).error,/Max crawl (depth|pages)/)
  }
  assert.equal((await DB.prepare('SELECT count(*) n FROM knowledge_datasets').first()).n,0,'refused datasets are not stored')
  const created=await call(knowledge,'/p/datasets','POST',{...base,max_crawl_depth:100,max_crawl_pages:1000});assert.equal(created.status,201);const {id}=await created.json()
  const defaults=await call(knowledge,'/p/datasets','POST',base);assert.equal(defaults.status,201,'omitted limits keep the stored defaults')
  for(const patch of [{max_crawl_depth:-1},{max_crawl_pages:10001}])assert.equal((await call(knowledge,`/p/datasets/${id}`,'PUT',{...base,...patch})).status,400,JSON.stringify(patch))
  assert.equal((await call(knowledge,`/p/datasets/${id}`,'PUT',{...base,max_crawl_depth:7,max_crawl_pages:70})).status,200)
  assert.deepEqual(await DB.prepare('SELECT max_crawl_depth d,max_crawl_pages n FROM knowledge_datasets WHERE id=?').bind(id).first(),{d:7,n:70})

  for(const body of [{},{name:''},{name:'   ',email:'',external_id:''},{email:null,external_id:null}]){
   const response=await call(management,'/projects/p/contacts','POST',body);assert.equal(response.status,400,JSON.stringify(body));assert.match(await response.text(),/name, an email or an external ID/)
  }
  assert.equal((await DB.prepare('SELECT count(*) n FROM contacts').first()).n,0,'an empty contact is not stored')
  for(const body of [{name:'Ada'},{email:'ada@example.test'},{external_id:'crm-1'}])assert.equal((await call(management,'/projects/p/contacts','POST',body)).status,201,JSON.stringify(body))
  assert.equal((await DB.prepare('SELECT count(*) n FROM contacts').first()).n,3)
  const owner=await call(management,'/projects/p/agents/u','DELETE');assert.equal(owner.status,409);assert.match(await owner.text(),/last owner/i,'the last-owner refusal explains itself')
 }finally{await proxy.dispose()}
})
