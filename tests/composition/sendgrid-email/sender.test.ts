import assert from 'node:assert/strict'
import { test } from 'node:test'
const { sendSendGrid, SendGridSendError } = await import(new URL('sender.ts', process.env.RER_COMPONENT_SOURCE ?? new URL('../src/', import.meta.url)).href)

function isSendGridError(error: unknown): error is Error & {
  outcome: 'rejected' | 'rate_limited' | 'ambiguous'
  status?: number
} {
  return error instanceof Error && error instanceof SendGridSendError
    && 'outcome' in error
    && typeof error.outcome === 'string'
    && ['rejected', 'rate_limited', 'ambiguous'].includes(error.outcome)
    && (!('status' in error) || error.status === undefined || typeof error.status === 'number')
}

const message = { from: 'Support <support@example.com>', to: ['person@example.com'], subject: 'Your request', text: 'Reply', html: '<p>Reply</p>', deliveryId: 'durable-1' }

test('sends authenticated v3 mail with durable correlation and reports acceptance only', async () => {
  let calls = 0
  const result = await sendSendGrid({ apiKey: 'test-secret', message: {
    ...message, replyTo: 'reply@example.com', headers: { 'In-Reply-To': '<first@example.com>' },
    attachments: [{ content: 'aGk=', filename: 'proof.txt', type: 'text/plain' }],
  }, fetch: async (url: Parameters<typeof globalThis.fetch>[0], init?: Parameters<typeof globalThis.fetch>[1]) => {
    calls++
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-secret')
    const body = JSON.parse(String(init?.body))
    assert.deepEqual(body.from, { name: 'Support', email: 'support@example.com' })
    assert.deepEqual(body.personalizations, [{ to: [{ email: 'person@example.com' }] }])
    assert.deepEqual(body.custom_args, { rer_delivery_id: 'durable-1' })
    assert.deepEqual(body.reply_to, { email: 'reply@example.com' })
    assert.equal(body.attachments[0].disposition, 'attachment')
    assert.equal(body.tracking_settings.click_tracking.enable, false)
    return new Response(null, { status: 202, headers: { 'X-Message-Id': 'provider-receipt' } })
  } })
  assert.deepEqual(result, { provider: 'sendgrid', providerMessageId: 'provider-receipt', state: 'accepted' })
  assert.equal(calls, 1)
})

test('uncertain submission never triggers a duplicate automatic attempt', async () => {
  for (const response of [null, new Response(null, { status: 500 }), new Response(null, { status: 202 }), new Response(null, { status: 200 })]) {
    let calls = 0
    await assert.rejects(sendSendGrid({ apiKey: 'test', message, fetch: async () => {
      calls++
      if (response === null) throw new Error('network interruption')
      return response
    } }), (error: unknown) => isSendGridError(error) && error.outcome === 'ambiguous')
    assert.equal(calls, 1)
  }
})

test('rejection and rate limit are explicit and provider response bodies stay private', async () => {
  for (const [status, outcome] of [[400, 'rejected'], [401, 'rejected'], [429, 'rate_limited']] as const) {
    await assert.rejects(sendSendGrid({ apiKey: 'test', message, fetch: async () => new Response('private-provider-details', { status }) }),
      (error: unknown) => isSendGridError(error) && error.outcome === outcome && error.status === status && !error.message.includes('private-provider-details'))
  }
})

test('invalid recipient or reserved headers fail before a provider call', async () => {
  for (const badMessage of [{ ...message, to: [] }, { ...message, to: ['bad\r\n@example.com'] }, { ...message, headers: { From: 'other@example.com' } }]) {
    let calls = 0
    await assert.rejects(sendSendGrid({ apiKey: 'test', message: badMessage, fetch: async () => { calls++; return new Response(null, { status: 202 }) } }), SendGridSendError)
    assert.equal(calls, 0)
  }
})
