import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { openIdentityDb, seedWorkspace, sha } from './helpers/identity-db.mjs'
const { routes } = await import('../src/modules/identity/routes.ts')
const db = await openIdentityDb(), { DB } = db
for (const sql of (await readFile('migrations/0109_magic_signins.sql', 'utf8')).split(';').filter(x => x.trim())) await DB.prepare(sql).run()
const origin = 'https://app.example', mail = [], originalFetch = globalThis.fetch
const env = { ...db.env, EMAIL_PROVIDER: 'sendgrid', EMAIL_API_KEY: 'fixture-key', EMAIL_FROM: 'support@example.test', APP_ORIGIN: origin }
let rejectMail = false
globalThis.fetch = async (input, init) => {
 assert.equal(String(input instanceof Request ? input.url : input), 'https://api.sendgrid.com/v3/mail/send')
 if (rejectMail) return new Response('rejected', { status: 400 })
 mail.push(JSON.parse(init.body))
 return new Response(null, { status: 202, headers: { 'x-message-id': 'fixture-' + mail.length } })
}
test.after(async () => { globalThis.fetch = originalFetch; await db.dispose() })
const call = async (path, body, extra = {}) => {
 const pending = []
 const response = await routes.request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.1', ...extra.headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, extra.env || env, { waitUntil: task => pending.push(task), passThroughOnException() {} })
 await Promise.all(pending)
 return response
}
const request = email => call('/magic-link', { email })
const consume = token => call('/magic-link/consume', { token })
const emailedToken = () => new URLSearchParams(new URL(mail.at(-1).content.find(c => c.type === 'text/plain').value.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('token')
const seedToken = async (key, { expires = Date.now() + 60000, consumed = null } = {}) => {
 const ws = await seedWorkspace(DB, key), token = sha('capability-' + key)
 await DB.prepare('INSERT INTO magic_signins VALUES(?,?,?,?,?,?)').bind(sha(token), 'owner-' + key, ws.projectId, 'owner-' + key + '@example.test', expires, consumed).run()
 return { ...ws, token }
}
test('configured SendGrid issues a bounded hashed token, no GET consumption, and native HttpOnly session', async () => {
 await seedWorkspace(DB, 'magic')
 const response = await request(' Owner-Magic@example.test ')
 assert.equal(response.status, 202)
 const unknown = await request('unknown@example.test')
 assert.equal(unknown.status, response.status)
 assert.deepEqual(await unknown.json(), await response.json())
 assert.equal(mail.length, 1)
 const token = emailedToken(), row = await DB.prepare('SELECT * FROM magic_signins').first()
 assert.equal(row.token_hash, sha(token)); assert.notEqual(row.token_hash, token)
 assert.ok(row.expires_at > Date.now() + 14 * 60000 && row.expires_at <= Date.now() + 15 * 60000)
 assert.equal((await call('/magic-link/consume?token=' + token)).status, 404)
 assert.equal((await DB.prepare('SELECT consumed_at FROM magic_signins').first()).consumed_at, null)
 const signedIn = await consume(token)
 assert.equal(signedIn.status, 200)
 assert.deepEqual(await signedIn.json(), { signedIn: true, destination: '/conversations' })
 const cookie = signedIn.headers.get('Set-Cookie')
 assert.match(cookie, /HttpOnly; Secure; SameSite=Lax; Max-Age=86400/)
 const session = await routes.request(origin + '/session', { headers: { Cookie: cookie.split(';')[0] } }, env)
 assert.equal(session.status, 200); assert.equal((await session.json()).projectId, 'p-magic')
 assert.equal((await consume(token)).status, 400)
})
test('only one concurrent redemption creates a session; redirect input cannot change the destination', async () => {
 const { token } = await seedToken('concurrent')
 const before = (await DB.prepare('SELECT count(*) n FROM sessions').first()).n
 const results = await Promise.all(Array.from({ length: 6 }, () => call('/magic-link/consume', { token, returnTo: 'https://evil.example' })))
 assert.deepEqual(results.map(r => r.status).sort(), [200, 400, 400, 400, 400, 400])
 assert.equal((await DB.prepare('SELECT count(*) n FROM sessions').first()).n, before + 1)
 assert.equal((await results.find(r => r.status === 200).json()).destination, '/conversations')
})
test('expired, spent, malformed and foreign token kinds fail without sessions', async () => {
 const expired = await seedToken('expired', { expires: Date.now() - 1 }), spent = await seedToken('spent', { consumed: 1 })
 const before = (await DB.prepare('SELECT count(*) n FROM sessions').first()).n
 for (const token of [expired.token, spent.token, '', null, 'x'.repeat(5000), {}, sha('unknown')]) assert.equal((await consume(token)).status, 400)
 assert.equal((await DB.prepare('SELECT count(*) n FROM sessions').first()).n, before)
})
test('membership removal, deleted project and changed email invalidate outstanding sign-in', async () => {
 const removed = await seedToken('removed'), deleted = await seedToken('deleted'), changed = await seedToken('changed')
 await DB.prepare('DELETE FROM memberships WHERE user_id=?').bind('owner-removed').run()
 await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(deleted.projectId, JSON.stringify({ deleted_at: 1 }), Date.now()).run()
 await DB.prepare("UPDATE users SET email='new@example.test' WHERE id='owner-changed'").run()
 for (const item of [removed, deleted, changed]) assert.equal((await consume(item.token)).status, 400)
 const count = mail.length
 assert.equal((await request('owner-deleted@example.test')).status, 202)
 assert.equal(mail.length, count)
})
test('current role is used, and ordinary session revocation remains enforced', async () => {
 const { token } = await seedToken('role')
 await DB.prepare("UPDATE memberships SET role='operator' WHERE user_id='owner-role'").run()
 const result = await consume(token), cookie = result.headers.get('Set-Cookie').split(';')[0]
 const read = () => routes.request(origin + '/session', { headers: { Cookie: cookie } }, env)
 assert.equal((await (await read()).json()).role, 'operator')
 await DB.prepare("UPDATE sessions SET revoked_at=1 WHERE actor_id='owner-role'").run()
 assert.equal((await read()).status, 401)
})
test('origin and provider availability are explicit, no raw tokens escape responses', async () => {
 const count = mail.length
 for (const APP_ORIGIN of [undefined, 'https://evil.example/path', 'javascript:alert(1)', 'http://public.example', 'https://user:pass@app.example']) {
  assert.equal((await call('/magic-link', { email: 'owner-magic@example.test' }, { env: { ...env, APP_ORIGIN } })).status, 503)
 }
 assert.equal((await call('/magic-link', { email: 'owner-magic@example.test' }, { env: { ...env, EMAIL_API_KEY: undefined } })).status, 503)
 assert.equal((await call('/magic-link', { email: 'owner-magic@example.test' }, { headers: { Origin: 'https://evil.example' } })).status, 403)
 assert.equal((await call('/magic-link/consume', { token: sha('not-used') }, { headers: { Origin: 'https://evil.example' } })).status, 403)
 assert.equal((await request('malformed')).status, 400)
 assert.equal(mail.length, count)
})
test('provider rejection does not disclose existence and invalidates the unusable capability', async () => {
 await seedWorkspace(DB, 'rejected'); rejectMail = true
 const known = await request('owner-rejected@example.test'), unknown = await request('unknown-rejected@example.test')
 assert.equal(known.status, 202); assert.deepEqual(await known.json(), await unknown.json())
 assert.ok((await DB.prepare("SELECT consumed_at FROM magic_signins WHERE user_id='owner-rejected'").first()).consumed_at)
 rejectMail = false
})
test('known and unknown addresses have identical atomic rate limits', async () => {
 await seedWorkspace(DB, 'limited')
 for (const email of ['owner-limited@example.test', 'unknown-limited@example.test']) {
  const responses = await Promise.all(Array.from({ length: 6 }, () => request(email)))
  assert.deepEqual(responses.map(r => r.status).sort(), [202, 202, 202, 202, 202, 429])
  assert.equal(responses.find(r => r.status === 429).headers.get('Retry-After'), '3600')
 }
})

test('account-only users can sign in without recovering revoked workspace membership', async () => {
 const response = await request('owner-removed@example.test'); assert.equal(response.status,202)
 const signed = await consume(emailedToken()); assert.equal(signed.status,200)
 const cookie = signed.headers.get('Set-Cookie').split(';')[0]
 const current = await routes.request(origin+'/session',{headers:{Cookie:cookie}},env)
 assert.equal(current.status,200); assert.equal((await current.json()).projectId,'')
})

test('IPv6 clients share a /64 request budget, independent of account existence', async () => {
 for(let i=0;i<31;i++){
  const response=await call('/magic-link',{email:`unknown-v6-${i}@example.test`},{headers:{'CF-Connecting-IP':`2001:db8:abcd:12::${i+1}`}})
  assert.equal(response.status,i<30?202:429)
 }
})
test('email transport latency and unknown outcome stay outside the neutral request', async () => {
 await seedWorkspace(DB,'deferred')
 let release,started;const entered=new Promise(r=>started=r),held=new Promise(r=>release=r),pending=[]
 const currentFetch=globalThis.fetch
 globalThis.fetch=async()=>{started();await held;throw Error('connection lost after submission')}
 try {
  const response=await routes.request(origin+'/magic-link',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.10'},body:JSON.stringify({email:'owner-deferred@example.test'})},env,{waitUntil:p=>pending.push(p),passThroughOnException(){}})
  assert.equal(response.status,202);assert.equal(pending.length,1);await entered;release();await Promise.all(pending)
  const receipt=await DB.prepare("SELECT state FROM email_deliveries WHERE recipient='owner-deferred@example.test'").first()
  assert.equal(receipt.state,'uncertain')
  assert.ok((await DB.prepare("SELECT consumed_at FROM magic_signins WHERE user_id='owner-deferred'").first()).consumed_at)
 }finally{release?.();globalThis.fetch=currentFetch}
})
test('safe returnTo resumes the native destination; account-only sign-in defaults to project creation', async () => {
 const normal=await seedToken('destination')
 const response=await call('/magic-link/consume',{token:normal.token,returnTo:'/projects/create'})
 assert.equal(response.status,200);assert.equal((await response.json()).destination,'/projects/create')
 await DB.prepare("INSERT INTO users(id,email,name,created_at) VALUES('standalone','standalone@example.test','Standalone',?)").bind(Date.now()).run()
 const token=sha('standalone-capability');await DB.prepare('INSERT INTO magic_signins VALUES(?,?,NULL,?,?,NULL)').bind(sha(token),'standalone','standalone@example.test',Date.now()+60000).run()
 const account=await call('/magic-link/consume',{token,returnTo:'//evil.example'})
 assert.equal(account.status,200);assert.equal((await account.json()).destination,'/projects/create')
})
