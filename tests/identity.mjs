import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const {routes}=await import('../src/modules/identity/routes.ts')
const {getPlatformProxy}=await import('wrangler')
const proxy=await getPlatformProxy({persist:false})
try{
const DB=proxy.env.DB;for(const file of ['0001_identity.sql','0003_identity_credentials.sql','0005_widget_identity.sql','0008_account_sessions.sql','0070_management.sql','0097_owner_setup.sql'])for(const sql of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(file==='0097_owner_setup.sql'?/;\s*(?=(?:--|CREATE|INSERT)|$)/:';').filter(s=>s.trim()))await DB.prepare(sql).run()
const env=proxy.env
async function call(path,body,token){return routes.request('https://app.example'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},env)}
assert.equal((await call('/session')).status,401)
const bootstrap=await call('/bootstrap',{password:'test-setup-password-123',email:'owner@example.com',name:'Owner',allowedOrigin:'https://widget.example'});assert.equal(bootstrap.status,201);const owner=await bootstrap.json()
assert.equal((await call('/password',{currentPassword:'test-setup-password-123',password:'test-correct-horse-battery'},owner.token)).status,200)
assert.equal((await call('/session',undefined,owner.token)).status,401,'password change revokes setup session')
assert.equal((await call('/login',{email:'owner@example.com',password:'invalid-password'})).status,401)
const login=await call('/login',{email:'owner@example.com',password:'test-correct-horse-battery'});assert.equal(login.status,200);assert.match(login.headers.get('Set-Cookie'),/HttpOnly/);const session=await login.json()
assert.equal((await call('/switch-project',{projectId:'foreign'},session.token)).status,403)
const invitation=await (await call('/invitations',{email:'new@example.com'},session.token)).json();assert.equal((await call('/accept-token',{token:invitation.token,name:'New',password:'new-correct-horse-battery'})).status,200);assert.equal((await call('/accept-token',{token:invitation.token,name:'New',password:'new-correct-horse-battery'})).status,400)
const invited=await (await call('/login',{email:'new@example.com',password:'new-correct-horse-battery'})).json();assert.equal(invited.actor.projectId,owner.projectId)
const reset=await(await call('/password-reset',{userId:invited.actor.id},session.token)).json();assert.equal((await call('/accept-token',{token:reset.token,password:'reset-correct-horse-battery'})).status,200);assert.equal((await call('/session',undefined,invited.token)).status,401)
const project=await DB.prepare('SELECT widget_key FROM projects WHERE id=?').bind(owner.projectId).first()
assert.equal((await routes.request('https://app.example/widget/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.example'},body:JSON.stringify({widgetKey:project.widget_key})},env)).status,403)
await DB.prepare('UPDATE projects SET verification_secret=? WHERE id=?').bind('signature-secret',owner.projectId).run();const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('signature-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('customer-verified')))).map(x=>x.toString(16).padStart(2,'0')).join('');const widgetSession=async body=>routes.request('https://app.example/widget/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://widget.example'},body:JSON.stringify({widgetKey:project.widget_key,...body})},env);const verified1=await(await widgetSession({identifier:'customer-verified',contact_hash:signature})).json();const verified2=await(await widgetSession({identifier:'customer-verified',contact_hash:signature})).json();assert.equal(verified1.contactId,verified2.contactId);const unsigned=await(await widgetSession({identifier:'customer-verified'})).json();assert.notEqual(unsigned.contactId,verified1.contactId);assert.equal((await widgetSession({identifier:'customer-verified',contact_hash:'0'.repeat(64)})).status,403);await DB.prepare("UPDATE contacts SET metadata_json='{\"is_blocked\":true}' WHERE id=?").bind(verified1.contactId).run();assert.equal((await widgetSession({identifier:'customer-verified',contact_hash:signature})).status,403);assert.equal((await call('/session',undefined,verified1.token)).status,401)
await DB.prepare('DELETE FROM memberships WHERE user_id=?').bind(owner.userId).run();const account=await(await call('/login',{email:'owner@example.com',password:'test-correct-horse-battery'})).json();assert.equal(account.accountOnly,true);assert.equal(account.actor.projectId,null);assert.equal((await call('/session',undefined,account.token)).status,200)
console.log('Native identity: login, password/revocation, foreign project denial, invitation replay, reset revocation and widget origin passed against local D1')
}finally{await proxy.dispose()}
