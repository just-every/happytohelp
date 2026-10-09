import test from 'node:test'
import assert from 'node:assert/strict'
import { openIdentityDb, seedWorkspace, sha } from './helpers/identity-db.mjs'

// What the public identity pages learn before they ask a visitor to do anything: install state, link state, recovery rules.
const { routes } = await import('../src/modules/identity/routes.ts')
const { routes: management } = await import('../src/modules/management/index.ts')
const db = await openIdentityDb()
const { DB } = db
const origin = 'https://app.example'
const plain = { ...db.env, EMAIL_API_KEY: undefined, EMAIL_FROM: undefined, REGISTRATION_ENABLED: undefined, APP_ORIGIN: undefined }
const configured = { ...plain, EMAIL_API_KEY: 'fixture-key', EMAIL_FROM: 'HappyToHelp <support@example.test>', APP_ORIGIN: origin, REGISTRATION_ENABLED: 'true' }
const mail = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url !== 'https://api.resend.com/emails') throw new Error('Unexpected outbound request: ' + url)
  const body = JSON.parse(init.body)
  mail.push({ to: body.to[0], text: body.text })
  return Response.json({ id: 'email-' + mail.length })
}
test.after(async () => { globalThis.fetch = realFetch; await db.dispose() })

const call = (path, { body, token, env = plain, app = routes } = {}) => app.request(origin + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
}, env)
const status = async (kind, token, options = {}) => (await call('/link-status', { body: { kind, token }, ...options })).json()
const tokenOf = url => new URL(url).searchParams.get('token')

test('auth options report an unclaimed install, then a claimed one, and what the deployment can deliver', async () => {
  assert.deepEqual(await (await call('/auth-options')).json(), { setupRequired: true, registrationAvailable: false, recoveryAvailable: false })
  const response = await call('/auth-options', { env: configured })
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await response.json(), { setupRequired: true, registrationAvailable: false, recoveryAvailable: true }, 'sign-up waits for the first owner')
  const early = await call('/register', { body: { name: 'X', email: 'x@example.test', password: 'a-long-enough-password', projectName: 'X', allowedOrigin: 'https://x.example' }, env: configured })
  assert.equal(early.status, 503)
  assert.match(await early.text(), /Set up this installation first/)
  assert.equal((await DB.prepare('SELECT count(*) n FROM registrations').first()).n, 0, 'nothing was stored or mailed')
  assert.equal(mail.length, 0)
  const acme = await seedWorkspace(DB, 'acme', { name: 'Acme Desk' })
  assert.deepEqual(await (await call('/auth-options', { env: configured })).json(), { setupRequired: false, registrationAvailable: true, recoveryAvailable: true })
  assert.equal((await (await call('/auth-options', { env: { ...configured, REGISTRATION_ENABLED: 'false' } })).json()).registrationAvailable, false, 'the switch is required')
  assert.equal((await (await call('/auth-options', { env: { ...configured, APP_ORIGIN: undefined } })).json()).registrationAvailable, false, 'the link origin is required')
  assert.equal((await (await call('/auth-options', { env: { ...plain, REGISTRATION_ENABLED: 'true' } })).json()).registrationAvailable, false, 'email delivery is required')
  assert.ok(acme.projectId)
})

test('registration and recovery refuse, with a plain reason, when the deployment cannot deliver mail', async () => {
  const forgot = await call('/forgot-password', { body: { email: 'owner-acme@example.test' } })
  assert.equal(forgot.status, 503)
  assert.match(await forgot.text(), /workspace owner must reset your password/)
  assert.equal((await DB.prepare("SELECT count(*) n FROM identity_tokens WHERE kind='reset'").first()).n, 0, 'no reset token is written')
  assert.equal((await call('/register', { body: { name: 'X', email: 'x@example.test', password: 'a-long-enough-password', projectName: 'X', allowedOrigin: 'https://x.example' } })).status, 503)
  assert.equal(mail.length, 0)
})

test('forgot-password with mail configured answers every address alike and mails only the real account', async () => {
  const known = await call('/forgot-password', { body: { email: 'owner-acme@example.test' }, env: configured })
  const unknown = await call('/forgot-password', { body: { email: 'nobody@example.test' }, env: configured })
  assert.equal(known.status, 200)
  assert.equal(unknown.status, 200)
  assert.deepEqual(await known.json(), await unknown.json())
  assert.deepEqual(mail.map(message => message.to), ['owner-acme@example.test'])
  const reset = await status('reset', tokenOf(mail[0].text.match(/https?:\/\/\S+/)[0]))
  assert.deepEqual(reset, { state: 'valid', email: 'owner-acme@example.test' })
})

test('every link kind reports missing, invalid, expired and used states before anything is consumed', async () => {
  for (const kind of ['invitation', 'reset', 'verify-email']) {
    assert.deepEqual(await status(kind, ''), { state: 'missing' }, kind)
    assert.deepEqual(await status(kind, null), { state: 'missing' }, kind)
    assert.deepEqual(await status(kind, 'not-a-real-token'), { state: 'invalid' }, kind)
    assert.deepEqual(await status(kind, 'x'.repeat(600)), { state: 'invalid' }, kind)
  }
  assert.equal((await call('/link-status', { body: { kind: 'other', token: 'x' } })).status, 400)
  const sign = async (table, token, columns) => { await DB.prepare(`INSERT INTO ${table} VALUES(${columns.map(() => '?').join(',')})`).bind(...columns).run(); return token }
  // Verification links from sign-up.
  await sign('registrations', 'verify-live', [sha('verify-live'), 'new@example.test', 'New', 'hash', 'New Works', 'https://new.example', Date.now() + 60000, null])
  await sign('registrations', 'verify-used', [sha('verify-used'), 'used@example.test', 'U', 'hash', 'Used Works', 'https://u.example', Date.now() + 60000, Date.now()])
  await sign('registrations', 'verify-old', [sha('verify-old'), 'old@example.test', 'O', 'hash', 'Old Works', 'https://o.example', Date.now() - 1, null])
  assert.deepEqual(await status('verify-email', 'verify-live'), { state: 'valid', email: 'new@example.test', workspace: 'New Works' })
  assert.deepEqual(await status('verify-email', 'verify-used'), { state: 'used' })
  assert.deepEqual(await status('verify-email', 'verify-old'), { state: 'expired' })
  assert.equal((await DB.prepare("SELECT count(*) n FROM users WHERE email='new@example.test'").first()).n, 0, 'checking a link creates nothing')
  // A reset link is not an invitation and an invitation is not a reset link.
  assert.equal((await status('invitation', tokenOf(mail[0].text.match(/https?:\/\/\S+/)[0]))).state, 'invalid')
})

test('an invitation link names the workspace and email, tells a new person from an account holder, and spots the wrong account', async () => {
  const acme = await seedWorkspace(DB, 'invite', { name: 'Invite Desk' })
  const send = email => management.request(`${origin}/projects/${acme.projectId}/agents`, { method: 'POST', headers: { Authorization: 'Bearer ' + acme.tokens.owner, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }, plain)
  const invite = async email => {
    const response = await send(email)
    assert.equal(response.status, 201)
    return tokenOf((await response.json()).data.invitationUrl)
  }
  const fresh = await invite('fresh@example.test')
  const open = await status('invitation', fresh)
  assert.equal(open.state, 'valid')
  assert.equal(open.workspace, 'Invite Desk')
  assert.equal(open.email, 'fresh@example.test')
  assert.equal(open.role, 'operator')
  assert.equal(open.accountExists, false)
  assert.equal(open.projectId, acme.projectId)
  assert.deepEqual(open.viewer, { signedIn: false, email: null, matches: false })
  // Somebody already holding an account is sent to sign in; the owner's session makes them the wrong account.
  assert.equal((await send('operator-invite@example.test')).status, 409, 'an existing member cannot be invited again')
  await DB.prepare("INSERT INTO users(id,email,name,created_at) VALUES('holder','holder@example.test','Holder',1)").run()
  const forHolder = await invite('holder@example.test')
  const known = await status('invitation', forHolder)
  assert.equal(known.accountExists, true)
  const wrong = await status('invitation', forHolder, { token: acme.tokens.owner })
  assert.deepEqual(wrong.viewer, { signedIn: true, email: 'owner-invite@example.test', matches: false })
  await DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,'holder',NULL,'operator',?)").bind(sha('holder-token'), Date.now() + 60000).run()
  assert.deepEqual((await status('invitation', forHolder, { token: 'holder-token' })).viewer, { signedIn: true, email: 'holder@example.test', matches: true })
  // The signed-in invitee accepts; the link is then used and the membership exists.
  const accepted = await call('/accept-invitation', { body: { token: forHolder }, token: 'holder-token' })
  assert.equal(accepted.status, 200)
  assert.deepEqual(await status('invitation', forHolder), { state: 'used' })
  assert.equal((await DB.prepare("SELECT role FROM memberships WHERE project_id=? AND user_id='holder'").bind(acme.projectId).first()).role, 'operator')
  // Expiry and deletion of the workspace both end the link.
  const late = await invite('late@example.test')
  await DB.prepare("UPDATE identity_tokens SET expires_at=1 WHERE lower(email)='late@example.test'").run()
  assert.deepEqual(await status('invitation', late), { state: 'expired' })
  const doomed = await invite('doomed@example.test')
  await DB.prepare("INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,1) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json").bind(acme.projectId, JSON.stringify({ deleted_at: 1 })).run()
  assert.deepEqual(await status('invitation', doomed), { state: 'invalid' })
})

test('accepting an invitation link retires the other links issued for the same email', async () => {
  const acme = await seedWorkspace(DB, 'siblings', { name: 'Sibling Desk' })
  const issue = async () => {
    const response = await management.request(`${origin}/projects/${acme.projectId}/agents`, { method: 'POST', headers: { Authorization: 'Bearer ' + acme.tokens.owner, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'twice@example.test' }) }, plain)
    return tokenOf((await response.json()).data.invitationUrl)
  }
  const [first, second] = [await issue(), await issue()]
  assert.equal((await call('/accept-token', { body: { token: first, name: 'Twice', password: 'a-long-enough-password' } })).status, 200)
  assert.deepEqual(await status('invitation', second), { state: 'used' })
  assert.equal((await call('/accept-token', { body: { token: second, name: 'Twice', password: 'a-long-enough-password' } })).status, 400)
})
