# Native optional integrations

No provider is silently simulated. Requests that need missing configuration return
an explicit unavailable state. Provider boundary fixtures exist only in tests.

- Email uses Resend (`EMAIL_API_KEY`, `EMAIL_FROM`) and project email settings.
  Delivery identity binds recipient, content and sender. Sending/failed/uncertain
  receipts are retained; uncertain delivery never automatically repeats. The
  native Cloudflare Email Worker parses MIME and HTML, stores attachments in R2,
  admits canonical contact messages, and accepts reply addresses of the form
  `mailbox+conversationId@domain` only for the matching contact/project. The email
  routing configuration must deliver that mailbox or catch-all to the Worker.
  `INBOUND_EMAIL_TOKEN` is only for the optional normalized gateway endpoint.
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

`tests/email-provider.mjs`, `tests/email-worker.mjs`,
`tests/github-integration.mjs`, and `tests/lead-operations.mjs` exercise local storage
and test-only external boundaries. They do not establish live provider delivery,
OAuth acceptance, provider cost or deployment.
