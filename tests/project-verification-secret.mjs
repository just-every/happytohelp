import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {registerHooks} from 'node:module'
import {DatabaseSync} from 'node:sqlite'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {serverSecret}=await import('../src/platform/db.ts')
const {registration}=await import('../src/modules/identity/registration.ts')
const {hashToken}=await import('../src/platform/auth.ts')
const {getPlatformProxy}=await import('wrangler')
const migration=name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')

test('server secrets are 256-bit lowercase hex and never repeat',()=>{
 const secrets=new Set(Array.from({length:200},serverSecret))
 assert.equal(secrets.size,200)
 for(const secret of secrets)assert.match(secret,/^[0-9a-f]{64}$/)
})

test('the backfill gives every project without a secret its own, and keeps existing secrets',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(migration('0001_identity.sql'));db.exec(migration('0005_widget_identity.sql'))
 const insert=db.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at,verification_secret) VALUES(?,?,?,?,1,?)')
 insert.run('null-secret','A','a','https://a.test',null)
 insert.run('empty-secret','B','b','https://b.test','')
 insert.run('kept-secret','C','c','https://c.test','owner-chosen-secret')
 for(let index=0;index<50;index++)insert.run('bulk-'+index,'Bulk','bulk-'+index,'https://bulk.test',null)
 const apply=()=>db.exec(migration('0106_project_verification_secret.sql'))
 apply()
 const secrets=new Map(db.prepare('SELECT id,verification_secret FROM projects').all().map(row=>[row.id,row.verification_secret]))
 assert.equal(secrets.get('kept-secret'),'owner-chosen-secret')
 for(const [id,secret] of secrets)if(id!=='kept-secret')assert.match(secret,/^[0-9a-f]{64}$/,id)
 assert.equal(new Set(secrets.values()).size,secrets.size,'each project receives a distinct secret')
 apply()
 assert.deepEqual(new Map(db.prepare('SELECT id,verification_secret FROM projects').all().map(row=>[row.id,row.verification_secret])),secrets,'a second run changes nothing')
})

test('a verified registration creates a project with its own server secret',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'h2h-registration-secret-')),configPath=join(directory,'wrangler.json')
 await writeFile(configPath,JSON.stringify({name:'registration-secret-test',compatibility_date:'2026-09-01',d1_databases:[{binding:'DB',database_name:'isolated-registration-secret',database_id:'isolated-registration-secret-test'}]}))
 const proxy=await getPlatformProxy({configPath,persist:false,envFiles:[]})
 try{
  const DB=proxy.env.DB
  for(const file of ['0001_identity.sql','0003_identity_credentials.sql','0005_widget_identity.sql','0006_registration.sql','0070_management.sql','0102_public_abuse_limits.sql'])for(const sql of migration(file).split(';').filter(statement=>statement.trim()))await DB.prepare(sql).run()
  const verify=async token=>{
   await DB.prepare('INSERT INTO registrations VALUES(?,?,?,?,?,?,?,NULL)').bind(await hashToken(token),token+'@example.test','Owner','hash','Project '+token,'https://'+token+'.example.test',Date.now()+60000).run()
   const response=await registration.request('http://app.test/verify-email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})},proxy.env)
   assert.equal(response.status,200);return (await response.json()).projectId
  }
  const first=await verify('first'),second=await verify('second')
  const secrets=[first,second].map(async id=>(await DB.prepare('SELECT verification_secret FROM projects WHERE id=?').bind(id).first()).verification_secret)
  const [a,b]=await Promise.all(secrets)
  assert.match(a,/^[0-9a-f]{64}$/);assert.match(b,/^[0-9a-f]{64}$/);assert.notEqual(a,b)
 }finally{await proxy.dispose();await rm(directory,{recursive:true,force:true})}
})
