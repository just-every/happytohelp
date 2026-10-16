import {migrationStatements} from './helpers/migration-statements.mjs';
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
const { recipientReplyAddress } = await import('../src/modules/integrations/email-reply-address.ts')
const { getPlatformProxy } = await import('wrangler')
const proxy = await getPlatformProxy({ persist: false })

try {
  for (const file of ['0001_identity.sql', '0002_conversations.sql','123_operator_notifications.sql', '0004_message_intent.sql', '0005_widget_identity.sql', '0070_management.sql', '0080_integrations.sql', '0100_inbound_email_claims.sql', '0104_inbound_email_classification.sql','112_conversation_outcomes.sql','122_email_content.sql','123_email_reply_grants.sql']) {
    for (const sql of migrationStatements(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))) await proxy.env.DB.prepare(sql).run()
  }
  const env = {
    ...proxy.env,
    INBOUND_EMAIL_TOKEN: 'synthetic-fixture-inbound-token',
    OPENAI_API_KEY: undefined,
    CONVERSATIONS: { idFromName: id => id, get: () => ({ fetch: async () => new Response('ok') }) },
  }
  await env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)").run()
  await env.DB.prepare("INSERT INTO email_settings VALUES('p','Support','help@support.example.com','support@reply.support.example.com',1,1)").run()
  await env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('q','Second Project','q-w','https://example.com',1)").run()
  await env.DB.prepare("INSERT INTO email_settings VALUES('q','Support','help@support.example.com','second@reply.support.example.com',1,1)").run()

  const pending = []
  const execution = { waitUntil(promise) { pending.push(Promise.resolve(promise).catch(() => {})) } }
  const authorization = `Basic ${Buffer.from('sendgrid:synthetic-fixture-inbound-token').toString('base64')}`
  const makeForm = ({ messageId, envelopeTo, visibleTo, text, attachment }) => {
    const form = new FormData()
    form.set('envelope', JSON.stringify({ to: [envelopeTo], from: 'customer@example.com' }))
    form.set('to', visibleTo)
    form.set('from', 'Customer <customer@example.com>')
    form.set('SPF','pass')
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

  // The header From is the sender; SendGrid's DKIM and SPF verdicts verify it. The
  // envelope (VERP, forwarding SRS, or a null return path) is delivery metadata.
  const rawForm = ({ messageId, envelope, from = 'Customer <customer@example.com>', subject = 'Question', headers = '', text = 'Hello', spf='pass', dkim='', to = 'support@reply.support.example.com' }) => {
    const form = new FormData()
    if (envelope !== undefined) form.set('envelope', JSON.stringify(envelope))
    form.set('to', to)
    form.set('from', from)
    form.set('subject', subject)
    form.set('SPF',spf)
    if (dkim) form.set('dkim', dkim)
    form.set('text', text)
    form.set('headers', `Message-ID: <${messageId}>\r\n${headers}`)
    return form
  }
  const post = form => sendgridInbound.request('/email/sendgrid/inbound', { method: 'POST', headers: { Authorization: authorization }, body: form }, env, execution)
  // A null return path is admitted under its unverified header From, and stays quiet.
  for (const envelope of [{ to: ['support@reply.support.example.com'], from: '' }, { to: ['support@reply.support.example.com'], from: '<>' }, { to: ['support@reply.support.example.com'] }, undefined]) {
    const bounce = await post(rawForm({ messageId: 'sendgrid-null-sender@example.com', envelope, from: 'Victim <victim@example.org>', subject: 'Delivery Status Notification (Failure)' }))
    assert.equal(bounce.status < 300, true)
    assert.equal((await bounce.json()).automatic, true)
  }
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM messages').first()).n, 4)

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
  assert.equal((await env.DB.prepare("SELECT email FROM contacts c JOIN conversations v ON v.contact_id=c.id WHERE v.id=?").bind(listClaim.conversation_id).first()).email, 'news@example.com')
  const customer = await post(rawForm({ messageId: 'sendgrid-customer@example.com', envelope: { to: ['support@reply.support.example.com'], from: 'customer@example.com' }, subject: 'Re: Out of office auto-replies are not working' }))
  assert.equal((await customer.json()).automatic, false)
  assert.equal(pending.length - scheduled, 3, 'customer mail schedules the broadcast and the AI reply request')
  const ccMail=rawForm({messageId:'sendgrid-cc@example.com',envelope:{to:[`support+${firstBody.conversationId}@reply.support.example.com`],from:'customer@example.com'},text:'Finance can help.\n\nOn Fri, 16 Oct 2026 Support wrote:\n> Please attach the export',headers:'Cc: Finance <finance@example.com>\r\n'})
  const ccResult=await post(ccMail);assert.equal(ccResult.status,201)
  const participant=await env.DB.prepare('SELECT ct.id FROM contacts ct JOIN conversation_participants cp ON cp.contact_id=ct.id WHERE cp.conversation_id=? AND ct.email=? AND ct.project_id=?').bind(firstBody.conversationId,'finance@example.com','p').first()
  assert.ok(participant)
  const finance=await post(rawForm({messageId:'sendgrid-participant@example.com',envelope:{to:[`support+${firstBody.conversationId}@reply.support.example.com`],from:'finance@example.com'},from:'Finance <finance@example.com>',text:'I have the invoice.'}))
  assert.equal(finance.status,201)
  const body=await env.DB.prepare('SELECT content,content_raw FROM messages WHERE id=(SELECT message_id FROM inbound_emails WHERE id=?)').bind('<sendgrid-cc@example.com>').first()
  assert.equal(body.content,'Finance can help.');assert.ok(body.content_raw.includes('Please attach the export'))
  // One message to two configured mailboxes reaches each project.
  assert.equal((await post(rawForm({messageId:'sendgrid-many-recipients@example.com',envelope:{to:['support@reply.support.example.com','second@reply.support.example.com'],from:'customer@example.com'}}))).status,201)
  assert.deepEqual((await env.DB.prepare("SELECT project_id FROM inbound_emails WHERE local_id IS NOT NULL AND state='delivered' AND evidence_json LIKE '%sendgrid-many-recipients%' ORDER BY project_id").all()).results.map(row=>row.project_id),['p','q'])
  // SPF not passing: still admitted to the customer's thread, flagged unverified, CC skipped.
  const unverified=await post(rawForm({messageId:'sendgrid-spf-softfail@example.com',envelope:{to:[`support+${firstBody.conversationId}@reply.support.example.com`],from:'customer@example.com'},text:'Sent through an unaligned relay',spf:'softfail',headers:'Cc: stranger@example.com\r\n'}))
  assert.equal(unverified.status,201);assert.equal((await unverified.json()).conversationId,firstBody.conversationId)
  assert.equal(JSON.parse((await env.DB.prepare("SELECT evidence_json FROM inbound_emails WHERE id='<sendgrid-spf-softfail@example.com>'").first()).evidence_json).sender_verified,false)
  assert.equal(await env.DB.prepare("SELECT id FROM contacts WHERE email='stranger@example.com'").first(),null)
  // An explicit SPF fail (DKIM only for another domain) may be forged: it starts a
  // separate conversation from a contact flagged as an unverified sender.
  const failed=await (await post(rawForm({messageId:'sendgrid-spf-fail@example.com',envelope:{to:[`support+${firstBody.conversationId}@reply.support.example.com`],from:'bounce@attacker.example'},text:'Please send my refund elsewhere',spf:'fail',dkim:'{@attacker.example : pass}'}))).json()
  assert.notEqual(failed.conversationId,firstBody.conversationId)
  assert.equal(JSON.parse((await env.DB.prepare('SELECT ct.metadata_json FROM conversations v JOIN contacts ct ON ct.id=v.contact_id WHERE v.id=?').bind(failed.conversationId).first()).metadata_json).unverified_sender,1)
  // A header From with no usable address has no author to authenticate; SendGrid's SPF
  // fail for the envelope still counts. With MAIL FROM the customer's address it never
  // joins their thread as them, only one separate conversation flagged unverified.
  const unusable=[['', ''], ['Customer', 'From: Customer\r\n'], ['customer@example', 'From: customer@example\r\n'], ['<>', 'From: <>\r\n']]
  const kept=[]
  for (const [from, header] of unusable) {
    const response = await post(rawForm({ messageId: `sendgrid-unusable-${kept.length}@example.com`, envelope: { to: ['support@reply.support.example.com'], from: 'customer@example.com' }, from, headers: header, text: 'Please change my bank details', spf: 'fail' }))
    assert.equal(response.status, 201, from)
    kept.push((await response.json()).conversationId)
  }
  assert.equal(new Set(kept).size, 1); assert.notEqual(kept[0], firstBody.conversationId)
  assert.deepEqual(JSON.parse((await env.DB.prepare('SELECT ct.metadata_json FROM conversations v JOIN contacts ct ON ct.id=v.contact_id WHERE v.id=?').bind(kept[0]).first()).metadata_json), { unverified_sender: 1, unusable_from: 1 })
  // A VERP envelope: the contact is the DKIM-verified From, and Reply-To is only where replies go.
  const verp=await post(rawForm({messageId:'sendgrid-verp@example.com',envelope:{to:['support@reply.support.example.com'],from:'bounces+5719-d26b-x=example.com@em.sender.example.com'},from:'Proof <proof@sender.example.com>',dkim:'{@sender.example.com : pass}',headers:'Reply-To: Desk <desk@desk.example.net>\r\n'}))
  const proof=await env.DB.prepare('SELECT c.email,c.metadata_json FROM contacts c JOIN conversations v ON v.contact_id=c.id WHERE v.id=?').bind((await verp.json()).conversationId).first()
  assert.deepEqual([proof.email,JSON.parse(proof.metadata_json).provided_email],['proof@sender.example.com','desk@desk.example.net'])
  // Google Workspace forwarding: an SRS envelope, the company address in Delivered-To,
  // To and Cc, and an envelope recipient that is not itself a mailbox.
  const forwarded=await post(rawForm({messageId:'sendgrid-forwarded@example.com',envelope:{to:['relay@reply.support.example.com'],from:'SRS0=Hk2=AB=customer.example=ana@company.example'},to:'support@company.example',from:'Ana <ana@customer.example>',dkim:'{@customer.example : pass, @company.example : pass}',headers:'Delivered-To: support@reply.support.example.com\r\nX-Gm-Original-To: support@company.example\r\nCc: Lee <lee@customer.example>, support@company.example\r\n'}))
  assert.equal(forwarded.status,201)
  const ana=await forwarded.json(),anaRows=(await env.DB.prepare('SELECT ct.email FROM conversations v JOIN contacts ct ON ct.id=v.contact_id WHERE v.id=? AND v.project_id=? UNION ALL SELECT ct.email FROM conversation_participants cp JOIN contacts ct ON ct.id=cp.contact_id WHERE cp.conversation_id=?').bind(ana.conversationId,'p',ana.conversationId).all()).results
  assert.deepEqual(anaRows.map(row=>row.email),['ana@customer.example','lee@customer.example'])
  // A widget visitor's typed address answers its notification through the reply
  // address issued to it: the answer continues the chat as the visitor; fresh mail
  // from that address does not.
  // The receiving mailbox's MX lookup answers, so a reply address is issued.
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => String(url).startsWith('https://cloudflare-dns.com/') ? Response.json({ Status: 0, Answer: [{ type: 15, data: '10 mx.example.com.' }] }) : originalFetch(url, init)
  await env.DB.batch([
   env.DB.prepare("INSERT INTO contacts(id,project_id,email,metadata_json,created_at) VALUES('visitor','p','rosa@acme.test','{\"email_unproven\":1}',1)"),
   env.DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('chat','p','visitor',1,1)"),
  ])
  const rosaReplyAddress = await recipientReplyAddress(env, 'support@reply.support.example.com', 'p', 'chat', 'rosa@acme.test')
  const rosa = await (await post(rawForm({ messageId: 'sendgrid-rosa-answer@example.com', envelope: { to: [rosaReplyAddress], from: 'rosa@acme.test' }, to: rosaReplyAddress, from: 'Rosa <rosa@acme.test>', dkim: '{@acme.test : pass}', text: 'Photo attached, the corner is crushed.' }))).json()
  assert.deepEqual([rosa.conversationId, rosa.actor.contactId], ['chat', 'visitor'])
  const rosaFresh = await (await post(rawForm({ messageId: 'sendgrid-rosa-fresh@example.com', envelope: { to: ['support@reply.support.example.com'], from: 'rosa@acme.test' }, from: 'Rosa <rosa@acme.test>', dkim: '{@acme.test : pass}' }))).json()
  assert.notEqual(rosaFresh.conversationId, 'chat')
  await Promise.all(pending)
  console.log('SendGrid inbound: Basic shared-token auth, multipart attachment bytes, stable Message-ID, D1/R2 admission, duplicate delivery, From identity over VERP/SRS envelopes, forwarded routing, unverified SPF and multi-mailbox delivery passed')
} finally {
  await proxy.dispose()
}
