import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
const require=createRequire(import.meta.url)
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
test('sender domain names missing SPF, DKIM and DMARC; DNS errors remain unknown; route is scoped',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'t021-domain-'))
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-14',d1Databases:['DB']}))
 try{
  const file=join(dir,'domain.mjs');await build({stdin:{contents:"export * from './src/modules/integrations/sender-domain.ts';export * from './src/modules/integrations/sender-domain-routes.ts'",resolveDir:process.cwd()},bundle:true,write:true,outfile:file,format:'esm',platform:'node',logLevel:'silent'})
  const {checkSenderDomain,senderDomainRoutes}=await import(pathToFileURL(file))
  const seen=[];const missing=await checkSenderDomain('Example.test',async name=>{seen.push(name);return []})
  assert.deepEqual(seen,['example.test','resend._domainkey.example.test','_dmarc.example.test'])
  assert.deepEqual(missing.missing,['SPF','DKIM','DMARC']);for(const r of missing.records)assert.match(r.message,new RegExp(`Missing ${r.record}`))
  const records={'example.test':['v=spf1 include:_spf.example.test -all'],'key._domainkey.example.test':['v=DKIM1; k=rsa; p=abc'],'_dmarc.example.test':['v=DMARC1; p=reject']}
  assert.equal((await checkSenderDomain('example.test',async n=>records[n]||[],'key')).ok,true)
  assert.equal((await checkSenderDomain('example.test',async()=>{throw new Error('offline')})).records.every(r=>r.status==='unknown'),true)
  assert.equal((await checkSenderDomain('example.test',async n=>n.startsWith('resend')?['v=DKIM1; p=']:[])).missing.includes('DKIM'),true)
  for(const domain of ['localhost','127.0.0.1','evil.test/path','a@test.example'])await assert.rejects(checkSenderDomain(domain,async()=>[]),/Invalid/)
  const db=await mf.getD1Database('DB');for(const name of ['0001_identity.sql','0005_widget_identity.sql','0070_management.sql','0080_integrations.sql'])await db.exec((await readFile('migrations/'+name,'utf8')).replaceAll('\n',' '))
  await db.exec("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','key','https://widget.example',1),('q','Other','qkey','https://other.example',1);INSERT INTO users VALUES('u','owner@example.test','Owner',1);INSERT INTO memberships VALUES('p','u','owner');INSERT INTO email_settings(project_id,from_name,from_address,is_enabled,updated_at) VALUES('p','Support','help@example.test',1,1)")
  const token='operator-token';await db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,NULL)').bind(createHash('sha256').update(token).digest('hex'),'u','p','owner',null,Date.now()+60000).run()
  let lookups=0;const routes=senderDomainRoutes(async n=>{lookups++;return records[n]||[]})
  const path='/projects/p/email-settings/check-domain?selector=key'
  assert.equal((await routes.request('https://support.example'+path,{}, {DB:db})).status,401)
  const headers={Authorization:'Bearer '+token}
  assert.equal((await routes.request('https://support.example/projects/q/email-settings/check-domain',{headers},{DB:db})).status,403)
  const r=await routes.request('https://support.example'+path,{headers},{DB:db});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.equal(lookups,3)
  assert.equal((await routes.request('https://support.example/projects/p/email-settings/check-domain?selector=bad.name',{headers},{DB:db})).status,400)
  await db.exec("INSERT INTO project_settings VALUES('p','{\"deleted_at\":1}',1)");assert.equal((await routes.request('https://support.example'+path,{headers},{DB:db})).status,401);assert.equal(lookups,3)
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true})}
})
