// Workspace provisioning through public routes on the real application Worker: real D1, queue consumer and Durable
// Objects. Only the network edge is faked: the AI provider, the email provider and anything the site read fetches.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readdir, readFile} from 'node:fs/promises'
import {migrationStatements} from './helpers/migration-statements.mjs'

const require = createRequire(import.meta.url)
const {build} = require(require.resolve('esbuild', {paths: [require.resolve('wrangler')]}))
const {Miniflare, convertV4MiniflareOptions} = require(require.resolve('miniflare', {paths: [require.resolve('wrangler')]}))

const worker = `import {app} from './src/app'
import {consumeQueue} from './src/queue'
export {ConversationSocket} from './src/modules/conversations/socket'
export default {fetch: (request, env, context) => app.fetch(request, env, context), queue: (batch, env) => consumeQueue(batch, env)}`
const bundle = build({stdin: {contents: worker, resolveDir: process.cwd(), loader: 'ts'}, bundle: true, write: false, format: 'esm', platform: 'node', external: ['cloudflare:workers', 'node:*'], loader: {'.sql': 'text'}, logLevel: 'silent'})

async function migrationFiles() {
 const files = (await readdir('migrations')).filter(name => name.endsWith('.sql')).map(name => `migrations/${name}`)
 for (const module of await readdir('src/modules', {withFileTypes: true})) {
  if (!module.isDirectory()) continue
  const directory = `src/modules/${module.name}/migrations`
  try { for (const name of await readdir(directory)) if (name.endsWith('.sql')) files.push(`${directory}/${name}`) } catch (error) { if (error.code !== 'ENOENT') throw error }
 }
 const name = path => path.split('/').pop()
 return files.sort((a, b) => name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : 0)
}

// The provider edge: OpenAI answers a streamed reply, Resend accepts mail; nothing else is reachable.
function edge(log) {
 return async request => {
  const url = new URL(request.url)
  if (url.host === 'api.openai.com') {
   log.push({provider: 'openai', path: url.pathname})
   const text = 'Our help article says returns are free within 30 days.'
   const events = [{type: 'response.output_text.delta', item_id: 'msg1', delta: text}, {type: 'response.output_text.done', item_id: 'msg1', text}, {type: 'response.completed', response: {usage: {input_tokens: 5, output_tokens: 9, total_tokens: 14, input_tokens_details: {cached_tokens: 0, cache_write_tokens: 0}, output_tokens_details: {reasoning_tokens: 0}}}}]
   return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {headers: {'content-type': 'text/event-stream'}})
  }
  if (url.host === 'api.resend.com' && url.pathname === '/emails') {
   const body = await request.json()
   log.push({provider: 'resend', to: body.to, text: body.text})
   return Response.json({id: `fixture-${log.length}`})
  }
  log.push({unreachable: url.host})
  return new Response('Not reachable from this test', {status: 503})
 }
}

async function start(name, bindings) {
 const script = (await bundle).outputFiles[0].text, log = []
 const mf = new Miniflare(convertV4MiniflareOptions({
  name, modules: true, script, compatibilityDate: '2026-09-14', compatibilityFlags: ['nodejs_compat'],
  bindings: {H2H_SETUP_TOKEN: 'provisioning-setup-token', RATE_LIMITS: JSON.stringify({projectsPerAccountDay: 100, projectsPerIpDay: 100, registrationsPerIpDay: 100, widgetSessionsPerIpHour: 100}), ...bindings},
  d1Databases: ['DB'], r2Buckets: ['FILES'], queueProducers: {JOBS: {queueName: `${name}-jobs`}},
  queueConsumers: {[`${name}-jobs`]: {maxBatchSize: 1, maxBatchTimeout: 0, maxRetries: 0}},
  durableObjects: {CONVERSATIONS: {className: 'ConversationSocket', useSQLite: true}}, outboundService: edge(log),
 }))
 try {
  const db = await mf.getD1Database('DB')
  for (const file of await migrationFiles()) for (const statement of migrationStatements(await readFile(file, 'utf8'))) {
   try { await db.prepare(statement).run() } catch (error) { throw new Error(`${file}: ${error}`) }
  }
  const call = async (path, {body, token, method, origin} = {}) => {
   const response = await mf.dispatchFetch('https://app.example' + path, {method: method || (body === undefined ? 'GET' : 'POST'), headers: {...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...(token ? {Authorization: 'Bearer ' + token} : {}), Origin: origin || 'https://app.example'}, body: body === undefined ? undefined : JSON.stringify(body)})
   const text = await response.text()
   let json = null; try { json = JSON.parse(text) } catch {}
   return {status: response.status, body: json, text}
  }
  const owner = await call('/api/identity/bootstrap', {body: {name: 'Owner workspace', email: `owner@${name}.example`, password: 'provisioning-owner-password-123', allowedOrigin: 'https://owner.example', setupToken: 'provisioning-setup-token'}})
  assert.equal(owner.status, 201, owner.text)
  return {mf, db, log, call, owner: owner.body}
 } catch (error) { await mf.dispose(); throw error }
}

const ok = (response, status = 200) => { assert.equal(response.status, status, response.text); return response.body }
const settingsOf = async (call, token, projectId) => ok(await call(`/api/management/projects/${projectId}/settings`, {token})).data
const assistantsOf = async (call, token, projectId) => ok(await call(`/api/management/projects/${projectId}/ais`, {token})).data
const mailboxOf = async (call, token, projectId) => ok(await call(`/api/management/projects/${projectId}/email-settings`, {token})).data
const newWorkspace = async (call, token, name, origin) => ok(await call('/api/management/projects', {body: {name, allowed_origin: origin}, token}), 201)

/** One enabled starter, the default for visitors and signed-in users, and a marker that records exactly what it was created with. */
async function assertStarter(call, token, projectId) {
 const assistants = await assistantsOf(call, token, projectId)
 assert.equal(assistants.length, 1, 'exactly one assistant')
 const [starter] = assistants
 assert.equal(starter.is_enabled, 1)
 for (const field of ['name', 'role', 'prompt', 'model']) assert.ok(String(starter[field]).trim(), `starter ${field}`)
 const settings = await settingsOf(call, token, projectId)
 for (const key of ['default_visitor_ai_id', 'default_responder', 'default_verified_user_ai_id']) assert.equal(settings[key], starter.id, key)
 assert.deepEqual(settings.starter_ai, {id: starter.id, seed: {name: starter.name, role: starter.role, prompt: starter.prompt, model: starter.model, is_enabled: true}})
 assert.equal('ai_reply_mode' in settings, false, 'the starter answers by itself; there is no reply mode')
 return {starter, settings}
}

async function visitor(call, token, projectId, origin) {
 const workspace = ok(await call('/api/management/projects', {token})).data.find(row => row.id === projectId)
 const session = ok(await call('/api/identity/widget/session', {body: {widgetKey: workspace.widget_key, name: 'Visitor'}, origin}), 201)
 const conversation = ok(await call('/api/conversations', {body: {projectId}, token: session.token, origin}), 201)
 const say = async content => {
  const transcript = ok(await call(`/api/conversations/${conversation.id}/messages`, {token: session.token, origin}))
  return ok(await call(`/api/conversations/${conversation.id}/messages`, {body: {localId: content, content, expectedRevision: transcript.revision}, token: session.token, origin}))
 }
 return {conversation, session, say}
}

const settle = async (check, what) => {
 for (let attempt = 0; attempt < 100; attempt++) { const value = await check(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 150)) }
 assert.fail(`${what} did not happen`)
}

test('without an AI key a new workspace is set up, keeps visitors with the team and fails nothing', async () => {
 const {mf, db, log, call, owner} = await start('no-key', {INBOUND_EMAIL_TOKEN: 'a'.repeat(64)})
 try {
  const token = owner.token, origin = 'https://www.acme-outdoors.example'
  const first = await newWorkspace(call, token, 'Acme Outdoors', origin)
  const {starter} = await assertStarter(call, token, first.id)

  // Its mailbox is on the website's own domain and stays off until this installation can send mail.
  const mailbox = await mailboxOf(call, token, first.id)
  assert.equal(mailbox.email_to_address, 'acme-outdoors@in.acme-outdoors.example')
  assert.equal(mailbox.is_enabled, 0)
  // Without an installation sender nothing can be sent; the row holds the website's own address, also proposed.
  assert.equal(mailbox.from_address, 'support@acme-outdoors.example')
  assert.equal((await settingsOf(call, token, first.id)).proposed_sender, 'support@acme-outdoors.example')
  // A same-name workspace gets its own mailbox inside its creation, never a conflict.
  const twin = await newWorkspace(call, token, 'Acme Outdoors', origin)
  const twinMailbox = await mailboxOf(call, token, twin.id)
  assert.ok(twinMailbox.email_to_address.endsWith('@in.acme-outdoors.example'))
  assert.notEqual(twinMailbox.email_to_address, mailbox.email_to_address)

  // The AI page names the key the starter waits for, and nothing about the key itself.
  const readiness = ok(await call(`/api/management/projects/${first.id}/ai`, {token})).data
  assert.equal(readiness.assistant.id, starter.id)
  assert.equal(readiness.ready, false)
  assert.match(readiness.secretName, /^[A-Z]+_API_KEY$/)

  // A visitor's conversation stays with the humans: no assistant takes it, no reply is requested, nothing fails.
  const chat = await visitor(call, token, first.id, origin)
  const sent = await chat.say('Can I return my tent?')
  assert.equal(sent.accepted, true)
  assert.equal(sent.generationError, undefined)
  assert.equal((await db.prepare('SELECT count(*) n FROM ai_generations WHERE conversation_id=?').bind(chat.conversation.id).first()).n, 0)
  assert.equal(await db.prepare('SELECT ai_id FROM conversation_ai WHERE conversation_id=?').bind(chat.conversation.id).first(), null)
  const counts = ok(await call(`/api/dashboard/projects/${first.id}/conversations/counts`, {token})).data
  assert.equal(counts.unassigned, 1)
  assert.equal(counts.ai, 0)

  // Asking for AI explicitly still fails explicitly, naming the missing secret (AI-001).
  const operator = ok(await call('/api/identity/switch-project', {body: {projectId: first.id}, token})).token
  const revision = ok(await call(`/api/conversations/${chat.conversation.id}/messages`, {token: operator})).revision
  const suggestion = await call(`/api/ai-support/projects/${first.id}/conversations/${chat.conversation.id}/suggestions`, {body: {expectedRevision: revision}, token: operator})
  assert.equal(suggestion.status, 409)
  assert.match(suggestion.body.error, new RegExp(`CONFIGURATION_REQUIRED: ${readiness.secretName}`))
  const reply = await call(`/api/ai-support/projects/${first.id}/conversations/${chat.conversation.id}/generations`, {body: {expectedRevision: revision}, token: operator})
  assert.equal(reply.status, 409)
  assert.match(reply.body.error, /CONFIGURATION_REQUIRED/)
  assert.ok(!log.some(entry => entry.provider === 'openai'), 'no provider request without a key')

  // The site read is queued after creation and its record joins the settings without displacing the defaults.
  const read = await settle(async () => { const settings = await settingsOf(call, token, first.id); return settings.site_read && !['queued', 'running'].includes(settings.site_read.state) && settings }, 'the site read')
  assert.equal(read.default_visitor_ai_id, starter.id)

  // Owner edits stand: the marker still records what was created, so an edited starter is told apart from an untouched one.
  ok(await call(`/api/management/projects/${first.id}/ais/${starter.id}`, {method: 'PUT', body: {prompt: 'Answer in the owner\'s own words.'}, token}))
  ok(await call(`/api/management/projects/${first.id}/ai`, {method: 'PUT', body: {default_visitor_ai_id: '-'}, token}))
  const edited = await settingsOf(call, token, first.id)
  assert.equal(edited.default_visitor_ai_id, null)
  assert.equal(edited.starter_ai.seed.prompt, starter.prompt)
  assert.equal((await assistantsOf(call, token, first.id))[0].prompt, 'Answer in the owner\'s own words.')
 } finally { await mf.dispose() }
})

test('with a key and mail, a registered workspace answers visitors by itself within the daily ceiling', async () => {
 const {mf, db, log, call} = await start('keyed', {
  OPENAI_API_KEY: 'test-only-openai-key', AI_DAILY_CEILINGS: JSON.stringify({repliesPerProject: 1}),
  EMAIL_API_KEY: 'test-only-resend-key', EMAIL_FROM: 'HappyToHelp <hello@app.example>', APP_ORIGIN: 'https://app.example',
  REGISTRATION_ENABLED: 'true', INBOUND_EMAIL_TOKEN: 'b'.repeat(64), INBOUND_EMAIL_DOMAIN: 'replies.app.example',
 })
 try {
  const register = async (email, projectName, allowedOrigin) => {
   ok(await call('/api/identity/register', {body: {email, name: 'Rae', password: 'registered-owner-password-123', projectName, allowedOrigin}}), 202)
   return new URL(log.findLast(entry => entry.provider === 'resend' && entry.to.includes(email)).text.match(/https:\S+/)[0]).searchParams.get('token')
  }
  const totals = async () => Object.fromEntries(await Promise.all(['projects', 'ai_profiles', 'email_settings', 'project_settings'].map(async table => [table, (await db.prepare(`SELECT count(*) n FROM ${table}`).first()).n])))

  // A creation that fails leaves nothing behind: two pending sign-ups for one email, and the second verification fails.
  const firstToken = await register('rae@bakery.example', 'Rae Bakes', 'https://rae-bakes.example')
  const secondToken = await register('rae@bakery.example', 'Rae Bakes again', 'https://rae-bakes.example')
  const verified = ok(await call('/api/identity/verify-email', {body: {token: firstToken}}))
  const before = await totals()
  assert.equal((await call('/api/identity/verify-email', {body: {token: secondToken}})).status, 500)
  assert.equal((await call('/api/identity/verify-email', {body: {token: firstToken}})).status, 400)
  assert.deepEqual(await totals(), before, 'a failed or repeated creation provisions nothing')

  const login = ok(await call('/api/identity/login', {body: {email: 'rae@bakery.example', password: 'registered-owner-password-123'}}))
  const token = login.token, projectId = verified.projectId, origin = 'https://rae-bakes.example'
  const {starter} = await assertStarter(call, token, projectId)
  const readiness = ok(await call(`/api/management/projects/${projectId}/ai`, {token})).data
  assert.equal(readiness.ready, true)
  assert.equal(readiness.secretName, 'OPENAI_API_KEY', 'the starter uses the provider whose key is installed')
  const mailbox = await mailboxOf(call, token, projectId)
  assert.equal(mailbox.email_to_address, 'rae-bakes@replies.app.example')
  assert.equal(mailbox.is_enabled, 1, 'enabled because this installation sends mail')
  // Mail goes out from the installation sender until the workspace's own domain is verified.
  assert.equal(mailbox.from_address, 'hello@app.example')
  assert.equal((await settingsOf(call, token, projectId)).proposed_sender, 'support@rae-bakes.example')
  // A later same-name workspace of the same owner gets its own enabled mailbox.
  const twin = await newWorkspace(call, token, 'Rae Bakes', origin)
  const twinMailbox = await mailboxOf(call, token, twin.id)
  assert.notEqual(twinMailbox.email_to_address, mailbox.email_to_address)
  assert.equal(twinMailbox.is_enabled, 1)
  assert.equal(twinMailbox.from_address, 'hello@app.example')
  await assertStarter(call, token, twin.id)

  // The starter takes the visitor's conversation and answers it by itself.
  const chat = await visitor(call, token, projectId, origin)
  const asked = await chat.say('Do you deliver on Sundays?')
  assert.equal(asked.generationError, undefined)
  const answered = await settle(async () => ok(await call(`/api/conversations/${chat.conversation.id}/messages`, {token: chat.session.token, origin})).messages.find(message => message.actor_role === 'ai'), 'the starter reply')
  assert.match(answered.content, /returns are free/)
  assert.equal((await db.prepare('SELECT ai_id FROM ai_generations WHERE conversation_id=? AND state=?').bind(chat.conversation.id, 'completed').first()).ai_id, starter.id)
  // The daily ceiling holds: the next automatic reply is skipped and recorded, never sent to the provider.
  const providerCalls = log.filter(entry => entry.provider === 'openai').length
  const again = await chat.say('And on holidays?')
  assert.equal(again.generationError, undefined)
  const skipped = await settle(() => db.prepare("SELECT state,error FROM ai_generations WHERE conversation_id=? AND state='failed'").bind(chat.conversation.id).first(), 'the ceiling decision')
  assert.match(skipped.error, /^AI_REPLY_CEILING: .*repliesPerProject/)
  await new Promise(resolve => setTimeout(resolve, 500))
  assert.equal(log.filter(entry => entry.provider === 'openai').length, providerCalls)
 } finally { await mf.dispose() }
})

test('the installed provider chooses the starter model; no inbound token seeds no mailbox; demo inboxes are never provisioned', async () => {
 const {mf, call, owner} = await start('anthropic', {ANTHROPIC_API_KEY: 'test-only-anthropic-key'})
 try {
  const token = owner.token
  const workspace = await newWorkspace(call, token, 'Northwind', 'https://northwind.example')
  const {starter} = await assertStarter(call, token, workspace.id)
  const readiness = ok(await call(`/api/management/projects/${workspace.id}/ai`, {token})).data
  assert.deepEqual([readiness.ready, readiness.secretName], [true, 'ANTHROPIC_API_KEY'])
  assert.equal((await mailboxOf(call, token, workspace.id)).email_to_address, null)
  assert.equal((await settingsOf(call, token, workspace.id)).proposed_sender, 'support@northwind.example', 'proposed without a mailbox')

  const demo = ok(await call('/api/dashboard/demo-inbox', {body: {}, token}), 201)
  const demoSettings = await settingsOf(call, token, demo.id)
  assert.equal(demoSettings.is_demo, true)
  assert.equal('starter_ai' in demoSettings, false)
  assert.equal('proposed_sender' in demoSettings, false)
  assert.ok((await assistantsOf(call, token, demo.id)).every(assistant => assistant.prompt !== starter.prompt), 'no starter in a demo inbox')
  assert.equal((await mailboxOf(call, token, demo.id)).email_to_address, null)
 } finally { await mf.dispose() }
})

test('a local install seeds its mailbox on localhost.test, sends from the installation sender and still records the proposed sender', async () => {
 const {mf, call, owner} = await start('local', {H2H_LOCAL: 'true', EMAIL_PROVIDER: 'development', APP_ORIGIN: 'http://127.0.0.1:8787', EMAIL_FROM: 'HappyToHelp <owner-mail@localhost.test>', INBOUND_EMAIL_TOKEN: 'c'.repeat(64)})
 try {
  const token = owner.token
  const workspace = await newWorkspace(call, token, 'Northstar Outfitters', 'https://www.northstar.example')
  await assertStarter(call, token, workspace.id)
  const mailbox = await mailboxOf(call, token, workspace.id)
  assert.equal(mailbox.email_to_address, 'northstar-outfitters@localhost.test')
  assert.equal(mailbox.is_enabled, 1, 'local mail is validated and suppressed, so the mailbox remains available')
  assert.equal(mailbox.from_address, 'owner-mail@localhost.test')
  assert.equal((await settingsOf(call, token, workspace.id)).proposed_sender, 'support@northstar.example')
 } finally { await mf.dispose() }
})
