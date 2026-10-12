import {randomBytes} from 'node:crypto'
import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {Hono}=await import('hono'),{getPlatformProxy}=await import('wrangler'),{setup}=await import('../src/modules/identity/setup.ts'),{accounts}=await import('../src/modules/identity/accounts.ts')
const {projects}=await import('../src/modules/management/projects.ts')
const {verifyPassword}=await import('../src/modules/identity/credentials.ts')
const directory=await mkdtemp(join(tmpdir(),'h2h-owner-setup-')),configPath=join(directory,'wrangler.json')
await writeFile(configPath,JSON.stringify({name:'owner-setup-test',compatibility_date:'2026-09-01',d1_databases:[{binding:'DB',database_name:'isolated-setup',database_id:'isolated-setup-test'}]}))
const proxy=await getPlatformProxy({configPath,persist:false,envFiles:[]})
try {
 const env=proxy.env,db=env.DB,app=new Hono();app.route('/',setup);app.route('/',accounts);app.route('/management',projects)
 for(const file of ['0001_identity.sql','0003_identity_credentials.sql'])for(const sql of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run()
 await db.prepare(readFileSync(new URL('../migrations/0005_widget_identity.sql',import.meta.url),'utf8').split(';').find(sql=>sql.includes('ADD COLUMN metadata_json'))).run()
 await db.prepare(readFileSync(new URL('../migrations/0005_widget_identity.sql',import.meta.url),'utf8').split(';').find(sql=>sql.includes('ADD COLUMN verification_secret'))).run()
 const migrate=async()=>{const sql=readFileSync(new URL('../migrations/0097_owner_setup.sql',import.meta.url),'utf8');for(const statement of sql.split(/;\s*(?=(?:--|CREATE|INSERT)|$)/).filter(s=>s.trim()))await db.prepare(statement).run()}
 await migrate()
 await db.prepare(readFileSync(new URL('../migrations/0070_management.sql',import.meta.url),'utf8').split(';')[0]).run()
 await db.prepare(readFileSync(new URL('../migrations/0070_management.sql',import.meta.url),'utf8').split(';').find(sql=>sql.includes('CREATE TABLE user_settings'))).run()
 await db.prepare(readFileSync(new URL('../migrations/0098_personal_visual_inspiration.sql',import.meta.url),'utf8')).run()
 const entry={name:'First Owner',email:'Owner@Example.invalid',password:randomBytes(24).toString('base64url'),allowedOrigin:'https://example.invalid/page'}
 const submit=(body=entry,headers={})=>app.request('http://127.0.0.1/bootstrap',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1',...headers},body:typeof body==='string'?body:JSON.stringify(body)},env)
 const state=async()=>(await app.request('http://127.0.0.1/setup',{},env)).json()
 assert.deepEqual(await state(),{available:true})
 for(const invalid of [{...entry,email:'bad'}, {...entry,password:'short'}, {...entry,allowedOrigin:'javascript:alert(1)'}, {...entry,name:''}, {...entry,ownerName:' '}, {...entry,primaryColor:'red'}, {...entry,primaryColor:'#123456;bad'}, {...entry,primaryColor:null}, '{',null])assert.equal((await submit(invalid)).status,400)
 assert.equal((await submit(entry,{origin:'https://hostile.invalid'})).status,403)
 assert.equal((await submit(entry,{'sec-fetch-site':'cross-site'})).status,403)
 for(const table of ['owner_setup','users','projects','project_settings','user_settings','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0)
 env.RER_INSTALLATION_ID='managed-fixture'
 assert.deepEqual(await state(),{available:true,tokenRequired:true})
 assert.equal((await submit()).status,503)
 env.H2H_SETUP_TOKEN='private-owner-setup-fixture'
 env.H2H_SETUP_OWNER_EMAIL='owner@example.invalid'
 assert.equal((await submit()).status,403)
 assert.equal((await submit({...entry,setupToken:'incorrect'})).status,403)
 assert.equal((await submit({...entry,email:'attacker@example.invalid',setupToken:env.H2H_SETUP_TOKEN})).status,403)
 for(const table of ['owner_setup','users','projects','project_settings','user_settings','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0)
 delete env.RER_INSTALLATION_ID;delete env.H2H_SETUP_TOKEN;delete env.H2H_SETUP_OWNER_EMAIL
 // A database failure after claiming setup rolls back every write, including its marker.
 await db.prepare("CREATE TRIGGER reject_setup_credentials BEFORE INSERT ON credentials BEGIN SELECT RAISE(ABORT,'fixture failure'); END").run()
 assert.equal((await submit({...entry,ownerName:'Actual Owner',primaryColor:'#AABBCC'})).status,500)
 for(const table of ['owner_setup','users','projects','project_settings','user_settings','memberships','credentials','sessions'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0)
 await db.prepare('DROP TRIGGER reject_setup_credentials').run()
 const responses=await Promise.all([submit(),submit({...entry,email:'racer@example.invalid'})])
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,409])
 assert.equal((await db.prepare('SELECT count(*) n FROM user_settings').first()).n,0)
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
 for(const table of ['sessions','credentials','memberships','user_settings','users','projects'])await db.prepare(`DELETE FROM ${table}`).run()
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
 const mapped={ownerName:'  Actual Owner  ',email:entry.email,password:entry.password,allowedOrigin:entry.allowedOrigin,primaryColor:'#AABBCC'};
 const managedEntry={...entry,setupToken:env.H2H_SETUP_TOKEN,...Object.fromEntries(['ownerName','email','password','allowedOrigin','primaryColor'].map(key=>[key,mapped[key]]))}
 const managedResponses=await Promise.all([submit(managedEntry),submit(managedEntry)])
 assert.deepEqual(managedResponses.map(r=>r.status).sort(),[201,409])
 assert.equal((await db.prepare('SELECT count(*) n FROM user_settings').first()).n,0)
 assert.equal((await db.prepare('SELECT name FROM users').first()).name,'Actual Owner')
 assert.equal((await db.prepare('SELECT name FROM projects').first()).name,entry.name)
 assert.match((await db.prepare('SELECT verification_secret FROM projects').first()).verification_secret,/^[0-9a-f]{64}$/,'owner setup gives the first project a server secret')
 assert.deepEqual(JSON.parse((await db.prepare('SELECT settings_json FROM project_settings').first()).settings_json),{primary_color:'#aabbcc'})
 const managedOwner=await managedResponses.find(r=>r.status===201).json()
 assert(await verifyPassword(entry.password,(await db.prepare('SELECT password_hash FROM credentials').first()).password_hash))
 assert.equal((await app.request('http://127.0.0.1/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:mapped.email,password:entry.password})},env)).status,200)
 const profile=(method='GET',body)=>app.request('http://127.0.0.1/management/profile',{method,headers:{authorization:`Bearer ${managedOwner.token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})},env)
 assert.equal('visual_inspiration' in (await (await profile()).json()).data,false)
 assert.equal((await app.request('http://127.0.0.1/management/profile',{},env)).status,401)
 // Retired personal preferences remain historical data, untouched by profile edits.
 await db.prepare('INSERT INTO user_settings(user_id,visual_inspiration) VALUES(?,?)').bind(managedOwner.userId,'Preserved historical preference').run()
 assert.equal((await profile('PUT',{name:'Renamed Owner',visual_inspiration:'Do not reactivate this field'})).status,200)
 assert.equal((await db.prepare('SELECT visual_inspiration FROM user_settings WHERE user_id=?').bind(managedOwner.userId).first()).visual_inspiration,'Preserved historical preference')
 assert.equal('visual_inspiration' in (await (await profile()).json()).data,false)
 await db.prepare('DELETE FROM project_settings').run()
 for(const table of ['sessions','credentials','memberships','user_settings','users','projects'])await db.prepare(`DELETE FROM ${table}`).run()
 assert.equal((await submit(managedEntry)).status,409)
 console.log('Real D1 owner setup passed: validation, CSRF, rollback, concurrent first owner, password/login/cookies, permanent closure, legacy partial state and import closure.')
} finally {await proxy.dispose();await rm(directory,{recursive:true,force:true})}
