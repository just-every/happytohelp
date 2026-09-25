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

const { sendgridInbound } = await import('../src/modules/integrations/sendgrid-inbound.ts')
const { getPlatformProxy } = await import('wrangler')
const proxy = await getPlatformProxy({ persist: false })

try {
  for (const file of ['0001_identity.sql', '0002_conversations.sql', '0004_message_intent.sql', '0005_widget_identity.sql', '0070_management.sql', '0080_integrations.sql', '0100_inbound_email_claims.sql', '0104_inbound_email_classification.sql']) {
    for (const sql of (await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')).split(';').filter(value => value.trim())) await proxy.env.DB.prepare(sql).run()
  }
  const files = new Map()
  const env = {
    ...proxy.env,
    INBOUND_EMAIL_TOKEN: 'fixture-inbound-token',
    OPENAI_API_KEY: undefined,
    FILES: { async put(key, content) { files.set(key, content) }, async get(key) { const content = files.get(key); return content === undefined ? null : { arrayBuffer: async () => content } } },
    CONVERSATIONS: { idFromName: id => id, get: () => ({ fetch: async () => new Response('ok') }) },
  }
  await env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)").run()
  await env.DB.prepare("INSERT INTO email_settings VALUES('p','Support','help@support.example.com','support@reply.support.example.com',1,1)").run()
  await env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('q','Second Project','q-w','https://example.com',1)").run()
  await env.DB.prepare("INSERT INTO email_settings VALUES('q','Support','help@support.example.com','second@reply.support.example.com',1,1)").run()

  const pending = []
  const execution = { waitUntil(promise) { pending.push(Promise.resolve(promise).catch(() => {})) } }
  const authorization = `Basic ${Buffer.from('sendgrid:fixture-inbound-token').toString('base64')}`
  const makeForm = ({ messageId, envelopeTo, visibleTo, text, attachment }) => {
    const form = new FormData()
    form.set('envelope', JSON.stringify({ to: [envelopeTo], from: 'customer@example.com' }))
    form.set('to', visibleTo)
    form.set('from', 'Customer <customer@example.com>')
    form.set('subject', 'Attachment from customer')
    if (text !== undefined) form.set('text', text)
    form.set('headers', `Message-ID: <${messageId}>\r\n`)
    if (attachment) {
      form.set('attachment-info', JSON.stringify({ attachment0: { filename: attachment.filename, type: attachment.type } }))
      form.set('attachment0', new File([new TextEncoder().encode(attachment.body)], attachment.filename, { type: attachment.type }))
    }
    return form
  }
  const form = makeForm({ messageId: 'sendgrid-inbound-1@example.com', envelopeTo: 'support@reply.support.example.com', visibleTo: 'wrong@example.org', text: 'Please review the attached note.', attachment: { filename: 'note.txt', type: 'text/plain', body: 'attachment bytes' } })

  const first = await sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: authorization }, body: form }, env, execution)
  assert.equal(first.status, 201)
  const firstBody = await first.json()
  assert.equal(firstBody.state, 'delivered')
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM messages').first()).n, 1)
  const media = await env.DB.prepare('SELECT * FROM media').first()
  assert.equal(media.filename, 'note.txt')
  assert.equal(new TextDecoder().decode(await (await env.FILES.get(media.object_key)).arrayBuffer()), 'attachment bytes')

  const duplicate = await sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: authorization }, body: form }, env, execution)
  assert.equal(duplicate.status, 200)
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM messages').first()).n, 1)

  const rejected = await sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: 'Basic ZGVueTpub3QtaXQ=' }, body: form }, env, execution)
  assert.equal(rejected.status, 403)

  // The same provider Message-ID may be delivered to another configured
  // mailbox. The SMTP envelope scopes routing; the visible To header does not.
  const second = await sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: authorization }, body: makeForm({ messageId: 'sendgrid-inbound-1@example.com', envelopeTo: 'second@reply.support.example.com', visibleTo: 'wrong@example.org', text: 'Please review the attached note.' }) }, env, execution)
  assert.equal(second.status, 201)
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM messages').first()).n, 2)

  // A customer may send only a file with no text or HTML body.
  const attachmentOnly = await sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: authorization }, body: makeForm({ messageId: 'sendgrid-inbound-attachment-only@example.com', envelopeTo: 'support@reply.support.example.com', visibleTo: 'wrong@example.org', text: '', attachment: { filename: 'screenshot.png', type: 'image/png', body: 'png bytes' } }) }, env, execution)
  assert.equal(attachmentOnly.status, 201)
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM messages').first()).n, 3)

  // Only the SMTP envelope names the sender: a null return path is refused, and the
  // header From (chosen by whoever wrote the message) never selects a contact.
  const rawForm = ({ messageId, envelope, from = 'Customer <customer@example.com>', subject = 'Question', headers = '', text = 'Hello' }) => {
    const form = new FormData()
    if (envelope !== undefined) form.set('envelope', JSON.stringify(envelope))
    form.set('to', 'support@reply.support.example.com')
    form.set('from', from)
    form.set('subject', subject)
    form.set('text', text)
    form.set('headers', `Message-ID: <${messageId}>\r\n${headers}`)
    return form
  }
  const post = form => sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: authorization }, body: form }, env, execution)
  for (const envelope of [{ to: ['support@reply.support.example.com'], from: '' }, { to: ['support@reply.support.example.com'], from: '<>' }, { to: ['support@reply.support.example.com'] }, undefined]) {
    const refused = await post(rawForm({ messageId: 'sendgrid-null-sender@example.com', envelope, from: 'Victim <victim@example.org>', subject: 'Delivery Status Notification (Failure)' }))
    assert.equal(refused.status, 400)
  }
  assert.equal((await env.DB.prepare("SELECT count(*) n FROM contacts WHERE email='victim@example.org'").first()).n, 0)
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM messages').first()).n, 3)

  // List mail is classified from the raw header block: admitted and broadcast, but no AI reply is requested.
  const scheduled = pending.length
  const list = await post(rawForm({ messageId: 'sendgrid-list@example.com', envelope: { to: ['support@reply.support.example.com'], from: 'bounces@news.example.com' }, from: 'News <news@example.com>', subject: 'Weekly news', headers: 'List-Id: Product news\r\n <news.example.com>\r\nList-Unsubscribe: <mailto:leave@news.example.com>\r\n' }))
  assert.equal(list.status, 201)
  assert.equal((await list.json()).automatic, true)
  assert.equal(pending.length - scheduled, 1, 'only the transcript broadcast is scheduled')
  const listClaim = await env.DB.prepare("SELECT * FROM inbound_emails WHERE id='<sendgrid-list@example.com>'").first()
  assert.equal(listClaim.automatic, 1)
  const listEvidence = JSON.parse(listClaim.evidence_json)
  assert.deepEqual(listEvidence.reasons, ['list-id', 'list-unsubscribe'])
  assert.equal(listEvidence.envelope_from, 'bounces@news.example.com')
  assert.equal(listEvidence.headers['list-id'], 'Product news <news.example.com>')
  assert.equal((await env.DB.prepare("SELECT email FROM contacts c JOIN conversations v ON v.contact_id=c.id WHERE v.id=?").bind(listClaim.conversation_id).first()).email, 'bounces@news.example.com')
  const customer = await post(rawForm({ messageId: 'sendgrid-customer@example.com', envelope: { to: ['support@reply.support.example.com'], from: 'customer@example.com' }, subject: 'Re: Out of office auto-replies are not working' }))
  assert.equal((await customer.json()).automatic, false)
  assert.equal(pending.length - scheduled, 3, 'customer mail schedules the broadcast and the AI reply request')
  await Promise.all(pending)
  console.log('SendGrid inbound: Basic shared-token auth, multipart attachment bytes, stable Message-ID, D1/R2 admission, and duplicate delivery passed')
} finally {
  await proxy.dispose()
}
