# HappyToHelp operations

## Run it on your computer

You need Node.js (with npm) and Git. Rer provisions the checkout's pinned Node
and pnpm, installs dependencies and starts local setup:

```sh
npm install -g @runeditrun/rer
git clone https://github.com/just-every/run-happytohelp
cd run-happytohelp && rer dev
```

`rer dev` uses its local address for the chat widget and generates a private
owner password, then prints the development sign-in outbox link. No private
answers, email service or AI account are needed. Open the link and sign in to
your workspace. Use `rer dev --stop` from the checkout to stop the managed app.

The checkout retains its exact **0.2.4** command package pin. The global rer
entry point uses that local package after provisioning its tools.
For scripted setup, prepare [private answers](docs/INSTALLER.md#private-setup-answers),
then run `rer setup --owner-email you@example.com --answers .seed/local-answers.json`.
Setup reruns preserve owner, data and private settings; conflicting saved email
or origin is refused. See [contributor setup](README.md#contributor-setup) for
working directly with pnpm.

### Find your way around

The inbox, knowledge, customer context and workspace settings use the same native
actor/project authority. The sidebar's Setup page runs its own checks and records
observed provider and widget behavior; saved defaults do not pass it. Every new
workspace starts with a starter assistant, a reply-by-email mailbox (when
`INBOUND_EMAIL_TOKEN` exists) and the installation sender. Workspace creation starts
with the widget snippet, and Advanced holds secrets/verification examples.

See [Local command reference](RUN-LOCALLY.md) for loopback ports, production
preview, explicit stop and idle shutdown. An occupied explicit port refuses;
rer never chooses another silently. Saved remote mail is preserved: use a
separate checkout for a local outbox trial.

## Local data and backups

Canonical D1/R2/KV/DO state is `.wrangler/state`. Private generated settings are
`.dev.vars` and its declared recovery copy `.dev.vars.previous` (0600);
installer drafts/logs are `.seed/installer` and CLI bookkeeping is `.rer/local`.
Secret directories are 0700. Never commit these, answers or private archives.
Ambiguous prior state, symlinks and unsafe placement require explicit recovery;
rer never silently moves or removes it.

Stop dev before export, import or reset:

```sh
rer export --output exports/support.rer
rer reset --yes
rer import --input exports/support.rer --yes
rer setup --owner-email you@example.com --answers .seed/local-answers.json
```

Export creates a new owner-only archive with integrity and explicit exclusions.
It includes supported domain rows, native identities/password hashes and FILES
objects. Sessions, one-use links, development outbox, private configuration,
provider/integration credentials, outbound execution queues and local-computer
pairing/grants/jobs are excluded. Signed visitor verification is reconfigured.
Archives contain sensitive data and must be protected as backups.

Import validates integrity and resource coverage before atomic restore into an
empty destination. It preserves native owners; setup does not claim a new owner
over them. Re-enter private configuration and external integration credentials.
Restore sends no mail, model request or connection notification. Remote transfer
is unsupported and refuses with exit 4. D1/R2 archives do not include Durable
Object storage or establish full portable-storage fidelity.

Reset prints its inventory and requires explicit confirmation. It removes only
local state, owners/sessions/outbox, `.rer/local`, `.seed/installer` and declared
private settings/recovery copies. Source, dependencies, lockfiles, manifest,
export archives and `.rer/deploy` receipts survive. Active operations refuse.
A second reset succeeds with an empty inventory, and subsequent setup creates
an empty installation. Keep answers outside `.seed/installer` if needed after reset.

## Deploy to your Cloudflare account

Use the real `deploy.json` declaration with Base deploy-kit. The command derives
resource names and the application origin from the project/environment and the
owner's account. Configure private `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` in the process environment; never pass or print token
values. The token needs the declared Workers, D1, R2 and Queues capabilities.
Enable R2 before provisioning. Commit source before a real deployment.

### What you need first

Use an account-owned API token pinned to the intended account, with account
permissions **Workers Scripts: Edit**, **D1: Edit**, **Workers R2 Storage: Edit**
and **Queues: Edit**. This declaration does not need KV or zone permissions.
An account-owned token does not need or support **User Details** or
**Memberships** for this flow. Keep the token in private environment input.
The account also needs an enabled R2 service and a workers.dev subdomain.

### Find your account ID

Copy the intended account ID from the Cloudflare dashboard and explicitly set
`CLOUDFLARE_ACCOUNT_ID` in the same private environment as
`CLOUDFLARE_API_TOKEN`. Rer uses this pinned account directly: no user discovery
or `wrangler whoami` is required. Check that the dashboard account, token scope
and supplied ID agree before deploying.

For a **user-owned** token only, optional user/account discovery with
`pnpm exec wrangler whoami` may require User Details and Memberships read
permissions. That discovery is a convenience for choosing an account; it is
not a prerequisite for an account-owned token or a reason to broaden its scope.

The declaration names DB, FILES, CONVERSATIONS, JOBS, its dead-letter queue and
scheduled recovery. Declared secret bindings include `OWNER_EMAIL`,
`H2H_SETUP_TOKEN`, `INTEGRATION_ENCRYPTION_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM`
and `EMAIL_API_KEY`. Before the first hosted deployment, supply the mail provider
(`resend`, `sendgrid` or `cloudflare`), verified sender address and sending token
in private environment variables or an owned 0600 `--env-file`. Provider and
sender are stored as secret bindings too, so the deployment declaration contains
no account-specific values. Rer supplies the owner email from local setup and
generates missing setup/encryption secrets. Existing Worker secrets are retained;
use `rer deploy --set-secret NAME` to change one deliberately.

Cloudflare Email Sending additionally needs `EMAIL_ACCOUNT_ID`. Add
`{"binding":"EMAIL_ACCOUNT_ID","environment":"EMAIL_ACCOUNT_ID"}` to the
declaration's `secrets` array and supply that account ID privately before deploying
with Cloudflare mail. It is not required for Resend or SendGrid; rer 0.2.13 requires
every declared secret on a new Worker and has no conditional secret declaration.

Preserve existing keys and owner data. Configure other optional mail/model inputs
through the supported runtime declaration and native workspace settings. Local
development keeps its outbox without a mail account, and deploy dry-run needs no
mail credentials. Deployment never converts remote mail into development capture.

```sh
rer deploy --dry-run
rer deploy --environment production
```

Default environment is production. Dry run validates the declaration and real
build locally with zero provider requests. Real deploy builds, provisions,
applies migrations, publishes and checks health in the owner account. It is an
external change requiring owner authorization. Release produces source/artifacts
with its existing `--repo` and `--output` arguments and never pushes or deploys.
Inspect `rer describe` and per-command `--help` for other flags.

### If setup fails at the R2 step

Enable R2 in the account, confirm permissions and inspect the deploy-kit failure
before resuming. Preserve existing resources and uncertain provider outcomes;
never automatically replay ambiguous work or switch resource targets to hide it.

### Claim your new installation

An empty hosted installation uses the native `/setup` form with its private
first-owner capability. Keep it out of URLs, logs and recordings. Claim closes
permanently and never bypasses tenant authority. See [First-run setup](docs/SETUP-WORKFLOW.md).

### What `/health` does and does not tell you

Health means the native Worker can reach D1 and R2. It does not qualify queues,
sockets, email delivery, provider access, custom domains, compliance or product
acceptance. Confirm those through their public flows on the intended installation.

### Finish a disposable hosted proof

Before provisioning, save a complete account inventory and a private owned
resource list for the authorized disposable run. Record the exact planned
Worker name, DB database name/ID, FILES bucket name, JOBS queue name/ID,
JOBS_DEAD_LETTER queue name/ID, and the derived CONVERSATIONS Durable Object
namespace name/ID for class `ConversationSocket` after upload. Get identities
from the deployment receipt and provider readback, rather than guessing names
from a prefix. Refuse collisions with pre-existing resources. Record the
Worker's schedules and queue consumers too. Retain this inventory and all
observations outside product source; never include tokens or customer content
in public evidence.

After observations are complete, stop the journey and any other producers.
Delete only resources whose exact identity and ownership match that list:

1. Enumerate uploaded object keys in the owned FILES bucket, remove those
   objects, and list the bucket again to prove it is empty. A partial listing
   or unexpected object needs reconciliation before deleting the bucket.
2. Enumerate consumers of each owned queue with
   `GET /accounts/<account-id>/queues/<queue-id>/consumers`. Check every
   consumer's `script` (or `script_name`) against the exact owned Worker name
   and its `consumer_id` against readback. Stop on an unrelated consumer.
   Detach the verified consumer with
   `DELETE /accounts/<account-id>/queues/<queue-id>/consumers/<consumer-id>`
   and read back the empty consumer list **before** deleting the Worker.
   Cloudflare error **10064** means the Worker still consumes a queue; inspect
   and detach that owned consumer instead of replaying Worker deletion blindly.
3. Delete the owned Worker (and thus its schedules/bindings), then the main
   JOBS queue **before** its JOBS_DEAD_LETTER queue. Delete the emptied FILES
   bucket and the owned DB database by their verified names/IDs.
4. Take complete post-delete Worker, D1, R2, Queue and Durable Object namespace
   inventories; confirm all owned names/IDs, including the derived namespace,
   are absent. Do not assume Worker deletion proves namespace removal. Compare
   against the before inventory and account for unrelated resources without
   deleting them. Record failed requests and the corrected ordering as evidence.

These are destructive steps for an explicitly disposable, authorized scope.
They are not an upgrade, reset or cleanup procedure for a retained installation.
Use authenticated account API tooling that loads credentials privately, never
token-bearing command arguments. Incomplete inventories are not teardown proof.

## Optional features and their settings

Runtime allowlists live in `scripts/deployment/environment.mjs`; native secrets
remain private. Local settings changes need an explicit restart. For online
changes update the real declaration and private inputs, then use rer deploy.
Do not rotate encryption keys without migrating encrypted stored connections.

### Which settings matter for a small team

Most single-team installations only need a few rows of the table below:

- **AI replies:** one provider key, then an assistant chosen in the dashboard
  (see [Set up AI replies](README.md#set-up-ai-replies)).
- **Email, sending and receiving:** for invitations, password recovery and email
  conversations.
- **Customer widget:** set in the dashboard; nothing to configure here.

The rest are for specific needs. In the table, *Ensemble* is the AI library
HappyToHelp uses for replies; *training and evaluation* runs appear in the
dashboard as **Evaluation runs**; and *lead research* drafts outreach emails for
platform administrators (see [the integrations guide](src/modules/integrations/README.md#lead-outreach)).
*Project* is the name the configuration and API use for a workspace.

| Feature | Variables and other configuration | Secrets |
| --- | --- | --- |
| Owner access and sign-up | `APP_ORIGIN` (deployment derives it), `REGISTRATION_ENABLED`, optional `H2H_SETUP_OWNER_EMAIL` | `H2H_SETUP_TOKEN` for first-owner setup; optional `TURNSTILE_SECRET` |
| AI replies, assist, profiles and monitoring (Ensemble) | The installer's `AI_PROVIDER` answer (`openai`, `anthropic`, `google`, `deepseek`, `xai`, `openrouter` or `later`, the default) chooses which key to store at setup; models are selected in workspace and AI configuration (the dashboard's **AI** page); `CONTEXT_MODEL` for widget-triggered context work. Every new workspace's starter assistant answers visitors by itself once any provider key is installed, within `AI_DAILY_CEILINGS`; with none, new conversations stay with the team | Selected `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`; the key is optional at setup and never stored with `later` |
| Knowledge crawl and semantic search | `APIFY_CRAWLER_ACTOR_ID`, `QDRANT_URL`, `KNOWLEDGE_EMBEDDING_MODEL` | `APIFY_TOKEN`, `QDRANT_API_KEY`, `OPENAI_API_KEY`. Keyword search over content you supply needs none of these providers. |
| Help center import from another provider (Intercom, Freshdesk or Zendesk) | Platform/subdomain and destination workspace chosen for each import | `INTERCOM_TOKEN`, `FRESHDESK_TOKEN`, `ZENDESK_TOKEN`/`ZENDESK_EMAIL` for the selected provider |
| Email, sending and receiving | `EMAIL_PROVIDER` (`resend`, `cloudflare` or `sendgrid`), `EMAIL_ACCOUNT_ID` for Cloudflare, optional `INBOUND_EMAIL_DOMAIN` (the domain new workspaces' reply mailboxes are created under; default `in.` plus the workspace's website host), workspace email settings; built-in inbound endpoints | `EMAIL_API_KEY`, `EMAIL_FROM` (the installation sender every new workspace uses until its own domain is verified), `INBOUND_EMAIL_TOKEN` (generated by local setup, optional on a hosted installation; with it every new workspace gets a reply-by-email mailbox, without it none is created) |
| Lead research and reviewed outreach | `LEAD_MODEL`; each lead is saved and reviewed before sending | `OPENAI_API_KEY`, selected email configuration |
| GitHub | `GITHUB_CLIENT_ID`, optionally `GITHUB_PROJECT_ID` for one fixed credential | `GITHUB_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`; optional `GITHUB_TOKEN` or JSON `GITHUB_TOKENS` map keyed by project ID |
| Brand image generation | Explicit `BRAND_IMAGE_MODEL`, `BRAND_IMAGE_SIZE`, `BRAND_IMAGE_QUALITY` | `OPENAI_API_KEY` |
| Signed-in website preview | `PREVIEW_ORIGIN` (separate custom domain); an owner or admin creates a scoped grant for a workspace | None; preview grants enforce scope, expiry and request limits |
| Customer widget | The workspace's widget key and exact allowed origin; installed on the website the owner chooses | None; never expose an operator token |
| Public request limits and daily AI ceilings | Optional JSON `RATE_LIMITS` and `AI_DAILY_CEILINGS` overriding any subset of the defaults (see [Limit public traffic and AI spending](#limit-public-traffic-and-ai-spending)) | None |
| Training and evaluation | Explicit model and budget per run; `TRAINING_PRICE_CEILINGS` bounds raw provider usage; local-only `ENABLE_SYNTHETIC_EVALUATION=true` to admit synthetic test cases | The selected model provider's credential |

### Sign-up and password recovery

Self-service sign-up (`/register`) and password recovery need the email
settings. Without them, `/register` shows that sign-up is closed, and
`/forgot-password` tells the visitor that the workspace owner must reset the
password. Owners can issue a one-hour reset link with
`POST /api/identity/password-reset`.

`REGISTRATION_ENABLED=true` turns on self-service sign-up at `/register`, where
anyone can create an account and their own workspaces on your installation. It
is off unless you set it, and it also needs email and `APP_ORIGIN`. An
installation for your own team doesn't need it: invite teammates from
**Settings → Agents** instead. If you do turn it on, read the warning in
[Cap daily AI work](#cap-daily-ai-work) first.

### Notes on individual features

**Email.** Email setup, including the Cloudflare Email Sending prerequisites and SendGrid
Inbound Parse, is covered in [the integrations guide](src/modules/integrations/README.md).
Configure inbound email webhooks with the actual deployed URLs.

**Import an existing help center.** Open Knowledge → Import. The form chooses the
provider and subdomain; the credentials come from the server secrets in the
table above.

**Website preview.** Preview must use a hostname separate from the application's origin. Never run
untrusted proxied pages under the origin where owners sign in.

**GitHub and stored connections.** `INTEGRATION_ENCRYPTION_KEY` is private installation configuration. Rer setup generates it; deployment reads it privately. Do not rotate it without migrating the encrypted stored connections. Configure
GitHub OAuth redirects with the actual deployed URLs.

**Work on a local computer.** Handing support work to a local computer additionally needs the local agent
(packaged separately from the Worker), a fresh device pairing and an explicit
delegated grant (see [the local agent guide](local-agent/README.md)). It never
runs as a Worker subprocess.

## Limit public traffic and AI spending

The widget key and allowed origin are public, and a client outside a browser can
send any `Origin`. So HappyToHelp limits visitor, registration and
workspace-creation requests with counters stored in D1 (the `abuse_counters`
table). You do not need a Cloudflare rate-limit binding. Full tables are in
[Limits and AI ceilings](docs/PUBLIC-LIMITS.md). In the setting names below,
`Project` means a workspace.

### What happens when a limit is reached

A refused request gets HTTP 429 with a `Retry-After` header and this body:

```
{"error": "<visitor-readable message>", "code": "rate_limited", "limit": "<name>", "retryAfter": <seconds>}
```

The widget shows the message and never resends the refused message on its own.
Signed-in workspace members are not limited on conversation, message or upload
routes.

### Change the request limits

`RATE_LIMITS` is a JSON object that overrides any subset of these defaults. Each
value must be a positive integer.

| Limit | Default |
| --- | --- |
| `widgetSessionsPerIpHour` | 30 |
| `widgetSessionsPerProjectHour` | 5000 |
| `conversationsPerContactHour` | 10 |
| `conversationsPerIpHour` | 30 |
| `conversationsPerProjectHour` | 5000 |
| `messagesPerConversationMinute` | 15 |
| `messagesPerContactHour` | 120 |
| `widgetEventsPerContactMinute` | 120 |
| `uploadsPerContactDay` | 30 |
| `uploadBytesPerContactDay` | 100000000 |
| `uploadsPerProjectDay` | 5000 |
| `uploadBytesPerProjectDay` | 5000000000 |
| `registrationsPerIpDay` | 5 |
| `projectsPerIpDay` | 10 |
| `projectsPerAccountDay` | 10 |

Visitors behind one shared address (an office network or a mobile carrier) share
the per-address session and conversation limits. For audiences like that, raise
`widgetSessionsPerIpHour` and `conversationsPerIpHour`.

The `…PerProject…` ceilings cap what many changing client addresses can create
in one workspace: widget sessions (and the visitor contacts they create), new
conversations, and attachment count and bytes. The widget opens a session and a
conversation for each new visitor, so the hourly ceilings are the number of new
visitors a workspace can take per UTC hour; raise them if your site gets more.
Past a per-workspace ceiling, new visitors in that workspace see "This chat is
very busy right now" (or that attachments are unavailable) until the window
resets. Returning visitors keep their sessions and conversations, and other
workspaces are unaffected.

### Cap daily AI work

`AI_DAILY_CEILINGS` caps the automatic AI work that visitors can cause, per UTC
day. Values must be positive numbers; `spendUsdPerProject` may be fractional.

| Ceiling | Default | What it caps |
| --- | --- | --- |
| `repliesPerProject` | 200 | Automatic replies in one workspace |
| `spendUsdPerProject` | 10 | Estimated AI spend in one workspace, in US dollars |
| `repliesPerInstallation` | 2000 | Automatic replies across all workspaces in the installation |
| `contextRunsPerProject` | 500 | Context runs in one workspace |

Past a ceiling:

- Visitor messages are still saved and delivered to operators, but no automatic
  reply is generated until 00:00 UTC. The transcript shows
  **Automatic AI reply skipped**, and the skipped reply is never replayed.
- A visitor who explicitly asks the widget for a reply gets HTTP 429, with
  `Retry-After` set to the seconds until 00:00 UTC and a generic "assistant is
  not available" message. Only operators see which ceiling was reached and the
  workspace's spend.

The spend figure is an estimate based on the cost the provider reports for
completed rounds, so replies already in progress can overshoot it. Set spending
limits with your AI provider too. Workspace members can read the day's usage,
ceilings and reset time with
`GET /api/dashboard/projects/:projectId/ai-usage`.

Invalid values are rejected at deployment and make requests fail visibly at
runtime; they never silently remove a limit.

> [!WARNING]
> **Before you set `REGISTRATION_ENABLED=true`:** every self-registered
> workspace uses the installation's provider keys, so total automatic AI spend
> can reach the per-workspace ceiling times the number of workspaces. Only
> `repliesPerInstallation` caps the total. `registrationsPerIpDay`,
> `projectsPerIpDay` and `projectsPerAccountDay` only slow new sign-ups; they do
> not stop a sign-up campaign spread across many addresses. Before enabling
> registration, set `TURNSTILE_SECRET`, set `repliesPerInstallation` to a daily
> amount you are willing to pay, and set spending limits with your providers.

## Contact erasure

Use this when a customer asks you to remove their personal data. In
HappyToHelp, a *contact* is the record of a customer who has talked to you.
Owners and admins can erase a contact's personal data; operators cannot.

**From the dashboard:** open Contacts, select the contact, choose
**Erase personal data…** and type `ERASE` to confirm.

**From the API:**
`POST /api/management/projects/:projectId/contacts/:contactId/erase`

Erasure removes:

- the contact's name, email, identifier and metadata;
- its widget sessions;
- the content of messages in its conversations;
- attachments and their R2 objects;
- customer context and internal notes;
- AI and delegated-work text;
- imported bucket summaries;
- its address in the email delivery log;
- inbound email evidence (only the classifier's reasons remain);
- legacy import copies.

Conversations and message rows (ID, author role, revision, time) remain with
their content removed. A `contact_erasures` record, which does not identify the
contact, notes who erased it, when, and how much was removed. Running an
erasure again is safe and finishes one that was interrupted.

Keep in mind:

- The contact **Delete** button only hides and blocks a contact; it does not
  erase anything.
- Erase contacts **before** deleting a workspace. Deleting a workspace removes
  every membership, after which nobody can erase through the product.
- Erasure cannot reach data already sent to AI, email, GitHub or embedding
  providers or to paired computers, or D1 Time Travel backups (up to 30 days).

See [Personal data](docs/PRIVACY.md) for the full list of what is stored, sent
and erased.

## How automatic email is handled

Email that a machine generated is added to the conversation transcript but is
never answered automatically. This covers:

- out-of-office and other autoresponder replies;
- bounces and delivery reports;
- mailing-list mail;
- senders such as `no-reply` or `mailer-daemon`;
- subjects that start with an autoresponder prefix.

Such a message is labelled **automatic** in the dashboard. It requests no AI
reply and sends no operator or contact notification, both when it first arrives
and when the scheduler replays pending work. The classification is recorded
before the message is added and survives recovery and redelivery. Its reasons
appear in the message's `origin`, and owners and admins can read the stored
evidence with `GET /api/management/projects/:projectId/inbound-emails/:messageId`
(see [Inbound email recovery](docs/INBOUND-EMAIL-RECOVERY.md)).

- **Mail with no envelope sender is refused**, not added. The Cloudflare Email
  Worker rejects it with `Envelope sender required`, and the SendGrid Inbound
  Parse route returns HTTP 400 when `envelope.from` is empty. Expect bounces
  addressed to a null return path to be refused. SendGrid may retry responses
  other than 2xx; that has not been verified against the live service.
- **If you use your own email gateway**, have it forward the optional
  `envelopeFrom`, `subject` and `headers` (an object) fields when it posts to
  `POST /api/integrations/email/inbound`. Without them, automatic mail arriving
  through the gateway may be treated as customer mail.
- **Outgoing notifications** sent through Resend or SendGrid carry
  `Auto-Submitted` (`auto-replied` for AI replies, `auto-generated` otherwise)
  and `X-Auto-Response-Suppress: All`, so other systems do not auto-reply to
  them. Cloudflare Email Sending does not carry these headers yet, because its
  allowed custom headers have not been verified.

This behavior is checked with local D1, provider fixtures and a locally built
Worker. No live mail loop has been exercised. The full rules are in
[Email and integrations](src/modules/integrations/README.md#out-of-office-replies-bounces-and-other-automatic-mail).

## Stop work on a paired computer

You can hand a conversation to the local agent on a paired computer. That work
runs only in the local agent on that computer, which is packaged separately and
never runs inside the Worker.

In short: revoking a computer (or the permission it works under, called a
*grant*) stops HappyToHelp from accepting more from it straight away, and you can
delegate the conversation again at once. But HappyToHelp can't see whether a run
already going on that computer actually stopped, so check the computer yourself.

The details, for reference:

- **What revoking affects.** Revoking a device also revokes the other devices
  under the same grant, and revoking a grant revokes every device it backs.
  Queued work is cancelled. Started work becomes `revoked`, with
  `delivery_state` `authority_revoked`, or `membership_lost` when a heartbeat
  finds that the operator has left the workspace. Work on other devices,
  including devices revoked earlier, is not touched, and the conversation can be
  delegated again straight away.
- **What you see.** The dashboard shows such work as
  **Authority revoked · local outcome unconfirmed**, or
  **Workspace access ended · local outcome unconfirmed** after membership loss.
  Check the paired computer yourself; only the device can report that it
  cancelled the work.
- **If the local agent reconnects.** A local agent that reconnects with the
  claim ID of a job that has since finished or been revoked gets no assignment
  (`data: null`), then claims fresh work under a new claim ID.
- **Follow-up effects after authority is lost.** If authority is lost before a
  completed report's follow-up effects (an internal note or a legacy reply) have
  run, the effect is `blocked` and the job records `delivery_state`
  `authorization_lost`; the report stays completed and is never reopened. A reply
  that fails delivery gets a `needs_review` receipt and `delivery_state`
  `review`, and the report is reopened for input only when no replacement
  delegation holds the conversation.
- **Retries.** The once-a-minute schedule retries each pending result effect on
  its own. A failing one is logged
  (`Local result effect recovery failed for job …`), stays pending for the next
  run, and does not stop the scheduled recoveries after it.
- **Imported delegations.** An import from the original HappyToHelp application
  (see [Import data from the original HappyToHelp service](#import-data-from-the-original-happytohelp-service))
  brings started delegations in as `revoked` with `delivery_state`
  `authority_revoked`, completed at the export time unless the export records a
  completion time, and queued ones as `cancelled` and `held`.

See [the local agent guide](local-agent/README.md) for pairing and revoking a
computer.


## Upgrade an existing installation

Back up the selected database, private FILES objects and configuration before
upgrading. Keep applied migration names and bytes immutable. Read RELEASE.json
for the revision's additive migration order and buyer recovery obligations.
Update source while preserving owner customizations and private settings, then
use the rer setup/build path locally or authorized rer deploy remotely before
serving updated code. Never reset as an upgrade mechanism.

Test restoration in separate resources before switching traffic. Retain private
Move in originals and journals, erasure fences, rating cycles/history, unknown
provenance, encrypted credentials/keys and uncertain delivery state together.
Imports and replay must not restore erased identities or send external work.
See [Updates and recovery](docs/INDEPENDENT-RELEASE.md).

### Upgrading from 0.3.x

0.3 ran on Node.js 26.8.1 or newer through `node scripts/install.mjs`,
`pnpm run setup -- --local` and Vite on port 5173. 0.4 runs on Node.js
**22.20.0** through `rer`; `pnpm run setup` and `pnpm run dev`
now call rer. Owners, passwords, members, pending invitations, workspaces,
appearance, contacts, conversations, attachments, articles and categories carry
over unchanged.

On your computer:

1. Stop the app with Ctrl+C in the installer or `pnpm run dev -- --foreground` terminal.
2. Back up local state and private settings outside the checkout:

   ```sh
   cp -a .wrangler/state ../happytohelp-0.3-state
   cp -p .dev.vars ../happytohelp-0.3.dev.vars
   ```

   Skip the second line if you have no `.dev.vars`. Keep both copies private.
3. Update to current public main and keep your own commits, for example
   `git fetch origin main && git merge origin/main`. Resolve conflicts only in files
   you changed.
4. Switch to Node.js 22.20.0 and run `pnpm install --frozen-lockfile`.
5. If `.dev.vars` sets `EMAIL_PROVIDER` to a real provider, setup refuses to
   replace it, because local 0.4 sends sign-in links and customer mail to the
   development outbox. Move the `EMAIL_*` lines into your private backup and
   configure provider mail on your deployed installation instead.
6. Create `.seed/local-answers.json` as in
   [private setup answers](docs/INSTALLER.md#private-setup-answers), with your
   existing workspace name, widget website origin, colour, owner name and owner
   password. Then run setup with your existing owner email:

   ```sh
   rer setup --owner-email you@example.com --answers .seed/local-answers.json
   rer dev --foreground
   ```

   Setup applies `0110_move_in.sql` to `119_local_portability.sql` to the local
   database, reports **Existing owner and workspace preserved**, and adds this
   release's local settings after the lines already in `.dev.vars`, which stay
   unchanged. A different owner email is refused.
7. Open the address dev prints, normally `http://127.0.0.1:8787` rather than port
   5173. Sign in again with your existing password or the outbox link: sessions
   from the old address do not carry over. Pending invitation and password-reset
   links point at the old address; use **Copy link** on a pending invitation to
   issue a fresh one.

On Cloudflare, back up the D1 database, every R2 object with its metadata and
your Worker secrets, including `INTEGRATION_ENCRYPTION_KEY`, as in
[Back up your data](docs/INDEPENDENT-RELEASE.md#back-up-your-data). Then run
`rer deploy --dry-run` and
`rer deploy --environment production`, which applies the
migrations before publishing. This release's upgrade evidence covers local
installations; a hosted upgrade is not part of it.

To go back, stop 0.4, check out your 0.3 commit and restore both copies:
replace `.wrangler/state` with `../happytohelp-0.3-state` and `.dev.vars` with
`../happytohelp-0.3.dev.vars`. Never run 0.3 against a database migrated by 0.4.
The local state copy includes Durable Object storage; rer archives and D1/R2
backups do not.

From 0.4 on, Move in keeps private import originals in R2 and their journals in
D1. Back up and restore them together, with the encryption key, so resume and
undo can verify original bytes.

## Import data from the original HappyToHelp service

This open-source project is a new edition of the original HappyToHelp
application. If you have an export of your data from that original service, you
can bring it into a local installation. If you are starting fresh, you can skip
this section.

1. Plan the import without writing anything:

   ```sh
   node scripts/import-legacy.mjs --file /absolute/export.json
   ```

2. Import into the migrated local D1/R2 state by adding `--apply` (and,
   optionally, `--persist-to .wrangler/state`, which is the default):

   ```sh
   node scripts/import-legacy.mjs --file /absolute/export.json --apply
   ```

The importer runs locally only and never reads a production database. Use a
consistent export with exact IDs, decimal money and the original object
bytes/hashes kept; see `src/modules/legacy-import/README.md`.

**How imports behave:**

- Imports resume using the export file's SHA and a receipt for each row; they
  are not atomic across the whole database.
- Running the same export again skips rows already committed, and conflicting
  rows or objects stop the import without overwriting anything.
- Inspect `legacy_import_rows`, the run records and `legacy_import_holds`.
  Rows kept only as an archive do not mean the matching feature is live.
- Historical financial rows remain read-only records, and ambiguous generation,
  training or provider work needs reconciling before any new provider attempt.
- No imported session, password token or device grant is trusted as authority.

## Measure local usage and costs

These docs don't give a typical monthly bill, because hosted costs haven't been
measured. What there is: a meter you can run on your own computer to see how
much work typical conversations cause.

The [local usage guide](docs/usage/README.md) describes the opt-in meter and its
synthetic test input. It runs three visitor messages, two owner replies, a 1 MiB
upload/download and a socket reconnect/replay against the locally built Worker.
Run it on the exact build you are evaluating when you need current
measurements.

What the measurements cannot tell you:

- Local wall time, SQLite size and partial D1 metadata do not establish hosted
  CPU, total row usage, Durable Object duration/storage or billing.
- Missing values stay unknown, including AI usage when no configured provider
  ran.

The summary reports setup, static assets, scheduled recovery and individual
conversation workloads separately. Its dated price assumptions and 30-day
retention scenario are examples, not current quotes, total bills or automatic
expiry in the product. Get actual hosted metrics and current provider prices
before you budget.

`pnpm run test:usage` prepares generated migrations and runs the saved usage
summary regression plus real local request-limit checks. These keep the
429/`Retry-After` refusals and the workspace and installation daily AI ceilings
working without calling a provider. Configured limits are guards, not measured
capacity.


## What has and has not been verified

Results belong to the exact source tested. Local native/browser and fixture
checks do not establish hosted installation or real model/mail/Slack acceptance.
Timed activation, hosted operating costs and paid execution remain unqualified.
Accessibility is **FAIL / confirmed owner HOLD** and full portable-storage
fidelity remains held; D1/R2 backup does not qualify Durable Object storage.
[HANDOVER.md](HANDOVER.md#acceptance-boundaries) records current limits.

## For developers and maintainers

### Check that everything works

```sh
rer check --profile first-party
rer verify
```

Verify runs the real build, typecheck, selected module tests, native runtime,
command journey, workflow checks and source checks. Internal `verify:app` is a
nonrecursive adapter target. Locally run only touched tests and `pnpm run typecheck`;
full verification/browser runs belong on the designated remote runner and CI.
Refresh the source lock with `pnpm run source:lock` and check it with
`pnpm run source:check`. Inspect the source graph with `pnpm run source:inspect`.

### Change the database schema

Add an immutable migration in its owning module. `scripts/migrations.mjs` collects
selected migrations for the real build/setup/transfer paths. Prove upgrade and
prior-data custody through native D1/R2 flows; never edit applied SQL.

### Local sign-in links and customer mail

Trusted `H2H_LOCAL=true`, the exact loopback `APP_ORIGIN` and development mail
are supplied by local setup/dev. The bounded durable outbox prunes on capture;
list/get enforce visibility without writes. Its viewer is escaped, non-cacheable
and unavailable remotely. Headers/request origins cannot enable it. Remote
missing credentials or delivery failure never select a local fallback.

Native magic links require explicit single-use confirmation POST; scanner GETs
do not consume them. Native passwords and tenant/session checks are retained.
`rer outbox --owner-email you@example.com` requests a new
ordinary message while the app runs; `--open` explicitly opens the browser.
Never print message contents, cookies or token-bearing sign-in URLs.

### Security headers

Preserve the native CSP, scoped preview origin, frame protections, content-type
and cache policies, and origin/permission checks. Provider and customer content
is untrusted. Keep secrets out of assets, build metadata and source archives.

### License, source tools and reproducible builds

Keep asset provenance and third-party notices with selected source. The
[authoring guide](docs/AUTHORING.md) describes exact Base copies and source graph
checks. Reproducible artifact and prior-data checks have their own public paths;
a source lock is not product or provider acceptance.
