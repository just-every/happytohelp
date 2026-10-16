import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(url)) return next(url.href, context)
  }
  return next(specifier, context)
} })

const { sendEmail, emailConfigured } = await import('../src/modules/integrations/email.ts')
const { getPlatformProxy } = await import('wrangler')
const proxy = await getPlatformProxy({ persist: false })
const originalFetch = globalThis.fetch

try {
  for (const file of ['0001_identity.sql', '0002_conversations.sql','123_operator_notifications.sql', '0005_widget_identity.sql', '0070_management.sql', '0080_integrations.sql','123_email_reply_grants.sql']) {
    for (const sql of (await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')).split(';').filter(value => value.trim())) await proxy.env.DB.prepare(sql).run()
  }
  const env = { ...proxy.env, EMAIL_PROVIDER: 'sendgrid', EMAIL_API_KEY: 'fixture-key', EMAIL_FROM: 'help@support.example.com', INBOUND_EMAIL_TOKEN: 'test-only-inbound-email-token' }
  assert.equal(emailConfigured(env), true)
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls++
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send')
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-key')
    assert.equal(init.redirect, 'manual')
    const body = JSON.parse(String(init.body))
    assert.deepEqual(body.from, { email: 'help@support.example.com' })
    assert.deepEqual(body.reply_to, { email: 'inbound+conversation@example.com' })
    assert.deepEqual(body.custom_args, { rer_delivery_id: 'sendgrid-1' })
    return new Response(null, { status: 202, headers: { 'X-Message-Id': 'sg-receipt' } })
  }
  const input = { to: 'owner@example.com', subject: 'Test', text: 'Body', replyTo: 'inbound+conversation@example.com', idempotencyKey: 'sendgrid-1' }
  assert.deepEqual(await sendEmail(env, input), { id: 'sg-receipt', state: 'sent' })
  assert.deepEqual(await sendEmail(env, input), { id: 'sg-receipt', state: 'sent' })
  assert.equal(calls, 1)

  globalThis.fetch = async () => { calls++; throw new Error('provider connection lost') }
  await assert.rejects(sendEmail(env, { ...input, idempotencyKey: 'sendgrid-uncertain' }), /outcome unknown/)
  await assert.rejects(sendEmail(env, { ...input, idempotencyKey: 'sendgrid-uncertain' }), /uncertain/)
  assert.equal((await env.DB.prepare("SELECT state FROM email_deliveries WHERE id='sendgrid-uncertain'").first()).state, 'uncertain')
  assert.equal(calls, 2)

  globalThis.fetch = async () => { calls++; return new Response('provider details must stay private', { status: 401 }) }
  await assert.rejects(sendEmail(env, { ...input, idempotencyKey: 'sendgrid-rejected' }), /provider rejected/)
  assert.equal((await env.DB.prepare("SELECT state FROM email_deliveries WHERE id='sendgrid-rejected'").first()).state, 'failed')
  assert.equal(calls, 3)

  const resend = { ...env, EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'resend-fixture' }
  globalThis.fetch = async url => { calls++; assert.equal(url, 'https://api.resend.com/emails'); return Response.json({ id: 'resend-receipt' }) }
  assert.deepEqual(await sendEmail(resend, { ...input, idempotencyKey: 'resend-1' }), { id: 'resend-receipt', state: 'sent' })
  assert.equal(calls, 4)
  assert.equal(emailConfigured({ ...env, EMAIL_PROVIDER: 'unknown' }), false)

  // Loop suppression: notifications carry Auto-Submitted and X-Auto-Response-Suppress
  // through SendGrid and Resend; Cloudflare Email Sending receives no custom headers.
  const loopHeaders = { 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All' }
  const bodies = []
  globalThis.fetch = async (url, init) => {
    // The reply mailbox's MX lookup: example.com receives mail, other domains do not.
    if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: new URL(url).searchParams.get('name') === 'example.com' ? [{ type: 15, data: '10 mx.example.com.' }] : [] })
    calls++
    bodies.push({ url: String(url), body: JSON.parse(String(init.body)) })
    if (String(url).includes('sendgrid')) return new Response(null, { status: 202, headers: { 'X-Message-Id': `sg-${calls}` } })
    if (String(url).includes('cloudflare')) return Response.json({ success: true, result: { queued: ['owner@example.com'], delivered: [], permanent_bounces: [] } })
    return Response.json({ id: `resend-${calls}` })
  }
  await sendEmail(env, { ...input, headers: loopHeaders, idempotencyKey: 'sendgrid-headers' })
  await sendEmail(resend, { ...input, headers: loopHeaders, idempotencyKey: 'resend-headers' })
  await sendEmail({ ...env, EMAIL_PROVIDER: 'cloudflare', EMAIL_ACCOUNT_ID: 'a'.repeat(32) }, { ...input, headers: loopHeaders, idempotencyKey: 'cloudflare-headers' })
  assert.deepEqual(bodies.map(({ url, body }) => [new URL(url).hostname, body.headers]), [['api.sendgrid.com', loopHeaders], ['api.resend.com', loopHeaders], ['api.cloudflare.com', undefined]])
  assert.equal(bodies[0].body.custom_args.rer_delivery_id, 'sendgrid-headers')
  // The headers are part of the delivery identity like every other field.
  await assert.rejects(sendEmail(env, { ...input, headers: { 'Auto-Submitted': 'auto-generated' }, idempotencyKey: 'sendgrid-headers' }), /identity conflict/)

  // An AI reply notified to the contact over SendGrid is marked auto-replied.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)"),
    env.DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('contact','p','customer@example.com',1)"),
    env.DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('c','p','contact',1,1)"),
    env.DB.prepare("INSERT INTO email_settings VALUES('p','Support','help@support.example.com','inbound@example.com',1,1)"),
  ])
  const { notifyMessage } = await import('../src/modules/integrations/notifications.ts')
  const notified = await notifyMessage(env, { id: 'ai-message', conversation_id: 'c', actor_role: 'ai', content: 'Here is your answer.' }, { id: 'contact', projectId: 'p', contactId: 'contact', role: 'contact' })
  assert.equal(notified.state, 'sent')
  const notification = bodies.at(-1).body
  assert.deepEqual(notification.headers, loopHeaders)
  const {inboundTarget}=await import('../src/modules/integrations/inbound-routing.ts'),{replyGrant}=await import('../src/modules/integrations/email-reply-address.ts')
  assert.deepEqual({...await replyGrant(env,'p',inboundTarget(notification.reply_to.email).replyToken)},{conversation_id:'c',recipient:'customer@example.com'})
  assert.deepEqual(notification.personalizations[0].to, [{ email: 'customer@example.com' }])
  // A mailbox that cannot receive mail gets no Reply-To; the email points to the chat instead.
  // The operator reply is emailed even though the visitor was active in the widget a moment ago.
  await env.DB.batch([
    env.DB.prepare("UPDATE email_settings SET inbound_address='inbound@unrouted.example' WHERE project_id='p'"),
    env.DB.prepare("UPDATE contacts SET metadata_json=json_object('last_seen_at',?) WHERE id='contact'").bind(Date.now()),
  ])
  assert.equal((await notifyMessage(env, { id: 'operator-while-active', conversation_id: 'c', actor_role: 'operator', actor_id: 'operator', content: 'Here is your answer.' }, { id: 'operator', projectId: 'p', role: 'operator' })).state, 'sent')
  assert.equal(bodies.at(-1).body.reply_to, undefined)
  assert.match(bodies.at(-1).body.content[0].value, /Replies to this email are not received\. To answer, continue in the chat: https:\/\/example\.com\/#launch-chat$/)
  await env.DB.prepare("UPDATE email_settings SET inbound_address='inbound@example.com' WHERE project_id='p'").run()
  // A reply can acknowledge its durable send claim while the paid transport is
  // still pending. Provider outcomes still settle once, and unknown is not replayed.
  for (const outcome of ['sent', 'uncertain']) {
    let finish
    const response = new Promise(resolve => { finish = resolve })
    const before = calls
    globalThis.fetch = async () => { calls++; return response }
    const pending = []
    const message = { id: `deferred-${outcome}`, conversation_id: 'c', actor_role: 'operator', content: 'Durable reply' }
    const actor = { id: 'operator', projectId: 'p', role: 'operator' }
    const prepared = await notifyMessage(env, message, actor, task => pending.push(task))
    assert.equal(prepared.state, 'sending')
    const deliveryId = `message:${message.id}:notification`
    assert.equal((await env.DB.prepare('SELECT state FROM email_deliveries WHERE id=?').bind(deliveryId).first()).state, 'sending')
    assert.equal(pending.length, 1)
    assert.equal((await notifyMessage(env, message, actor)).state, 'sending')
    assert.equal(calls, before + 1, 'a pending claim cannot submit a second provider attempt')
    const settled = pending[0].catch(error => error)
    finish(outcome === 'sent' ? new Response(null, { status: 202, headers: { 'X-Message-Id': 'deferred-receipt' } }) : new Response(null, { status: 500 }))
    await settled
    assert.equal((await env.DB.prepare('SELECT state FROM email_deliveries WHERE id=?').bind(deliveryId).first()).state, outcome)
    assert.equal((await notifyMessage(env, message, actor)).state, outcome)
    assert.equal(calls, before + 1, 'settled and unknown outcomes cannot trigger automatic replay')
  }
  console.log('SendGrid transport: explicit selection, real envelope/reply address, accepted receipt, uncertain no-replay, rejection, and Resend selection passed')
} finally {
  globalThis.fetch = originalFetch
  await proxy.dispose()
}
