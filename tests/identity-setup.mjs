import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {Hono}=await import('hono'),{getPlatformProxy}=await import('wrangler'),{setup}=await import('../src/modules/identity/setup.ts'),{accounts}=await import('../src/modules/identity/accounts.ts')
const {verifyPassword}=await import('../src/modules/identity/credentials.ts')
const proxy=await getPlatformProxy({persist:false})
try {
 const env=proxy.env,db=env.DB,app=new Hono();app.route('/',setup);app.route('/',accounts)
 for(const file of ['0001_identity.sql','0003_identity_credentials.sql'])for(const sql of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run()
 const migrate=async()=>{const sql=readFileSync(new URL('../migrations/0097_owner_setup.sql',import.meta.url),'utf8');for(const statement of sql.split(/;\s*(?=(?:--|CREATE|INSERT)|$)/).filter(s=>s.trim()))await db.prepare(statement).run()}
 await migrate()
 const entry={name:'First Owner',email:'Owner@Example.invalid',password:'long-test-password',allowedOrigin:'https://example.invalid/page'}
 const submit=(body=entry,headers={})=>app.request('http://127.0.0.1/bootstrap',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1',...headers},body:typeof body==='string'?body:JSON.stringify(body)},env)
 const state=async()=>(await app.request('http://127.0.0.1/setup',{},env)).json()
 assert.deepEqual(await state(),{available:true})
 for(const invalid of [{...entry,email:'bad'}, {...entry,password:'short'}, {...entry,allowedOrigin:'javascript:alert(1)'}, {...entry,name:''}, '{',null])assert.equal((await submit(invalid)).status,400)
 assert.equal((await submit(entry,{origin:'https://hostile.invalid'})).status,403)
 assert.equal((await submit(entry,{'sec-fetch-site':'cross-site'})).status,403)
 for(const table of ['owner_setup','users','projects','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0)
 env.RER_INSTALLATION_ID='managed-fixture'
 assert.deepEqual(await state(),{available:true,tokenRequired:true})
 assert.equal((await submit()).status,503)
 env.H2H_SETUP_TOKEN='private-owner-setup-fixture'
 env.H2H_SETUP_OWNER_EMAIL='owner@example.invalid'
 assert.equal((await submit()).status,403)
 assert.equal((await submit({...entry,setupToken:'incorrect'})).status,403)
 assert.equal((await submit({...entry,email:'attacker@example.invalid',setupToken:env.H2H_SETUP_TOKEN})).status,403)
 for(const table of ['owner_setup','users','projects','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0)
 delete env.RER_INSTALLATION_ID;delete env.H2H_SETUP_TOKEN;delete env.H2H_SETUP_OWNER_EMAIL
 // A database failure after claiming setup rolls back every write, including its marker.
 await db.prepare("CREATE TRIGGER reject_setup_credentials BEFORE INSERT ON credentials BEGIN SELECT RAISE(ABORT,'fixture failure'); END").run()
 assert.equal((await submit()).status,500)
 for(const table of ['owner_setup','users','projects','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0)
 await db.prepare('DROP TRIGGER reject_setup_credentials').run()
 const responses=await Promise.all([submit(),submit({...entry,email:'racer@example.invalid'})])
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,409])
 const success=responses.find(r=>r.status===201),owner=await success.json()
 assert.match(success.headers.get('set-cookie'),/HttpOnly/);assert.doesNotMatch(success.headers.get('set-cookie'),/Secure/)
 for(const table of ['owner_setup','users','projects','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,1)
 assert(await verifyPassword(entry.password,(await db.prepare('SELECT password_hash FROM credentials').first()).password_hash))
 assert.equal((await db.prepare('SELECT user_id FROM memberships').first()).user_id,owner.userId)
 assert.equal((await db.prepare('SELECT project_id FROM sessions').first()).project_id,owner.projectId)
 const email=(await db.prepare('SELECT email FROM users').first()).email
 assert.equal(email,email.toLowerCase())
 const login=await app.request('http://127.0.0.1/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:entry.password})},env)
 assert.equal(login.status,200);assert.doesNotMatch(login.headers.get('set-cookie'),/Secure/)
 const secureLogin=await app.request('https://example.invalid/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:entry.password})},env)
 assert.equal(secureLogin.status,200);assert.match(secureLogin.headers.get('set-cookie'),/Secure/)
 assert.deepEqual(await state(),{available:false});assert.equal((await submit()).status,409)
 for(const table of ['sessions','credentials','memberships','users','projects'])await db.prepare(`DELETE FROM ${table}`).run()
 assert.deepEqual(await state(),{available:false});assert.equal((await submit()).status,409)
 // Legacy partial installation is closed by the migration without granting credentials.
 await db.prepare('DROP TRIGGER owner_setup_on_user').run();await db.prepare('DROP TRIGGER owner_setup_on_project').run();await db.prepare('DROP TABLE owner_setup').run()
 await db.prepare("INSERT INTO users VALUES('legacy','legacy@example.invalid','Legacy',1)").run();await migrate()
 assert.deepEqual(await state(),{available:false});assert.equal((await submit()).status,409)
 assert.equal((await db.prepare('SELECT count(*) n FROM credentials').first()).n,0)
 await db.prepare("DELETE FROM users WHERE id='legacy'").run()
 assert.deepEqual(await state(),{available:false})
 // Future import also durably consumes first-owner setup.
 await db.prepare('DELETE FROM owner_setup').run();await db.prepare("INSERT INTO users VALUES('imported','import@example.invalid','Imported',1)").run();await db.prepare('DELETE FROM users').run()
 assert.deepEqual(await state(),{available:false})
 // The managed credential shares the permanent atomic claim, even after owner deletion.
 await db.prepare('DELETE FROM owner_setup').run()
 env.RER_INSTALLATION_ID='managed-fixture';env.H2H_SETUP_TOKEN='private-owner-setup-fixture';env.H2H_SETUP_OWNER_EMAIL='OWNER@example.invalid'
 const managedEntry={...entry,setupToken:env.H2H_SETUP_TOKEN}
 const managedResponses=await Promise.all([submit(managedEntry),submit(managedEntry)])
 assert.deepEqual(managedResponses.map(r=>r.status).sort(),[201,409])
 for(const table of ['sessions','credentials','memberships','users','projects'])await db.prepare(`DELETE FROM ${table}`).run()
 assert.equal((await submit(managedEntry)).status,409)
 console.log('Real D1 owner setup passed: validation, CSRF, rollback, concurrent first owner, password/login/cookies, permanent closure, legacy partial state and import closure.')
} finally {await proxy.dispose()}
