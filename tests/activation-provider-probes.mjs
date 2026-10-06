import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/identity-db.mjs'
const {checkModel}=await import('../src/modules/management/activation/model-probe.ts')
const {checkSenderDns}=await import('../src/modules/management/activation/mail-probes.ts')

test('OpenRouter validates the selected mapped model, never just key metadata',async()=>{
 const original=globalThis.fetch,requests=[]
 let models={data:[{id:'openai/gpt-oss-120b'}]},keyStatus=200
 const config={assistant:{is_enabled:1},model:'gpt-oss-120b',provider:'openrouter',secretName:'OPENROUTER_API_KEY',key:'fixture-key'}
 globalThis.fetch=async(url,options)=>{
  requests.push(String(url));assert.equal(options.headers.Authorization,'Bearer fixture-key');assert.equal(options.redirect,'manual')
  if(String(url).endsWith('/key'))return Response.json({data:{label:'fixture'}},{status:keyStatus})
  assert.equal(String(url),'https://openrouter.ai/api/v1/models/user')
  return Response.json(models)
 }
 try{
  assert.equal((await checkModel({...config,key:undefined})).state,'unavailable');assert.equal(requests.length,0)
  const success=await checkModel(config);assert.equal(success.state,'done');assert.equal(success.receiptRef,'provider:openrouter:model:openai/gpt-oss-120b')
  models={data:[{id:'different/model'}]};assert.equal((await checkModel(config)).state,'failed')
  models={data:[]};assert.equal((await checkModel(config)).state,'failed')
  models={};assert.equal((await checkModel(config)).state,'unknown')
  keyStatus=401;await assert.rejects(checkModel(config),error=>error.probe.state==='failed')
  keyStatus=302;await assert.rejects(checkModel(config),error=>error.probe.state==='unknown')
  assert.ok(requests.every(url=>!url.includes('completions')))
 }finally{globalThis.fetch=original}
})

test('activation sender DNS requires shared SPF, DKIM and DMARC observations',async()=>{
 const original=globalThis.fetch,seen=[]
 let missing='',unknown=false
 globalThis.fetch=async(url)=>{
  if(String(url)==='https://api.resend.com/domains')return Response.json({data:[{id:'domain',name:'example.test'}]})
  if(String(url)==='https://api.resend.com/domains/domain')return Response.json({id:'domain',name:'example.test',status:'verified',records:[{record:'SPF',status:'verified'},{record:'DKIM',status:'verified'}]})
  const name=new URL(url).searchParams.get('name');seen.push(name)
  if(unknown)throw new Error('Fixture resolver unavailable')
  const record=name.startsWith('_dmarc.')?'DMARC':name.includes('._domainkey.')?'DKIM':'SPF'
  const value=record==='DMARC'?'v=DMARC1; p=none':record==='DKIM'?'v=DKIM1; p=fixture':'v=spf1 ~all'
  return Response.json({Status:0,Answer:record===missing?[]:[{type:16,data:JSON.stringify(value)}]})
 }
 try{
  const env={EMAIL_API_KEY:'fixture-key'},config={sender:'support@example.test',providerName:'resend'}
  assert.equal((await checkSenderDns(env,config)).state,'done')
  assert.deepEqual(seen.sort(),['_dmarc.example.test','example.test','resend._domainkey.example.test'])
  for(const record of ['SPF','DKIM','DMARC']){missing=record;const result=await checkSenderDns(env,config);assert.equal(result.state,'pending');assert.match(result.detail,new RegExp(record))}
  unknown=true;assert.equal((await checkSenderDns(env,config)).state,'unknown')
 }finally{globalThis.fetch=original}
})
