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
  for (const file of ['0001_identity.sql', '0002_conversations.sql', '0005_widget_identity.sql', '0070_management.sql', '0080_integrations.sql']) {
    for (const sql of (await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')).split(';').filter(value => value.trim())) await proxy.env.DB.prepare(sql).run()
  }
  const env = { ...proxy.env, EMAIL_PROVIDER: 'sendgrid', EMAIL_API_KEY: 'fixture-key', EMAIL_FROM: 'help@justevery.com' }
  assert.equal(emailConfigured(env), true)
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls++
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send')
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-key')
    assert.equal(init.redirect, 'manual')
    const body = JSON.parse(String(init.body))
    assert.deepEqual(body.from, { email: 'help@justevery.com' })
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
  console.log('SendGrid transport: explicit selection, real envelope/reply address, accepted receipt, uncertain no-replay, rejection, and Resend selection passed')
} finally {
  globalThis.fetch = originalFetch
  await proxy.dispose()
}
