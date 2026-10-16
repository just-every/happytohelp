import assert from 'node:assert/strict'
import {startApp} from '../../journeys/kit/app.mjs'

// The sender-domain check reads the sending domain's SPF, DKIM and DMARC records through DNS-over-HTTPS,
// names what is missing, keeps resolver errors unknown, and is scoped to the workspace's own members.
export async function senderDomainJourney(){
 let records={},offline=false,lookups=0
 const app=await startApp({outbound:async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'cloudflare-dns.com');lookups++
  if(offline)return new Response('unavailable',{status:503})
  const name=url.searchParams.get('name');return Response.json({Status:0,Answer:(records[name]||[]).map(data=>({type:16,data:JSON.stringify(data)}))})
 }})
 try{
  const workspace=await app.seedWorkspace('domain'),other=await app.seedWorkspace('other'),p=workspace.projectId,token=workspace.tokens.owner
  await app.db.prepare("INSERT INTO email_settings(project_id,from_name,from_address,is_enabled,updated_at) VALUES(?,'Support','help@Example.test',1,1)").bind(p).run()
  const check=(query='',options={token})=>app.call(`/api/management/projects/${p}/email-settings/check-domain${query}`,options)
  const missing=(await check('',{token,status:200})).data;assert.deepEqual(missing.missing,['SPF','DKIM','DMARC']);for(const record of missing.records)assert.match(record.message,new RegExp(`Missing ${record.record}`))
  assert.deepEqual(missing.records.map(record=>record.name),['example.test','resend._domainkey.example.test','_dmarc.example.test'])
  records={'example.test':['v=spf1 include:_spf.example.test -all'],'key._domainkey.example.test':['v=DKIM1; k=rsa; p=abc'],'_dmarc.example.test':['v=DMARC1; p=reject'],'resend._domainkey.example.test':['v=DKIM1; p=']}
  assert.equal((await check('?selector=key',{token,status:200})).data.ok,true)
  assert.ok((await check('',{token,status:200})).data.missing.includes('DKIM'),'an empty DKIM key is missing')
  offline=true;assert.ok((await check('?selector=key',{token,status:200})).data.records.every(record=>record.status==='unknown'),'resolver errors stay unknown');offline=false
  assert.equal((await check('?selector=bad.name',{token})).status,400)
  for(const address of ['help@localhost','help@127.0.0.1']){await app.db.prepare('UPDATE email_settings SET from_address=? WHERE project_id=?').bind(address,p).run();assert.ok((await check('',{token})).status>=400,address)}
  const before=lookups
  assert.equal((await check('?selector=key',{})).status,401);assert.equal((await app.call(`/api/management/projects/${other.projectId}/email-settings/check-domain`,{token})).status,403)
  await app.db.prepare("INSERT INTO project_settings VALUES(?,'{\"deleted_at\":1}',1)").bind(p).run();assert.equal((await check('?selector=key',{token})).status,401)
  assert.equal(lookups,before,'refused checks resolve nothing')
 }finally{await app.close()}
}
