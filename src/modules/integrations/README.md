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
- GitHub uses OAuth (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) with expiring,
  user/project-bound one-use state. `INTEGRATION_ENCRYPTION_KEY` is a base64-encoded
  32-byte AES key; stored tokens use project-bound AES-GCM. An alternative
  `GITHUB_TOKENS` secret maps project IDs to tokens; single `GITHUB_TOKEN` requires
  matching `GITHUB_PROJECT_ID`. Repository tools enforce exact repository selection,
  separate operator/customer permission, bounded text, denied secret paths and
  credential redaction. Disconnect removes OAuth credentials and clears access.
- Leads use `OPENAI_API_KEY` and explicit `LEAD_MODEL` for queued, grounded draft
  preparation from bounded public website text. A reviewed draft is required before
  email delivery. Queued jobs recover; interrupted provider attempts become
  uncertain and require inspection. Per-attempt observed usage is recorded.

Payment, checkout, Stripe, balance and active billing behavior are outside this
edition. AI and training retain raw provider usage plus explicit run budgets for
diagnostics and bounded execution; those records do not create charges or debit a
customer balance.

`tests/email-provider.mjs`, `tests/cloudflare-email.mjs`, `tests/email-worker.mjs`,
`tests/github-integration.mjs`, and `tests/lead-operations.mjs` exercise local storage
and test-only external boundaries. They do not establish live provider delivery,
OAuth acceptance, provider cost or deployment.

Cloudflare contracts checked 17 September 2026: [sending guide](https://developers.cloudflare.com/email-service/get-started/send-emails/),
[REST response and errors](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
SendGrid contracts checked 20 September 2026: [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send),
[Inbound Parse setup](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook),
and [parse webhook security](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/securing-your-parse-webhooks).
