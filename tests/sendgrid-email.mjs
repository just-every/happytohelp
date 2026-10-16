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
  for (const file of ['0001_identity.sql', '0002_conversations.sql','123_operator_notifications.sql', '0005_widget_identity.sql', '0070_management.sql', '0080_integrations.sql']) {
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
  assert.deepEqual(notification.reply_to, { email: 'inbound+c@example.com' })
  assert.deepEqual(notification.personalizations[0].to, [{ email: 'customer@example.com' }])
  console.log('SendGrid transport: explicit selection, real envelope/reply address, accepted receipt, uncertain no-replay, rejection, and Resend selection passed')
} finally {
  globalThis.fetch = originalFetch
  await proxy.dispose()
}
