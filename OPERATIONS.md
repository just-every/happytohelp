# HappyToHelp operations

HappyToHelp runs as one Cloudflare Worker built with TanStack Start/React and
Hono. D1 (`DB`) stores application records and operation state, R2 (`FILES`)
stores uploaded content and media, Queues (`JOBS`, with a dead-letter queue)
dispatch persisted work, and a SQLite-backed Durable Object (`CONVERSATIONS`)
coordinates live conversation sockets. A once-a-minute cron recovers eligible
persisted work. No other server, database or cache is required.

Before installing dependencies you can run `node scripts/operations.mjs describe`
and `node scripts/operations.mjs check`. They read files and validate the
declared local configuration only; they do not run setup or deploy, read
secrets, sign in or check remote health. Use Node 26.8.1 or newer and pnpm
10.12.4. Use `pnpm run setup`: `pnpm setup` is pnpm's own unrelated command.

The standalone installer (`node scripts/install.mjs`, see
[docs/INSTALLER.md](docs/INSTALLER.md)) runs the same commands described below
for you. This document is the manual path and the reference for every setting.

## Local installation

1. Run `pnpm install --frozen-lockfile` in the repository.
2. Run `pnpm run setup -- --local`. This collects edition and module migrations
   into `.generated/migrations` and applies them to local D1. It does not
   create remote resources or publish code.
3. Put any optional runtime configuration in a private `.dev.vars` file (see
   [Optional capabilities](#optional-native-capabilities)). Run `pnpm run dev`,
   open `/setup`, and choose an email and password to create the first owner.
   Setup closes once an owner exists; afterwards use `/login`. Dashboard routes
   include `/projects` and `/conversations`; `/` is the public village homepage
   and published help centers are project-scoped routes. The homepage does not
   load the customer widget: configure a project's exact allowed website origin,
   then install the widget snippet shown in its widget settings on that site.
4. `pnpm run verify` runs the repository's verification command (operations
   descriptor, build, type check, module tests, emitted-Worker runtime tests,
   the first-release journey and source integrity). The journey
   (`pnpm run test:journey`) takes one owner, customer and operator through a
   local emitted Worker: health, owner setup and login, tenant isolation, a
   widget conversation with an attachment, operator handling including a
   stale-frontier 409, refusal of AI work with no provider configured, WebSocket
   replay and resume, session revocation and the project deletion boundary. It
   is local evidence, not hosted or provider acceptance, and provider fixture
   tests never establish live-provider success. `pnpm run deploy -- --local`
   builds, applies local migrations and runs a Wrangler packaging dry run
   without deploying anything.

Never edit an applied migration. Add a new, uniquely numbered migration in the
edition or the relevant module, run `pnpm run migrations:prepare`, and apply it
with the same setup target. Generation removes obsolete generated copies; it does
not rewrite D1's applied history. Back up your data before consequential
migrations.

## Remote setup and publication

### Prerequisites

- **Dependencies and Wrangler sign-in.** Run `pnpm install --frozen-lockfile`,
  then either `pnpm exec wrangler login` or export `CLOUDFLARE_API_TOKEN`.
- **Cloudflare products.** The account must be able to use Workers, D1, R2,
  Queues and Durable Objects. Enable R2 in the dashboard before the first setup.
  The Workers Paid plan covers all of them and is required for Cloudflare Email
  Sending.
- **API token permissions.** A token used instead of `wrangler login` needs, for
  the selected account: *Workers Scripts: Edit*, *D1: Edit*, *Workers R2
  Storage: Edit*, *Queues: Edit* and *Account Settings: Read*; and, for Wrangler
  to identify the user, *User Details: Read* and *Memberships: Read*. For every
  custom domain (application or preview) add *Zone: Read* and *Workers Routes:
  Edit* on that zone. Setup reads the zone before creating anything, so a token
  without Zone Read stops with an explicit message and no resources are created.
  Cloudflare Email Sending uses its own dedicated token with *Email Sending: Edit*
  (see below); never reuse the deployment token for it.
- **Setup token.** Set `H2H_SETUP_TOKEN` (at least 32 characters) before
  deploying a fresh installation, for example
  `export H2H_SETUP_TOKEN=$(openssl rand -hex 32)`, and keep the value private.
  Deploy stores it as a Worker secret; `/setup` then asks for it before the first
  owner can be created. Optionally also set `H2H_SETUP_OWNER_EMAIL`
  before `setup -- --remote` to restrict first-owner setup to that email.

### Choosing the public origin

Set these in the invoking shell:

| Variable | Rule |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The 32-character hexadecimal account ID. |
| `H2H_RESOURCE_PREFIX` | 3–40 characters: a lowercase letter followed by lowercase letters, digits or hyphens. It names the Worker (`<prefix>`), D1 database (`<prefix>-db`), R2 bucket (`<prefix>-files`) and queues (`<prefix>-jobs`, `<prefix>-jobs-dead`). |
| `H2H_PUBLIC_ORIGIN` | An `https://` origin with no path, port, query or credentials. It becomes `APP_ORIGIN`. |

The public origin can take one of two forms (`scripts/deployment/config.mjs` and
`scripts/deployment/domains.mjs` enforce these rules):

- **workers.dev**: `https://<prefix>.<your-subdomain>.workers.dev`. The first
  label must equal `H2H_RESOURCE_PREFIX`, and `<your-subdomain>` is the account's
  workers.dev subdomain (Workers & Pages → your subdomain in the Cloudflare
  dashboard; register one first if the account has none). Setup enables the
  workers.dev route for the Worker.
- **Custom domain**: any DNS hostname whose zone is **active in the same
  Cloudflare account**. Setup looks up the zone with the Cloudflare API before it
  creates resources and refuses zones that are missing, inactive or in another
  account. Deploy attaches the hostname as a Worker custom domain; Wrangler
  reports DNS conflicts and certificate issuance.

Website preview (`PREVIEW_ORIGIN`) must be a separate **custom domain** in an
active zone of the same account. It cannot be a workers.dev hostname and cannot
equal the application origin. Omit it to leave website preview disabled.

### Commands

`pnpm run setup -- --plan` validates the target and prints resource names only.
`pnpm run setup -- --remote` finds or creates the D1 database, R2 bucket and both
queues, records the selected bindings, routes and public variables in the private
file `.seed/deployment/<prefix>/wrangler.json`, and applies remote D1 migrations.
It changes remote resources and schema but **does not publish Worker code**.

`pnpm run deploy -- --remote` requires the same target and unchanged public
variables. It collects migrations, builds the Worker, checks that the emitted
configuration matches the target, applies migrations, passes configured secrets
to Wrangler through a temporary mode-0600 JSON file (never as command arguments),
publishes the Worker and assets, deletes the temporary file and waits for
`/health`. If you change a public variable, run setup again first. Secrets that
you leave unset are not revoked: rotate or delete existing Worker secrets with
Wrangler when you intend to.

A fresh installation (one with no owner yet) deploys only with a private
`H2H_SETUP_TOKEN` of at least 32 characters. Without one, deploy reads the
remote D1 setup state after applying migrations and, if no owner exists, stops
before uploading the Worker. Enter the token at `/setup`; creating the first
owner then closes setup permanently. Redeploys of an installation that already
has an owner may omit it. At runtime, a Worker reached through any non-loopback
host, or configured with a public `APP_ORIGIN`, answers owner setup with HTTP 503
until a token is configured, so a Worker published some other way cannot be
claimed by whoever reaches it first. The standalone installer and Run Edit Run
hosted installations supply the token themselves.

`GET /health` reports the runtime plus D1 and R2 reachability, or HTTP 503. It
does not prove queue delivery, sockets, tenant behavior, provider budgets, email
receipt, GitHub access or model quality; check the journeys you rely on
separately after each deployment.

### Security headers

Operator pages and every API response carry `Content-Security-Policy:
frame-ancestors 'self'` (plus `RER_MANAGEMENT_ORIGIN` when configured),
`X-Content-Type-Options: nosniff` and `Referrer-Policy:
strict-origin-when-cross-origin`. `X-Frame-Options: SAMEORIGIN` is sent only when
no management origin may frame the app. Published Help Center pages stay
embeddable on customer sites (no framing restriction), the website-preview proxy
keeps its own sandbox policy, and the widget script is a static asset served
without these headers.

## Optional native capabilities

Runtime variable and secret allowlists live in
`scripts/deployment/environment.mjs`. Setup copies configured variables into the
remote configuration and deploy passes configured secrets privately. Local
`.dev.vars` accepts the same names. A provider you do not configure fails
explicitly where it is used; the application never invents answers or reports
fake delivery.

| Capability | Public/runtime configuration | Private secret bindings |
| --- | --- | --- |
| Owner access and registration | `APP_ORIGIN` (remote setup derives it), `REGISTRATION_ENABLED`, optional `H2H_SETUP_OWNER_EMAIL` | `H2H_SETUP_TOKEN` for first-owner setup; optional `TURNSTILE_SECRET`; registration/recovery need the email configuration |
| Ensemble reply, assist, profiles and monitoring | Models selected in project/AI configuration; `CONTEXT_MODEL` for widget-triggered context work | Selected `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY` |
| Knowledge crawl and semantic search | `APIFY_CRAWLER_ACTOR_ID`, `QDRANT_URL`, `KNOWLEDGE_EMBEDDING_MODEL` | `APIFY_TOKEN`, `QDRANT_API_KEY`, `OPENAI_API_KEY`; supplied-content lexical retrieval does not require these providers |
| Help-center provider import | Explicit platform/subdomain and destination project per import | `INTERCOM_TOKEN`, `FRESHDESK_TOKEN`, `ZENDESK_TOKEN`/`ZENDESK_EMAIL` for the selected provider |
| Email and inbound mail | `EMAIL_PROVIDER` (`resend`, `cloudflare` or `sendgrid`), `EMAIL_ACCOUNT_ID` for Cloudflare, project email settings; native inbound endpoints | `EMAIL_API_KEY`, `EMAIL_FROM`, `INBOUND_EMAIL_TOKEN` |
| Lead research and reviewed outreach | `LEAD_MODEL`; persisted lead review before sending | `OPENAI_API_KEY`, selected email configuration |
| GitHub | `GITHUB_CLIENT_ID`, optionally `GITHUB_PROJECT_ID` for one fixed credential | `GITHUB_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`; optional `GITHUB_TOKEN` or JSON `GITHUB_TOKENS` map keyed by project ID |
| Brand image generation | Explicit `BRAND_IMAGE_MODEL`, `BRAND_IMAGE_SIZE`, `BRAND_IMAGE_QUALITY` | `OPENAI_API_KEY` |
| Authenticated website preview | `PREVIEW_ORIGIN` (separate custom domain); owner/admin creates a scoped grant for a project | None; preview grants enforce scope, expiry and request limits |
| Customer widget | Project widget key and exact allowed origin; installed on the owner's selected website | None; never expose an operator token |
| Public request limits and AI ceilings | Optional JSON `RATE_LIMITS` and `AI_DAILY_CEILINGS` overriding any subset of the defaults (see below) | None |
| Training/evaluation | Explicit model/budget per run; `TRAINING_PRICE_CEILINGS` bounds raw provider usage; local-only `ENABLE_SYNTHETIC_EVALUATION=true` for synthetic test admission | Selected model provider credential |

Email details, including Cloudflare Email Sending prerequisites and SendGrid
Inbound Parse, are in `src/modules/integrations/README.md`. To import a help
center, open Settings → More settings → Knowledge → Import; the form chooses the
provider and subdomain and the credentials come from the server bindings above.

Preview must use a hostname separate from the application's origin; never run
untrusted proxied pages under the owner-session origin. `INTEGRATION_ENCRYPTION_KEY`
is the base64 encoding of 32 random bytes (`openssl rand -base64 32`); do not
rotate it without migrating the encrypted stored connections. Configure GitHub
OAuth redirects and inbound email webhooks with the actual deployed URLs. Local
computer work additionally needs the separately packaged connector, a fresh device
pairing and an explicit delegated grant (see `local-agent/README.md`); it never
runs as a Worker subprocess.

## Public request limits and daily AI ceilings

The widget key and allowed origin are public, and a client outside a browser can
send any `Origin`. Visitor, registration and project-creation requests are
therefore bounded by counters in D1 (`abuse_counters`). No Cloudflare rate-limit
binding is needed. A refused request gets HTTP 429 with `Retry-After` and
`{"error", "code": "rate_limited", "limit", "retryAfter"}`; the widget shows the
message and never resends the refused message on its own. Signed-in project
members are not limited on conversation, message or upload routes.

`RATE_LIMITS` is a JSON object overriding any subset of these defaults (positive
integers): `widgetSessionsPerIpHour` 30, `widgetSessionsPerProjectHour` 5000,
`conversationsPerContactHour` 10, `conversationsPerIpHour` 30,
`conversationsPerProjectHour` 5000, `messagesPerConversationMinute` 15,
`messagesPerContactHour` 120, `widgetEventsPerContactMinute` 120,
`uploadsPerContactDay` 30, `uploadBytesPerContactDay` 100000000,
`uploadsPerProjectDay` 5000, `uploadBytesPerProjectDay` 5000000000,
`registrationsPerIpDay` 5, `projectsPerIpDay` 10, `projectsPerAccountDay` 10.
Visitors behind one shared address (an office NAT, a mobile carrier) share the
per-address session and conversation limits; raise `widgetSessionsPerIpHour` and
`conversationsPerIpHour` for audiences like that.

The `…PerProject…` ceilings bound what many rotating client addresses can create in
one project: widget sessions (and the visitor contacts they create), new
conversations, and attachment count and bytes. The widget opens a session and a
conversation for each new visitor, so the hourly ceilings are the number of new
visitors a project can take per UTC hour; raise them if your site has more. Past a
per-project ceiling, new visitors in that project see "This chat is very busy right
now" (or that attachments are unavailable) until the window resets; returning
visitors keep their sessions and conversations. Other projects are unaffected.

`AI_DAILY_CEILINGS` caps the automatic AI work visitors can cause, per UTC day
(positive numbers; `spendUsdPerProject` may be fractional): `repliesPerProject`
200, `spendUsdPerProject` 10, `repliesPerInstallation` 2000 (an installation-wide
reply ceiling across all projects), `contextRunsPerProject` 500. Past a ceiling,
visitor messages are still saved and delivered to operators, but no automatic
reply is generated until 00:00 UTC; the transcript shows **Automatic AI reply
skipped** and the skipped reply is never replayed. A visitor's explicit reply
request from the widget past a ceiling gets HTTP 429 with `Retry-After` set to the
seconds until 00:00 UTC and a generic "assistant is not available" message; which
ceiling was reached and the project's spend are shown only to operators. The spend figure is an
estimate from the cost the provider reports for completed rounds, so replies in
flight can overshoot it; set spending limits with your AI provider too. Project
members can read the day's usage, ceilings and reset time with
`GET /api/dashboard/projects/:projectId/ai-usage`.

Invalid values are rejected at deployment and fail requests visibly at runtime;
they never remove a limit silently. Full tables are in
[docs/PUBLIC-LIMITS.md](docs/PUBLIC-LIMITS.md).

**Warning for `REGISTRATION_ENABLED=true`:** every self-registered project uses
the installation's provider keys, so total automatic AI spend can reach the
per-project ceiling times the number of projects. Only `repliesPerInstallation`
caps the total. `registrationsPerIpDay`, `projectsPerIpDay` and
`projectsPerAccountDay` only slow new sign-ups; they do not stop a distributed
sign-up campaign. Before enabling registration, set `TURNSTILE_SECRET`, set
`repliesPerInstallation` to a daily amount you are willing to pay, and set
provider-side spending limits.

## Contact erasure

Owners and admins can erase a contact's personal data from the dashboard
(Contacts → the contact → **Erase personal data…**, type `ERASE`) or with
`POST /api/management/projects/:projectId/contacts/:contactId/erase`. Operators
cannot. Erasure removes the contact's name, email, identifier and metadata, its
widget sessions, the content of messages in its conversations, attachments and
their R2 objects, customer context, internal notes, AI and delegated-work text,
imported bucket summaries, its address in the email delivery log, inbound email
evidence (only the classifier's reasons remain) and legacy import copies.
Conversations and message rows (ID, author role, revision, time) remain with the
content removed, and a non-identifying `contact_erasures` tombstone records who
erased the contact, when, and how much was removed. Repeating an erasure is safe
and finishes an interrupted one.

The contact **Delete** button only hides and blocks a contact. Erase contacts
before deleting a project: project deletion removes every membership, after which
nobody can erase through the product. Erasure cannot reach data already sent to
AI, email, GitHub or embedding providers or to paired computers, or D1 Time
Travel backups (up to 30 days). See [docs/PRIVACY.md](docs/PRIVACY.md).

## Automatic inbound mail

Mail that a machine generated is admitted to the conversation transcript but
never answered automatically. This covers out-of-office and other autoresponder
replies, bounces and delivery reports, mailing-list mail, senders such as
`no-reply` or `mailer-daemon`, and subjects that start with an autoresponder
prefix. Such a message is labelled **automatic** in the dashboard. It requests no
AI reply and sends no operator or contact notification, on first delivery and
when the scheduler replays pending work. The classification is recorded before
the message is admitted and survives recovery and redelivery. Its reasons appear
in the message's `origin`, and the stored evidence can be read by owners and
admins with `GET /api/management/projects/:projectId/inbound-emails/:messageId`
(see [docs/INBOUND-EMAIL-RECOVERY.md](docs/INBOUND-EMAIL-RECOVERY.md)).

- A message with a null envelope sender is refused, not admitted: the Cloudflare
  Email Worker rejects it with `Envelope sender required`, and the SendGrid
  Inbound Parse route returns HTTP 400 when `envelope.from` is empty. Expect
  bounces addressed to a null return path to be refused. SendGrid may retry
  non-2xx responses; that has not been verified against the live service.
- A gateway posting to `POST /api/integrations/email/inbound` should forward the
  optional `envelopeFrom`, `subject` and `headers` (an object) fields. Without
  them, automatic mail arriving through the gateway may be treated as customer
  mail.
- Conversation notifications sent through Resend or SendGrid carry
  `Auto-Submitted` (`auto-replied` for AI replies, `auto-generated` otherwise)
  and `X-Auto-Response-Suppress: All`. Cloudflare Email Sending does not carry
  them yet, because its allowed custom headers have not been verified.

This behavior is checked with local D1, provider fixtures and a local emitted
Worker. No live mail loop has been exercised.

## Delegated local work and revocation

Local computer work runs only in the separately packaged connector on a paired
computer. Revoking a device or grant withdraws its authority; the server cannot
know whether a run on that computer actually stopped.

- Revoking a device also revokes the other devices under the same grant, and
  revoking a grant revokes every device it backs. Queued work is cancelled.
  Started work becomes `revoked`, with `delivery_state` `authority_revoked`, or
  `membership_lost` when a heartbeat finds that the operator has left the
  workspace. Work on other devices, including devices revoked earlier, is not
  touched, and the conversation can be delegated again straight away.
- The dashboard shows such work as **Authority revoked · local outcome
  unconfirmed**, or **Workspace access ended · local outcome unconfirmed** after
  membership loss. Check the paired computer yourself; only the device can
  report that it cancelled the work.
- A connector that reconnects with the claim id of a job that has since finished
  or been revoked gets no assignment (`data: null`), then claims fresh work under
  a new claim id.
- If authority is lost before a completed report's follow-up effects (an
  internal note or a legacy reply) have run, the effect is `blocked` and the job
  records `delivery_state` `authorization_lost`; the report stays completed and is
  never reopened. A reply that fails delivery gets a `needs_review` receipt and
  `delivery_state` `review`, and the report is reopened for input only when no
  replacement delegation holds the conversation.
- The minute schedule retries each pending result effect on its own. A failing
  one is logged (`Local result effect recovery failed for job …`), stays pending
  for the next run, and does not stop the scheduled recoveries after it.
- An import from the original service brings started delegations in as `revoked`
  with `delivery_state` `authority_revoked`, completed at the export time unless
  the export records a completion time, and queued ones as `cancelled` and
  `held`.

See `local-agent/README.md` for pairing and the connector.

## Upgrading an existing installation

Deploy applies new migrations before publishing the Worker.
`0102_public_abuse_limits.sql` only adds the `abuse_counters` table and its index.
`0103_contact_erasure.sql` adds `messages.erased_at` (null for existing messages)
and the `contact_erasures` and `contact_erasure_objects` tables.
`0104_inbound_email_classification.sql` only adds columns and an index to the
inbound mail receipts; a failed receipt written before it is classified when it
is next claimed. Existing data is untouched by all three.

AI reply generation commands are identified by their id together with a
canonical form of the actor that requested them, so the scheduled outbox replay
is idempotent for messages admitted by email, the widget or an operator. Earlier
builds could leave a conversation's outbox undelivered on every scheduler run
after a failed, queued or uncertain generation for an email message. No action
is needed after upgrading: existing records written in the earlier form are
recognised.

## Importing data from the original HappyToHelp service

`node scripts/import-legacy.mjs --file /absolute/export.json` plans an import
without writing anything. Add `--apply` (optionally `--persist-to .wrangler/state`,
the default) to import into the migrated local D1/R2 state. The importer is
local-only and never reads a production database. Use a consistent export with
exact IDs, decimal money and retained object bytes/hashes; see
`src/modules/legacy-import/README.md`.

Imports resume by artifact SHA and per-row receipts; they are not atomic across
the whole database. Re-running the same artifact skips committed rows, and
conflicting rows or objects stop without overwriting. Inspect
`legacy_import_rows`, run records and `legacy_import_holds`: archive-only rows do
not imply live behavior. Historical financial rows remain read-only records, and
ambiguous generation, training or provider work needs reconciliation before any
new provider attempt. No imported session, password token or device grant
becomes trusted authority.

## Source custody

Use `pnpm run source:inspect`, `source:check`, `source:lock` and `source:release`
for source authoring and release custody; see [docs/AUTHORING.md](docs/AUTHORING.md).
The whole repository is MIT licensed (see `LICENSE`); third-party components keep
the notices listed in [docs/SOURCE-PROVENANCE.md](docs/SOURCE-PROVENANCE.md).
A source release, local checks and importer fixtures do not by themselves
establish a deployment or a production data migration.

`node scripts/build-delivery-artifact.mjs` produces a byte-reproducible artifact.
For a given commit it does not depend on the checkout path, build time, locale or
host, provided you build with the Node and pnpm versions declared in
`package.json`; a different Node release may compress the connector download
differently. The connector download (`happytohelp-local-agent.tar.gz`) has
normalized metadata: numeric root owner, 0644/0755 modes and a fixed 1985-10-26
timestamp on every file. Symlinks in `local-agent/` are refused at build time.
`pnpm run test:reproducible-build` (about 90 seconds) builds two fresh copies at
different paths and requires the same SHA-256 and no builder, repository,
temporary or home paths; it runs in the delivery workflow, not in
`pnpm run verify`. `dist/server/wrangler.json` is Wrangler's local deploy
configuration and names your checkout: it is excluded from the artifact and must
never be published.

## Optional local owner sign-in

For trusted local development with exactly one existing owner, run:

```sh
H2H_LOCAL_OWNER_LOGIN=1 pnpm run dev --port 5174 --strictPort
```

Opening `/projects` or `/login` then creates an ordinary owner session for the
existing local account. It does not create an owner or change passwords. With
zero or several active owners, use normal login or first-owner setup. The opt-in
binds Vite to loopback, disables remote Cloudflare bindings and accepts only
same-origin browser POSTs from loopback. Anyone who can reach that development
server can enter the owner's workspace; use it only on a trusted machine.

Without the environment flag, normal password login applies. The automatic
sign-in endpoint and client behavior are excluded from production builds, even
when the flag is present during `pnpm run build`. Deployed authentication and
normal tenant/permission checks are unchanged. Signing out while the opt-in is
active returns to automatic sign-in; restart without the flag to test logout.

## Measured local usage and cost scenarios

The [2026-09-29 operating-usage record](docs/usage/README.md) measures a real local
emitted Worker conversation with three visitor messages, two owner replies,
a 1 MiB upload/download and socket reconnect/replay. A new visitor used 12 dynamic
requests; a returning visitor with a valid token used 11. Both used one R2 put,
one get, 12 immediate DO fetches and one incoming socket frame. Scheduled outbox
recovery added two DO fetches per conversation. Complete D1 row totals, hosted
CPU/DO duration/storage and actual Cloudflare billing remain unknown; partial
query metadata and local file sizes are retained without treating them as bills.
No AI provider ran: provider calls were zero, token usage and cost are null.

For 1, 1,000 and 10,000 conversations/month, the record separates 43,200 scheduled
monthly ticks, setup, static assets and the measured per-conversation units. With
an otherwise unused paid account and assumed owner-managed 30-day R2 retention,
priced component subtotals are $5.000, $5.000 and $5.015. These **exclude unknown
CPU, D1, DO duration/storage, AI/email and other costs** and are not total bills.
Retention is a scenario, not an automatic expiry policy. See the record for dated
official rates, formulas, raw JSON, reproduction commands and limitations.

`node --test tests/usage-limits.mjs` proves configured local request 429/
`Retry-After` behavior and project/installation daily AI count ceilings without
provider execution. Configurable defaults remain guards, not measured capacity.

The composed `c7f0d1b8` candidate was also measured on a local emitted Worker on
2026-09-29 UTC. Its source revision, emitted digest, instrumentation hashes,
per-phase units, test receipt, priced scenarios and unknowns are preserved in
[`verification/rc-0.2.2-rc.1/composed-usage.json`](verification/rc-0.2.2-rc.1/composed-usage.json).
That run recorded 12 dynamic Worker requests for a new visitor and 11 for a
returning visitor, with 116 and 111 D1 statements respectively. D1 total row
counts, hosted CPU, hosted DO duration/storage and total billing remain null.
It made zero AI provider calls; provider tokens and cost are null. Its assumed
monthly price subtotals are not total bills. The measurement predates the final
metadata/source freeze and must not be presented as the frozen RC's emitted
identity.

`pnpm run test:usage` prepares generated migrations, then runs the existing
`tests/usage-summary.mjs` and `tests/usage-limits.mjs`. On the measured source
revision the root run recorded 2/2 passing tests, including real local
`201, 201, 429` request-limit outcomes and project/installation AI admission
ceilings, with no provider calls. This focused result is separate from
`pnpm run verify` and hosted acceptance.

## Private 0.2.2-rc.1 qualification boundary

This branch labels a private preservation candidate; public release remains HOLD.
The current f205 accessibility gate is complete and fails checker reliability,
with confirmed owner HOLD after two correction rounds. Four oracle false accepts
and the root widget timing/background false failure remain recorded; 21 passing
states do not close those limitations or establish complete WCAG conformance.
See [HANDOVER.md](HANDOVER.md) and the
[current receipt](verification/rc-0.2.2-rc.1/final-qualification.json) for exact
source pins, retained failures, LIMITED coverage and the owner direction.

The external port/import-adapted original v0.2.1 independent proof now passes
97 tables/37 migrations and has root replication. Its unchanged command remains
held at ports 12401/12501/default inspectors; it does not qualify this candidate's
104 tables/38 migrations. Full verify, original port/lifecycle exceptions,
separate portable-fidelity acceptance and final source-lock checks remain held
or pending as recorded in HANDOVER. No publication, deployment or production
cutover follows from these focused results.
