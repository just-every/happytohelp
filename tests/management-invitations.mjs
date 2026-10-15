import test from 'node:test'
import assert from 'node:assert/strict'
import { openIdentityDb, seedWorkspace } from './helpers/identity-db.mjs'

// Pending invitations: list, copy link, resend and revoke, each re-checking the caller's role in the path's workspace.
const { routes } = await import('../src/modules/management/index.ts')
const { routes: identity } = await import('../src/modules/identity/routes.ts')
const db = await openIdentityDb()
const { DB } = db
const origin = 'https://app.example'
const emailEnv = { ...db.env, EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'fixture-key', EMAIL_FROM: 'HappyToHelp <support@example.test>' }
const plainEnv = { ...db.env, EMAIL_API_KEY: undefined, EMAIL_FROM: undefined }
const mail = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url !== 'https://api.resend.com/emails') throw new Error('Unexpected outbound request: ' + url)
  const body = JSON.parse(init.body)
  mail.push({ to: body.to[0], text: body.text, subject: body.subject })
  return Response.json({ id: 'email-' + mail.length })
}
test.after(async () => { globalThis.fetch = realFetch; await db.dispose() })

const acme = await seedWorkspace(DB, 'acme', { name: 'Acme Desk' })
const beta = await seedWorkspace(DB, 'beta')
const call = (path, { token, method, body, env = emailEnv, app = routes } = {}) => app.request(origin + path, {
  method: method || (body === undefined ? 'GET' : 'POST'),
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
}, env)
const json = async response => response.json()
const invite = async (workspace, email, role = 'operator', token = workspace.tokens.owner, env = emailEnv) => {
  const response = await call(`/projects/${workspace.projectId}/agents`, { token, body: { email, role }, env })
  assert.equal(response.status, 201, await response.clone().text())
  return (await json(response)).data
}
const tokenOf = url => new URL(url).searchParams.get('token')
const liveTokens = async (projectId, email) => (await DB.prepare("SELECT count(*) n FROM identity_tokens WHERE project_id=? AND lower(email)=? AND kind='invite' AND consumed_at IS NULL AND expires_at>?").bind(projectId, email, Date.now()).first()).n
const pendingRows = async (workspace, token = workspace.tokens.owner, env = emailEnv) => {
  const response = await call(`/projects/${workspace.projectId}/agents`, { token, env })
  assert.equal(response.status, 200)
  const body = await json(response)
  return { rows: body.data.filter(row => row.pending), emailConfigured: body.emailConfigured }
}
const acceptWithNewAccount = (url, name = 'New Person') => call('/accept-token', { app: identity, body: { token: tokenOf(url), name, password: 'synthetic-a-long-enough-password' } })

test('the pending list gives each invitation a stable id, its expiry and who may manage it', async () => {
  const created = await invite(acme, 'Pat@Example.test')
  await invite(acme, 'pat@example.test')
  await invite(acme, 'quinn@example.test', 'admin')
  const owner = await pendingRows(acme)
  assert.equal(owner.emailConfigured, true)
  assert.equal(owner.rows.length, 2, 'two links for one email are one row')
  const pat = owner.rows.find(row => row.email === 'pat@example.test')
  assert.equal(pat.invitation_id, 'pat@example.test')
  assert.equal(pat.role, 'operator')
  assert.ok(pat.expires_at > Date.now())
  assert.equal(owner.rows.every(row => row.canManage), true)
  const admin = await pendingRows(acme, acme.tokens.admin)
  assert.equal(admin.rows.find(row => row.email === 'pat@example.test').canManage, true)
  assert.equal(admin.rows.find(row => row.email === 'quinn@example.test').canManage, false, 'an admin cannot manage an admin invitation')
  const operator = await pendingRows(acme, acme.tokens.operator)
  assert.equal(operator.rows.every(row => row.canManage === false), true)
  assert.equal((await pendingRows(acme, acme.tokens.owner, plainEnv)).emailConfigured, false)
  assert.equal((await pendingRows(beta, beta.tokens.owner)).rows.length, 0, 'another workspace sees none of them')
  assert.match(created.invitationUrl, /\/accept-invitation\?token=/)
})

test('copy link issues a working link for the same workspace and email and leaves earlier links valid', async () => {
  const first = await invite(acme, 'copy@example.test')
  const response = await call(`/projects/${acme.projectId}/invitations/${encodeURIComponent('copy@example.test')}/link`, { token: acme.tokens.owner, method: 'POST' })
  assert.equal(response.status, 201)
  const copied = (await json(response)).data
  assert.equal(copied.email, 'copy@example.test')
  assert.equal(copied.role, 'operator')
  assert.notEqual(tokenOf(copied.invitationUrl), tokenOf(first.invitationUrl))
  assert.equal(await liveTokens(acme.projectId, 'copy@example.test'), 2)
  const preview = await call('/link-status', { app: identity, body: { kind: 'invitation', token: tokenOf(copied.invitationUrl) } })
  const status = await json(preview)
  assert.equal(status.state, 'valid')
  assert.equal(status.workspace, 'Acme Desk')
  assert.equal(status.email, 'copy@example.test')
  assert.equal(mail.filter(message => message.to === 'copy@example.test').length, 1, 'copying a link sends no email')
  assert.equal((await pendingRows(acme)).rows.filter(row => row.email === 'copy@example.test').length, 1, 'still one row')
})

test('resend mails a fresh working link to the invitee without duplicating the row', async () => {
  const first = await invite(acme, 'resend@example.test')
  const before = mail.length
  const response = await call(`/projects/${acme.projectId}/invitations/resend%40example.test/resend`, { token: acme.tokens.owner, method: 'POST' })
  assert.equal(response.status, 201, await response.clone().text())
  assert.equal((await json(response)).data.delivery, 'sent')
  assert.equal(mail.length, before + 1)
  const message = mail.at(-1)
  assert.equal(message.to, 'resend@example.test')
  const fresh = message.text.match(/https?:\/\/\S+/)[0]
  assert.notEqual(tokenOf(fresh), tokenOf(first.invitationUrl))
  assert.equal((await acceptWithNewAccount(fresh)).status, 200, 'the emailed link creates the account')
  const member = await DB.prepare("SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND u.email='resend@example.test'").bind(acme.projectId).first()
  assert.equal(member.role, 'operator')
  assert.equal((await pendingRows(acme)).rows.filter(row => row.email === 'resend@example.test').length, 0)
})

test('resend fails closed without an email provider and leaves no new link', async () => {
  const first = await invite(acme, 'noemail@example.test', 'operator', acme.tokens.owner, plainEnv)
  assert.equal(first.delivery, 'not_configured')
  const before = mail.length
  const response = await call(`/projects/${acme.projectId}/invitations/noemail%40example.test/resend`, { token: acme.tokens.owner, method: 'POST', env: plainEnv })
  assert.equal(response.status, 503)
  assert.match(await response.text(), /not configured/i)
  assert.equal(mail.length, before)
  assert.equal(await liveTokens(acme.projectId, 'noemail@example.test'), 1)
})

test('revoke removes the row and every link, and the revoked link can no longer create an account', async () => {
  const one = await invite(acme, 'revoke@example.test')
  const copied = (await json(await call(`/projects/${acme.projectId}/invitations/revoke%40example.test/link`, { token: acme.tokens.owner, method: 'POST' }))).data
  assert.equal(await liveTokens(acme.projectId, 'revoke@example.test'), 2)
  const response = await call(`/projects/${acme.projectId}/invitations/revoke%40example.test`, { token: acme.tokens.owner, method: 'DELETE' })
  assert.equal(response.status, 200)
  assert.equal(await liveTokens(acme.projectId, 'revoke@example.test'), 0)
  assert.equal((await pendingRows(acme)).rows.some(row => row.email === 'revoke@example.test'), false)
  for (const url of [one.invitationUrl, copied.invitationUrl]) {
    assert.equal((await acceptWithNewAccount(url)).status, 400)
    assert.equal((await json(await call('/link-status', { app: identity, body: { kind: 'invitation', token: tokenOf(url) } }))).state, 'invalid')
  }
  assert.equal(await DB.prepare("SELECT 1 FROM users WHERE email='revoke@example.test'").first(), null)
  assert.equal((await call(`/projects/${acme.projectId}/invitations/revoke%40example.test`, { token: acme.tokens.owner, method: 'DELETE' })).status, 404, 'a second revoke finds nothing')
})

for (const action of [
  { name: 'revoke', method: 'DELETE', suffix: '' },
  { name: 'copy link', method: 'POST', suffix: '/link' },
  { name: 'resend', method: 'POST', suffix: '/resend' },
]) {
  test(`${action.name} re-checks the caller: signed-out, operators, other workspaces and admins on elevated invitations are refused`, async () => {
    const email = `guard-${action.name.replace(' ', '-')}@example.test`
    await invite(acme, email)
    const elevated = `admin-${action.name.replace(' ', '-')}@example.test`
    await invite(acme, elevated, 'admin')
    const mailBefore = mail.length, linksBefore = await liveTokens(acme.projectId, email)
    const path = (workspace, who) => `/projects/${workspace.projectId}/invitations/${encodeURIComponent(who)}${action.suffix}`
    const refused = async (label, response, ...statuses) => assert.ok(statuses.includes(response.status), `${label}: ${response.status}`)
    await refused('signed out', await call(path(acme, email), { method: action.method }), 401)
    await refused('operator', await call(path(acme, email), { token: acme.tokens.operator, method: action.method }), 403)
    await refused('other workspace owner on this path', await call(path(acme, email), { token: beta.tokens.owner, method: action.method }), 403)
    await refused('other workspace owner on their own path with this row', await call(path(beta, email), { token: beta.tokens.owner, method: action.method }), 404)
    await refused('admin on an admin invitation', await call(path(acme, elevated), { token: acme.tokens.admin, method: action.method }), 403)
    assert.equal(await liveTokens(acme.projectId, email), linksBefore, 'nothing changed')
    assert.equal(await liveTokens(acme.projectId, elevated), 1)
    assert.equal(mail.length, mailBefore, 'nothing was mailed')
    assert.equal(await liveTokens(beta.projectId, email), 0)
    const owner = await call(path(acme, elevated), { token: acme.tokens.owner, method: action.method })
    assert.ok(owner.status === 200 || owner.status === 201, `owner on an admin invitation: ${owner.status}`)
    const admin = await call(path(acme, email), { token: acme.tokens.admin, method: action.method })
    assert.ok(admin.status === 200 || admin.status === 201, `admin on an operator invitation: ${admin.status}`)
  })
}

test('an invitation cannot be managed after it was accepted or expired', async () => {
  const accepted = await invite(acme, 'taken@example.test')
  assert.equal((await acceptWithNewAccount(accepted.invitationUrl)).status, 200)
  await invite(acme, 'late@example.test')
  await DB.prepare('UPDATE identity_tokens SET expires_at=? WHERE lower(email)=?').bind(Date.now() - 1000, 'late@example.test').run()
  for (const email of ['taken@example.test', 'late@example.test']) {
    for (const [method, suffix] of [['DELETE', ''], ['POST', '/link'], ['POST', '/resend']]) {
      assert.equal((await call(`/projects/${acme.projectId}/invitations/${encodeURIComponent(email)}${suffix}`, { token: acme.tokens.owner, method })).status, 404, `${method}${suffix} ${email}`)
    }
  }
})
