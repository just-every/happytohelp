# Native optional integrations

No provider is silently simulated. Requests that need missing configuration return
an explicit unavailable state. Provider boundary fixtures exist only in tests.

- Email supports Resend (default), Cloudflare Email Sending via `EMAIL_PROVIDER=cloudflare`,
  or SendGrid via `EMAIL_PROVIDER=sendgrid`, using `EMAIL_API_KEY` and `EMAIL_FROM`, plus
  project email settings. Cloudflare additionally requires `EMAIL_ACCOUNT_ID`.
  Cloudflare uses its REST API with a dedicated Email Sending: Edit token, never
  the installer provisioning token. Workers Paid and an onboarded sender domain
  using Cloudflare DNS are prerequisites for general customer delivery. Inbound
  Routing and free verified-destination sending are separate capabilities.
  Installer configuration is not a domain-verification or delivery receipt.
  `sent` records provider acceptance (including queued mail), not inbox receipt;
  Cloudflare REST returns recipient outcomes without a message ID, so its retained
  provider ID is null. Password recovery, verification and invitations use the
  selected provider; passwordless magic-link login is not implemented.
  Delivery identity binds recipient, content and sender. Sending/failed/uncertain
  receipts are retained; uncertain delivery never automatically repeats. The
  native Cloudflare Email Worker and the SendGrid Inbound Parse route parse MIME and
  HTML, store attachments in R2, admit canonical contact messages, and accept reply
  addresses of the form
  `mailbox+conversationId@domain` only for the matching contact/project. The email
  routing configuration must deliver that mailbox or catch-all to the Worker. SendGrid
  Inbound Parse uses `POST /api/integrations/email/sendgrid/inbound` and accepts a
  shared `INBOUND_EMAIL_TOKEN` through Basic or Bearer authorization; a query token is
  retained only for gateways that cannot set an authorization header. Keep inbound
  mail on a dedicated subdomain so the root domain's existing MX records are unchanged.
- Automatic mail never gets an automatic answer. The Email Worker, the SendGrid route and the
  JSON gateway (`POST /api/integrations/email/inbound`, optional `envelopeFrom`, `subject` and
  `headers` object) keep bounded evidence: the envelope sender, header From, subject and the
  `Auto-Submitted`, `Precedence`, `X-Auto-Response-Suppress`, `List-Id`, `List-Unsubscribe`,
  `X-Autoreply`/`X-Autorespond`, `Return-Path` and threading headers.
  `email-classification.ts` marks a message automatic for any of those automatic headers, a
  mailer-daemon/postmaster or no-reply/do-not-reply sender, a null return path, or a subject
  that *starts* with an autoresponder prefix (`Automatic reply:`, `Out of Office:`,
  `Undeliverable:`, `Delivery Status Notification`, …); a customer sentence that merely
  contains those words stays customer mail. The classification, its reasons and the evidence
  are written to the inbound claim before admission (`0104_inbound_email_classification.sql`),
  and a redelivery keeps the first answer. An automatic message is admitted and broadcast
  like any other, but `applyMessageEffects` and `scheduleInboundEffects` request no AI reply
  and send no notification for it, on first delivery and on every scheduled replay. The
  transcript API and dashboard buckets expose `message.origin`
  (`{channel:'email',automatic,reasons}`) and the dashboard labels it "automatic". The Worker
  refuses a null envelope sender (`Envelope sender required`) and the SendGrid route returns
  400 for one; the header From never selects a contact. `email:` message local ids are
  reserved for inbound claims and refused by `POST /api/conversations/:id/messages`
  (as are `erased:` ids, which contact erasure writes).
  Conversation notifications carry `Auto-Submitted` (`auto-replied` for an AI reply,
  otherwise `auto-generated`) and `X-Auto-Response-Suppress: All` through Resend and SendGrid;
  Cloudflare Email Sending receives no custom headers until its allowed-header list is
  verified.
- GitHub uses OAuth (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) with expiring,
  user/project-bound one-use state. `INTEGRATION_ENCRYPTION_KEY` is a base64-encoded
  32-byte AES key; stored tokens use project-bound AES-GCM. Alternative
  `GITHUB_TOKENS` and project-matched `GITHUB_TOKEN` modes accept a project-scoped
  token without assuming its provider type. OAuth repository discovery lists the
  connected user’s repositories; mapped and single-token modes validate the exact
  project allowlist through repository reads, which also supports GitHub App
  installation tokens that cannot use `/user/repos`. Repository tools enforce exact
  repository selection, separate operator/customer permission, bounded text, denied
  secret paths and credential redaction. Repository file chunks keep their selected
  ref and validate the previous blob `sha` as `expected_sha`; a blob SHA is not a
  Git ref, and a changed file fails the continuation so the caller restarts at
  offset zero. Disconnect removes OAuth credentials and clears access.
- Leads use `OPENAI_API_KEY` and explicit `LEAD_MODEL` for queued, grounded draft
  preparation from bounded public website text. A reviewed draft is required before
  email delivery. Queued jobs recover; interrupted provider attempts become
  uncertain and require inspection. Per-attempt observed usage is recorded.

Payment, checkout, Stripe, balance and active billing behavior are outside this
edition. AI and training retain raw provider usage plus explicit run budgets for
diagnostics and bounded execution; those records do not create charges or debit a
customer balance.

`tests/email-provider.mjs`, `tests/cloudflare-email.mjs`, `tests/email-worker.mjs`,
`tests/email-classification.mjs`, `tests/email-recovery.mjs`, `tests/sendgrid-inbound.mjs`,
`tests/sendgrid-email.mjs`,
`tests/github-integration.mjs`, and `tests/lead-operations.mjs` exercise local storage
and test-only external boundaries. They do not establish live provider delivery,
OAuth acceptance, provider cost or deployment.

Cloudflare contracts checked 17 September 2026: [sending guide](https://developers.cloudflare.com/email-service/get-started/send-emails/),
[REST response and errors](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
SendGrid contracts checked 20 September 2026: [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send),
[Inbound Parse setup](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook),
and [parse webhook security](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/securing-your-parse-webhooks).

`checkSenderDomain(domain, resolver, dkimSelector)` checks SPF, DKIM and DMARC TXT
record presence with an injectable resolver. The owner/admin route
`GET /api/management/projects/:projectId/email-settings/check-domain?selector=resend`
uses the project's saved sender address. Each missing record is named; lookup
errors are unknown, never success. DKIM selectors depend on the provider. This
is not provider domain verification or a delivered-mail receipt.
