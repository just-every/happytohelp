import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {Hono}=await import('hono'),{getPlatformProxy}=await import('wrangler'),{setup}=await import('../src/modules/identity/setup.ts')
const directory=await mkdtemp(join(tmpdir(),'h2h-owner-setup-deployment-')),configPath=join(directory,'wrangler.json')
await writeFile(configPath,JSON.stringify({name:'owner-setup-deployment-test',compatibility_date:'2026-09-01',d1_databases:[{binding:'DB',database_name:'isolated-setup-deployment',database_id:'isolated-setup-deployment-test'}]}))
const proxy=await getPlatformProxy({configPath,persist:false,envFiles:[]})
const tables=['owner_setup','users','projects','project_settings','memberships','credentials','sessions','ai_profiles']
try {
 const env=proxy.env,db=env.DB,app=new Hono();app.route('/',setup)
 for(const file of ['0001_identity.sql','0003_identity_credentials.sql'])for(const sql of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run()
 await db.prepare(readFileSync(new URL('../migrations/0005_widget_identity.sql',import.meta.url),'utf8').split(';').find(sql=>sql.includes('ADD COLUMN metadata_json'))).run()
 await db.prepare(readFileSync(new URL('../migrations/0005_widget_identity.sql',import.meta.url),'utf8').split(';').find(sql=>sql.includes('ADD COLUMN verification_secret'))).run()
 for(const statement of readFileSync(new URL('../migrations/0097_owner_setup.sql',import.meta.url),'utf8').split(/;\s*(?=(?:--|CREATE|INSERT)|$)/).filter(s=>s.trim()))await db.prepare(statement).run()
 // Setup provisions a starter assistant with the workspace, so the schema includes project settings and assistants.
 for(const sql of readFileSync(new URL('../migrations/0070_management.sql',import.meta.url),'utf8').split(';').slice(0,2))await db.prepare(sql).run()
 const entry={name:'First Owner',email:'owner@example.invalid',password:'long-test-password',allowedOrigin:'https://example.invalid'}
 const submit=(origin,body=entry)=>app.request(origin+'/bootstrap',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)},env)
 const state=async origin=>(await app.request(origin+'/setup',{},env)).json()
 const counts=async()=>Promise.all(tables.map(async table=>(await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n))
 const empty=async()=>assert.deepEqual(await counts(),tables.map(()=>0))
 const reset=async()=>{for(const table of ['sessions','credentials','memberships','project_settings','ai_profiles','users','projects','owner_setup'])await db.prepare(`DELETE FROM ${table}`).run();delete env.H2H_SETUP_TOKEN;delete env.RER_INSTALLATION_ID;delete env.APP_ORIGIN;await empty()}
 const deployed='https://help.example.test'

 // A directly deployed Worker without a configured token refuses every unauthenticated claim.
 await reset()
 assert.deepEqual(await state(deployed),{available:true,tokenRequired:true})
 for(const body of [entry,{...entry,setupToken:''},{...entry,setupToken:'guessed-token'}]){
  const refused=await submit(deployed,body);assert.equal(refused.status,503);assert.match(await refused.text(),/requires a private H2H_SETUP_TOKEN/)
 }
 for(const origin of ['https://happytohelp.owner.workers.dev','http://192.168.1.20:5173','http://localhost.example.test'])assert.equal((await submit(origin)).status,503,origin)
 await empty()

 // A loopback address behind a proxy is still a deployment when APP_ORIGIN is public.
 env.APP_ORIGIN=deployed
 assert.deepEqual(await state('http://127.0.0.1:8787'),{available:true,tokenRequired:true})
 assert.equal((await submit('http://127.0.0.1:8787')).status,503)
 await empty()

 // The same deployment with its private token accepts only the correct token.
 const token='f'.repeat(64);env.H2H_SETUP_TOKEN=token
 assert.deepEqual(await state(deployed),{available:true,tokenRequired:true})
 assert.equal((await submit(deployed)).status,403)
 assert.equal((await submit(deployed,{...entry,setupToken:'f'.repeat(63)})).status,403)
 await empty()
 const created=await submit(deployed,{...entry,setupToken:token});assert.equal(created.status,201)
 assert.match(created.headers.get('set-cookie'),/Secure/)
 assert.deepEqual(await state(deployed),{available:false,tokenRequired:true})
 assert.equal((await submit(deployed,{...entry,setupToken:token})).status,409)

 // A redeploy without the token after setup keeps the installation closed.
 delete env.H2H_SETUP_TOKEN
 assert.equal((await submit(deployed,{...entry,email:'second@example.invalid'})).status,503)
 assert.equal((await db.prepare('SELECT count(*) AS n FROM users').first()).n,1)

 // Local loopback development is unchanged: tokenless on 127.0.0.1, localhost and [::1].
 for(const origin of ['http://127.0.0.1:5173','http://localhost:5173','http://[::1]:5173']){
  await reset()
  assert.deepEqual(await state(origin),{available:true})
  const local=await submit(origin);assert.equal(local.status,201,origin);assert.doesNotMatch(local.headers.get('set-cookie'),/Secure/)
 }
 await reset();env.APP_ORIGIN='http://127.0.0.1:5173'
 assert.deepEqual(await state('http://127.0.0.1:5173'),{available:true})
 assert.equal((await submit('http://127.0.0.1:5173')).status,201)

 // RER-managed installations keep their credential contract on any host.
 for(const origin of ['http://127.0.0.1:5173',deployed]){
  await reset();env.RER_INSTALLATION_ID='managed-fixture'
  assert.deepEqual(await state(origin),{available:true,tokenRequired:true})
  const waiting=await submit(origin);assert.equal(waiting.status,503);assert.match(await waiting.text(),/awaiting its installation credential/)
  env.H2H_SETUP_TOKEN='managed-private-owner-setup-fixture'
  assert.equal((await submit(origin)).status,403)
  assert.equal((await submit(origin,{...entry,setupToken:env.H2H_SETUP_TOKEN})).status,201)
 }
 console.log('Deployment owner setup passed: tokenless non-local claims refused, token-only claim, proxy/APP_ORIGIN closure, loopback development and managed credential unchanged.')
} finally {await proxy.dispose();await rm(directory,{recursive:true,force:true})}
