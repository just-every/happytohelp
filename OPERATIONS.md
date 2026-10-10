# Running HappyToHelp

This guide is the manual path for running HappyToHelp and the reference for
every setting. The installer (`node scripts/install.mjs`, see
[Install](docs/INSTALLER.md)) runs the same commands for you.

Jump to what you want to do:

- Run it on your own computer by hand: [Run it on your computer](#run-it-on-your-computer)
- Put it online by hand: [Deploy to your Cloudflare account](#deploy-to-your-cloudflare-account)
- Turn on AI replies, email or another optional feature: [Optional features and their settings](#optional-features-and-their-settings)
- Change how much visitors can send or spend: [Limit public traffic and AI spending](#limit-public-traffic-and-ai-spending)
- Remove a customer's personal data: [Contact erasure](#contact-erasure)
- Update to a new release: [Upgrade an existing installation](#upgrade-an-existing-installation)

Later sections are reference material for less common jobs and for developers
and maintainers.

## How HappyToHelp runs

HappyToHelp is a single Cloudflare Worker (a program that runs on Cloudflare's
network), built with TanStack Start/React for the pages and Hono for the API. It
stores everything in Cloudflare services in your own account. Each service is
connected to the Worker under a fixed name, called a *binding*. You only need
these names when you look at your Cloudflare dashboard or the code:

| Cloudflare service | Binding | What HappyToHelp uses it for |
| --- | --- | --- |
| D1 (SQLite database) | `DB` | Application records and the state of background operations |
| R2 (file storage) | `FILES` | Uploaded content and media |
| Queues | `JOBS`, plus a dead-letter queue (where failed background work is set aside) | Dispatching saved background work |
| Durable Object (SQLite-backed) | `CONVERSATIONS` | Coordinating live conversation connections |

A scheduled job (cron) runs once a minute and picks up any eligible saved work
that still needs to run. No other server, database or cache is required.

## Before you start

- Install **Node 26.8.1 or newer** and **pnpm 10.12.4**.
- Always type `pnpm run setup`. Plain `pnpm setup` is pnpm's own, unrelated
  command.
- Optional quick checks. You can run these on a fresh checkout, before
  installing any dependencies:

  ```sh
  node scripts/operations.mjs describe
  node scripts/operations.mjs check
  ```

  `describe` prints the repository's list of operations and what each one does.
  `check` also checks the settings exported in your terminal (for example, that
  `H2H_PUBLIC_ORIGIN` is an HTTPS origin or that `RATE_LIMITS` is valid) and the
  checkout's Worker configuration, so it is most useful after you set your
  deployment values. It exits with an error if that configuration is not
  valid. These checks only read files and your settings: they do not run setup
  or deploy, read secrets, sign in or check remote health.

## Run it on your computer

A copy on your computer is for trying HappyToHelp out or working on the code.
Only you can reach it, so customers on your website can't use it.

1. Install dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Prepare the local database:

   ```sh
   pnpm run setup -- --local
   ```

   This gathers the database migrations (from `migrations/` and any module's own
   `migrations/` folder) into `.generated/migrations` and applies them to a local
   D1 database. It does not create anything in Cloudflare or publish code.

3. Optional: put any runtime settings, such as provider keys, in a private
   `.dev.vars` file in the checkout, one `NAME=value` per line. See
   [How to set a setting](#how-to-set-a-setting).
4. Start the development server:

   ```sh
   pnpm run dev
   ```

5. In your browser, open `/setup` on the address the development server prints,
   and choose an email and password to create the first owner
   ([First-run setup](docs/SETUP-WORKFLOW.md) walks through the page).
   Setup closes as soon as an owner exists; after that, sign in at `/login`.

To start it again later, run `pnpm run dev` again in the same folder.

### Find your way around

- `/` is the public homepage ("Customer Support, Solved.").
- Dashboard routes include `/projects` and `/conversations`.
- Each workspace's published Help Center has its own route.
- The homepage does not load the customer chat widget. To try the widget, set
  the workspace's exact allowed website origin, then install the widget snippet
  shown in that workspace's widget settings on a page served from that origin.

An *origin* is the scheme and host of a web address with nothing after it, for
example `https://help.example.com`. HappyToHelp uses exact origins to decide
which websites may use a workspace's widget. A website on the public internet
can't reach a copy running on your computer, so to try the widget on your real
website, [deploy to Cloudflare](#deploy-to-your-cloudflare-account) first.

## Deploy to your Cloudflare account

Deploying takes two commands. `setup` creates the resources in your Cloudflare
account and prepares the database. `deploy` builds the code and publishes it.

Run every step from [What you need first](#what-you-need-first) to the end in
**the same terminal window**. The values you `export` there last only until
that window closes; if you close it, export them again before you carry on.

### What you need first

1. **Dependencies and a Wrangler sign-in.** Wrangler is Cloudflare's
   command-line tool and is installed with the dependencies. Run
   `pnpm install --frozen-lockfile`, then either `pnpm exec wrangler login` or
   export `CLOUDFLARE_API_TOKEN`.
2. **The right Cloudflare products.** The account must be able to use Workers,
   D1, R2, Queues and Durable Objects. Enable R2 in the Cloudflare dashboard
   before you run setup for the first time. The Workers Paid plan covers all of
   them and is required for Cloudflare Email Sending.
3. **API token permissions** (only if you use a token instead of
   `wrangler login`):
   - for the selected account: *Workers Scripts: Edit*, *D1: Edit*,
     *Workers R2 Storage: Edit*, *Queues: Edit* and *Account Settings: Read*;
   - so Wrangler can identify the user: *User Details: Read* and
     *Memberships: Read*;
   - for every custom domain (application or preview), on that domain's zone:
     *Zone: Read* and *Workers Routes: Edit*.

   Setup reads the zone before it creates anything, so a token without
   *Zone: Read* stops with a clear message and no resources are created.
   Cloudflare Email Sending uses its own dedicated token with
   *Email Sending: Edit* (see [the integrations guide](src/modules/integrations/README.md)).
   Never reuse the deployment token for it.
4. **A setup token** for a fresh installation. Set `H2H_SETUP_TOKEN` to a
   private value of at least 32 characters before you deploy, for example:

   ```sh
   export H2H_SETUP_TOKEN=$(openssl rand -hex 32)
   ```

   If you don't have `openssl`, any private random value of at least 32
   characters works. Keep the value private, and keep a copy: deploy stores it
   as a Worker secret, and `/setup` asks for it before the first owner can be
   created (see [Claim your new installation](#claim-your-new-installation)).
   Optionally, also set `H2H_SETUP_OWNER_EMAIL` before `setup -- --remote` to
   allow only that email address to become the first owner.

### Find your account ID and workers.dev subdomain

- **Account ID:** run `pnpm exec wrangler whoami` after you sign in; it lists
  each account you can use with its account ID. You can also find it in the
  Cloudflare dashboard, on your account's overview page. It is 32 hexadecimal
  characters.
- **workers.dev subdomain:** in the Cloudflare dashboard, open
  **Workers & Pages**; your subdomain is shown there. Register one first if the
  account has none.

### Choose your web address

Set these in the terminal that will run the commands, using your own values:

```sh
export CLOUDFLARE_ACCOUNT_ID=<32-character account ID>
export H2H_RESOURCE_PREFIX=my-support          # Worker and resource name prefix
export H2H_PUBLIC_ORIGIN=https://my-support.<your-subdomain>.workers.dev
```

| Variable | Rule |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The 32-character hexadecimal account ID. |
| `H2H_RESOURCE_PREFIX` | 3–40 characters: a lowercase letter followed by lowercase letters, digits or hyphens. It names the Worker (`<prefix>`), D1 database (`<prefix>-db`), R2 bucket (`<prefix>-files`) and queues (`<prefix>-jobs`, `<prefix>-jobs-dead`). |
| `H2H_PUBLIC_ORIGIN` | The `https://` address people will use: an origin with no path, port, query or credentials. It becomes `APP_ORIGIN`. |
| `H2H_SETUP_TOKEN` | The private setup token from [What you need first](#what-you-need-first). |

The public origin can take one of two forms. `scripts/deployment/config.mjs` and
`scripts/deployment/domains.mjs` enforce these rules.

- **A workers.dev address:** `https://<prefix>.<your-subdomain>.workers.dev`.
  The first part of the hostname must equal `H2H_RESOURCE_PREFIX`, and
  `<your-subdomain>` is the account's workers.dev subdomain. Setup enables the
  workers.dev route for the Worker.
- **A custom domain:** any DNS hostname whose zone is **active in the same
  Cloudflare account**. Setup looks up the zone with the Cloudflare API before it
  creates resources, and refuses zones that are missing, inactive or in another
  account. Deploy attaches the hostname as a Worker custom domain; Wrangler
  reports DNS conflicts and certificate issuance.

The optional website preview (`PREVIEW_ORIGIN`), which loads your website
through a proxy, must use a separate **custom domain** in an active zone of the
same account. It cannot be a workers.dev hostname and cannot be the same as the
application origin. Leave it unset to keep website preview turned off.

### Create the resources and publish

If you want optional features from the start, such as an AI provider key or
email, set them now too (see [How to set a setting](#how-to-set-a-setting)).

1. Check your settings. This prints the resource names and changes nothing:

   ```sh
   pnpm run setup -- --plan
   ```

2. Create the resources and prepare the database:

   ```sh
   pnpm run setup -- --remote
   ```

   This finds or creates the D1 database, R2 bucket and both queues, records the
   selected bindings, routes and public variables in the private file
   `.seed/deployment/<prefix>/wrangler.json`, and applies remote D1 migrations.
   It changes remote resources and the database schema but **does not publish
   Worker code**.

3. Build and publish:

   ```sh
   pnpm run deploy -- --remote
   ```

   This needs the same target and unchanged public variables. It collects
   migrations, builds the Worker, checks that the built configuration matches
   the target, applies migrations, passes your configured secrets to Wrangler
   through a temporary JSON file with mode `0600`, readable only by you (never
   as command arguments), publishes the
   Worker and its assets, deletes the temporary file and waits for `/health`.

4. Open your `H2H_PUBLIC_ORIGIN` address followed by `/setup`, enter the setup
   token and create the owner account (see
   [Claim your new installation](#claim-your-new-installation)).

Keep in mind:

- If you change a public variable, run setup again before you deploy.
- Secrets you leave unset are not revoked. To rotate or delete an existing
  Worker secret, use Wrangler.
- Do not commit `.seed/`, `.dev.vars`, generated state or credentials.

### If setup fails at the R2 step

`setup -- --remote` lists D1, R2 and Queues before it starts creating anything.

- **If listing R2 buckets fails**, setup has not created any resources yet.
- **If creating the R2 bucket fails**, the D1 database may already exist, but
  queue creation, the deployment configuration and remote migrations have not
  run.

Setup names the R2 operation that failed and the account and token checks to
make, without printing raw Wrangler output. To fix it:

1. Enable R2 for the selected account.
2. Confirm the token has the *Workers R2 Storage: Edit* permission.
3. Run setup again with the same resource prefix. Setup finds existing resources
   by name before it creates any.

A failed command does not mean Cloudflare rolled back an earlier step that
succeeded.

### Claim your new installation

A fresh installation (one with no owner yet) deploys only with a private
`H2H_SETUP_TOKEN` of at least 32 characters. Without one, deploy reads the
remote D1 setup state after applying migrations and, if no owner exists, stops
before uploading the Worker.

Once it is deployed, open `/setup` and enter the token
([First-run setup](docs/SETUP-WORKFLOW.md) walks through the page). Creating the
first owner closes setup permanently. Later redeploys of an installation that
already has an owner may leave the token out.

This protects you even if the Worker is published some other way. At runtime, a
Worker reached through any non-loopback host (any address other than
`localhost`, `127.0.0.1` or `[::1]`), or configured with a public `APP_ORIGIN`,
answers owner setup with HTTP 503 until a token is configured, so nobody can
claim it just by reaching it first. The installer and hosted installations from
Run Edit Run (a separate service that hosts HappyToHelp) supply the token
themselves.

### What `/health` does and does not tell you

`GET /health` reports the runtime plus D1 and R2 reachability, or returns
HTTP 503. It does not prove queue delivery, live connections, that each
workspace's data stays separate, provider budgets, email receipt, GitHub access
or model quality. After each deployment, check the journeys you rely on
separately. Then sign in and follow [After you install](README.md#after-you-install)
on the Overview page.

## Try a first deployment on a throwaway account

This is optional. Before you deploy for real, you can prove that a complete
hosted installation works by trying it on a disposable one. This walk-through
deploys a pinned public release, claims it, and checks email and the widget end
to end.

It pins the `v0.2.1` release so that every step, including the commit check,
has a known answer. It is a test, not the way to install the current release;
for a real installation, follow
[Deploy to your Cloudflare account](#deploy-to-your-cloudflare-account) on the
latest code.

**You will need:**

- a throwaway Cloudflare account and a website origin you control. Keep
  `app.happytohelp.com` (the company's own service) and every production
  account out of this test;
- R2 enabled in that account before setup;
- either the account's `workers.dev` subdomain available, or an active
  custom-domain zone in that account;
- a verified SendGrid sender and a test mailbox.

No AI provider is needed, because you will send a human reply.

### 1. Get the exact release

Start from a fresh checkout of the public `v0.2.1` tag:

```sh
git clone https://github.com/just-every/happytohelp.git happytohelp
cd happytohelp
git checkout --detach v0.2.1
git rev-parse HEAD
```

The last command should print
`59c6e2e1beb321e9f1cb5493efd05e20fc068638`.

Install the pinned toolchain and dependencies. Then run
`pnpm exec wrangler login` and select the throwaway account, or provide a scoped
`CLOUDFLARE_API_TOKEN`. Do not use a production credential.

### 2. Set the target and owner details

Set these in the terminal that will run the commands:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The throwaway account's 32-character account ID. |
| `H2H_RESOURCE_PREFIX` | A unique lowercase prefix (3–40 characters); it names this Worker and its D1, R2 and queues. |
| `H2H_PUBLIC_ORIGIN` | `https://<prefix>.<workers.dev-subdomain>.workers.dev`, or an eligible active custom-domain origin. For `workers.dev`, the first hostname label must equal the prefix. |
| `H2H_SETUP_TOKEN` | A private random value at least 32 characters long. Keep it available for the first claim at `/setup`; never place it in a repository, URL, command argument or receipt. |
| `H2H_SETUP_OWNER_EMAIL` | Optional. Set to the owner test-mailbox address to limit first-owner setup to that address. |
| `EMAIL_PROVIDER` | `sendgrid`. |
| `EMAIL_API_KEY` | A SendGrid API key with the required mail-send access, supplied privately to this terminal. |
| `EMAIL_FROM` | The verified SendGrid sender address, supplied privately to this terminal. |

### 3. Deploy

Run these commands in order:

```sh
node scripts/operations.mjs describe
node scripts/operations.mjs check
pnpm install --frozen-lockfile
pnpm run setup -- --plan
pnpm run setup -- --remote
pnpm run deploy -- --remote
```

These work as described in
[Create the resources and publish](#create-the-resources-and-publish).
`setup -- --plan` only validates the target and prints resource names.
`setup -- --remote` applies the release's migrations without publishing code.
`deploy -- --remote` publishes the Worker and waits for `/health`; the setup
token and the email secrets you selected reach Wrangler through the same private
secret path.

### 4. Claim the installation

1. Open `/setup` at the installation's origin.
2. Enter the setup token and, if you set `H2H_SETUP_OWNER_EMAIL`, that same
   owner email.
3. Choose an owner password and enter the exact website origin where you will
   test the widget.

The first owner can be created only once; after that, setup is closed. Sign in
at `/login`.

### 5. Check health

Fetch `/health` and confirm it returns HTTP 200 naming the native runtime
(`native-rer`), with D1 and R2 marked reachable (`database` and `files`). This
says nothing about queues, live connections, email receipt or widget behavior.

### 6. Prove that email arrives

1. On `/login`, choose **Forgot your password?** and request a reset for the
   owner test mailbox.
2. Confirm the message arrives in that mailbox.
3. Use its one-hour link to set the password, then sign in.

A provider's record that it accepted the message is not proof that it reached
the mailbox; check both. This tests outbound email only. Receiving email through
SendGrid needs a separate Inbound Parse route, the `INBOUND_EMAIL_TOKEN` secret
and a mailbox routed to that endpoint.

### 7. Prove the widget-to-operator loop

1. In your workspace, open **Widget** and copy its generated installation
   snippet into a page served from the exact website origin you entered during
   owner setup.
2. Open that page as a customer and send a test message.
3. In the dashboard, open **Conversations**, select that message and send a
   manual reply from the **Reply to conversation** composer.
4. Confirm the reply appears in the customer widget.

This checks hosted delivery of a human reply. It does not test AI or email
replies. Use only test content and the disposable workspace.

### 8. Write down what you saw

Write down the source tag and commit, and record separate observations for:

- deploy health;
- SendGrid provider acceptance;
- actual mailbox receipt;
- the widget/operator reply.

Local fixtures, an install screen or HTTP 200 from `/health` on its own do not
establish those hosted outcomes.

## Optional features and their settings

Each provider below stays unused until you configure it. (Public request limits
and daily AI ceilings are the exception: they are on by default, and their
settings only override the defaults.) Settings come in two kinds:

- **Variables** are public configuration. Setup copies the ones you set into the
  remote configuration, so changing one means running setup again.
- **Secrets** are private values such as API keys. Deploy passes the ones you set
  to Cloudflare privately.

The allowed names for both are listed in `scripts/deployment/environment.mjs`.
For local development, `.dev.vars` accepts the same names. A provider you have
not configured fails with a clear error where it is used; HappyToHelp never
invents answers or reports delivery that did not happen.

### How to set a setting

- **On your own computer:** add the setting to `.dev.vars` in the checkout, one
  `NAME=value` per line (for example `OPENAI_API_KEY=...`), then restart
  `pnpm run dev`.
- **On Cloudflare, with the commands in this guide:** `export` the setting in
  the terminal that runs them. Export variables before
  `pnpm run setup -- --remote`, then run `pnpm run deploy -- --remote`; if you
  change a variable later, run setup again before you deploy. Export secrets
  before `pnpm run deploy -- --remote`. A redeploy is how a changed setting
  reaches your installation.
- **A secret on Cloudflare, without redeploying:** in the Cloudflare dashboard,
  open your Worker, go to **Settings → Variables and Secrets** and add it as a
  secret.

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
| Owner access and sign-up | `APP_ORIGIN` (remote setup derives it), `REGISTRATION_ENABLED`, optional `H2H_SETUP_OWNER_EMAIL` | `H2H_SETUP_TOKEN` for first-owner setup; optional `TURNSTILE_SECRET` |
| AI replies, assist, profiles and monitoring (Ensemble) | Models selected in workspace and AI configuration (the dashboard's **AI** page); `CONTEXT_MODEL` for widget-triggered context work | Selected `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY` |
| Knowledge crawl and semantic search | `APIFY_CRAWLER_ACTOR_ID`, `QDRANT_URL`, `KNOWLEDGE_EMBEDDING_MODEL` | `APIFY_TOKEN`, `QDRANT_API_KEY`, `OPENAI_API_KEY`. Keyword search over content you supply needs none of these providers. |
| Help center import from another provider (Intercom, Freshdesk or Zendesk) | Platform/subdomain and destination workspace chosen for each import | `INTERCOM_TOKEN`, `FRESHDESK_TOKEN`, `ZENDESK_TOKEN`/`ZENDESK_EMAIL` for the selected provider |
| Email, sending and receiving | `EMAIL_PROVIDER` (`resend`, `cloudflare` or `sendgrid`), `EMAIL_ACCOUNT_ID` for Cloudflare, workspace email settings; built-in inbound endpoints | `EMAIL_API_KEY`, `EMAIL_FROM`, `INBOUND_EMAIL_TOKEN` |
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

**Import an existing help center.** Open Settings → More settings → Knowledge → Import. The form chooses the
provider and subdomain; the credentials come from the server secrets in the
table above.

**Website preview.** Preview must use a hostname separate from the application's origin. Never run
untrusted proxied pages under the origin where owners sign in.

**GitHub and stored connections.** `INTEGRATION_ENCRYPTION_KEY` is the base64 encoding of 32 random bytes:

```sh
openssl rand -base64 32
```

Do not rotate it without migrating the encrypted stored connections. Configure
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

### Update to a new release

1. **Back up first.** Record the source commit you are running now, and make a
   backup of your data (see
   [Updates and recovery](docs/INDEPENDENT-RELEASE.md#back-up-your-data)).
2. **Read the release notes.** In the [Changelog](CHANGELOG.md), read the notes
   for every version between yours and the new one. Before 1.0.0, a minor
   version may include breaking changes.
3. **Merge the new release into your source**, the way you would take in any
   upstream change. [Upgrade from v0.2.0 to v0.2.1](docs/INDEPENDENT-RELEASE.md#upgrade-from-v020-to-v021)
   on the Updates and recovery page shows the exact Git commands for one
   release, and how to roll back.
4. **Deploy it** from the same terminal settings as before:

   ```sh
   pnpm install --frozen-lockfile
   pnpm run deploy -- --remote
   ```

   Deploy applies new database migrations before it uploads the new Worker. If
   you changed a public variable, run setup again first.
5. **Check it.** Confirm `/health`, then the journeys you rely on.

**Updating from 0.2.2 to 0.3.0** adds one migration, `0109_magic_signins.sql`,
which must be applied before the updated Worker serves traffic; the deploy in
step 4 does this. Coming from v0.2.1, the update also applies
`0105_edition_delegation.sql` to `0108_public_answer_citations.sql`, listed in
the 0.2.2 notes in the [Changelog](CHANGELOG.md). Back up the D1 database
first. `0109_magic_signins.sql` only adds the `magic_signins` table
and its `magic_signins_expiry` index, which store hashed, expiring, single-use
email sign-in links. It doesn't rewrite existing rows, create accounts, send
email or configure a provider. Include `magic_signins` in backup and restore.
Email sign-in needs a configured email provider and `APP_ORIGIN`; password
sign-in remains available.

### What migrations 0102 to 0104 do

Deploy applies new migrations before publishing the Worker. Existing data is
untouched by all three of these:

- `0102_public_abuse_limits.sql` only adds the `abuse_counters` table and its
  index.
- `0103_contact_erasure.sql` adds `messages.erased_at` (null for existing
  messages) and the `contact_erasures` and `contact_erasure_objects` tables.
- `0104_inbound_email_classification.sql` only adds columns and an index to the
  inbound mail receipts. A failed receipt written before this migration is
  classified the next time it is claimed.

### AI reply records from earlier builds

Each AI reply generation command is identified by its ID together with a
standard form of the actor that requested it, so the scheduled replay of unsent
work (the outbox) cannot run the same command twice, whether the message came
in by email, the widget or an operator. Earlier builds could leave a
conversation's outbox undelivered on every scheduler run after a failed, queued
or uncertain generation for an email message. No action is needed after
upgrading: existing records written in the earlier form are recognized.

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

**What has been checked.** The project's checks run locally: full verification
([`pnpm run verify`](#check-that-everything-works)), the browser test suites, and the upgrade and recovery commands. Each reports its own results
against an exact revision and artifact. These checks use stand-in provider responses, so they
don't prove that a hosted installation or a live AI or email provider works.
Acceptance on a hosted installation with real providers is recorded separately
and isn't claimed by a release.

The current schema has 109 tables and 42 migration files. (Migration file
numbers have gaps, so the numbers don't count the files.)

**Still outstanding:**

- **A timed recording of a live installation** is still missing. Preparing the
  recorder does not establish installation time or that configured providers
  accept requests. See [tests/live/RECORDING.md](tests/live/RECORDING.md).
- **Accessibility has not passed.** Its status is **FAIL / confirmed owner
  HOLD**: in four test cases the automated contrast checker wrongly accepted
  text, and a widget measurement failed because of timing and background
  reliability. Both remain unresolved, and the project owner has put further
  checker work on hold. A limited run in which 21 states passed does not
  establish conformance. HappyToHelp makes no claim that its screens or
  widget meet accessibility standards.
- **Portable-storage fidelity** is also still on hold. This is a separate way of
  carrying Durable Object storage between environments; it is not part of the
  normal D1 and R2 backup and restore.

[HANDOVER.md](HANDOVER.md) and the
[accessibility audit](docs/ACCESSIBILITY-AUDIT-2026-09-30.md) record the exact
limits and outstanding obligations. Historical receipts are kept outside the
product source, and a new source version never turns a failed check into a
pass.

Publishing the source, deploying a hosted installation, validating a production
import and actually running paid providers are separate operations, each with
its own evidence.

## For developers and maintainers

### Check that everything works

```sh
pnpm run verify
```

This runs the repository's full local check: the operations configuration check
(`node scripts/operations.mjs describe`), the build, the type check, module
tests, runtime tests against the built Worker, the first-release journey and the
source integrity check, followed by the contract, homepage and docs tests.

The first-release journey (`pnpm run test:journey`) takes one owner, one
customer and one operator through a locally built Worker. It covers:

- health, owner setup and login;
- tenant isolation (each workspace's data stays separate);
- a widget conversation with an attachment;
- operator handling, including a stale-frontier 409 (a reply refused because
  the conversation changed since the operator loaded it);
- refusal of AI work when no AI provider is configured;
- WebSocket replay and resume;
- session revocation;
- the workspace deletion boundary.

This is local evidence only; see
[What has and has not been verified](#what-has-and-has-not-been-verified).

To check the deployment package without deploying anything, run:

```sh
pnpm run deploy -- --local
```

It builds, applies local migrations and runs a Wrangler packaging dry run.

### Change the database schema

1. Never edit a migration that has already been applied.
2. Add a new, uniquely numbered migration file in `migrations/` (or in the
   relevant module's `migrations/` folder).
3. Run `pnpm run migrations:prepare`.
4. Apply it with the same setup target you used before (`pnpm run setup --
   --local` or `pnpm run setup -- --remote`).

Preparing migrations removes outdated copies from `.generated/migrations`; it
does not rewrite D1's record of which migrations were applied. Back up your data
before any migration with significant consequences.

### Sign in automatically during local development

On a trusted machine with exactly one existing owner, you can skip the login
screen during local development:

```sh
H2H_LOCAL_OWNER_LOGIN=1 pnpm run dev --port 5174 --strictPort
```

Opening `/projects` or `/login` then creates an ordinary owner session for the
existing local account. It does not create an owner or change passwords. With
zero or several active owners, use normal login or first-owner setup.

This option binds Vite to loopback, disables remote Cloudflare bindings and
accepts only same-origin browser POSTs from loopback. Anyone who can reach that
development server can enter the owner's workspace, so use it only on a trusted
machine.

- Without the environment flag, normal password login applies.
- The automatic sign-in endpoint and client behavior are left out of production
  builds, even when the flag is set during `pnpm run build`. Deployed
  authentication and normal tenant and permission checks are unchanged.
- Signing out while the option is on returns you to automatic sign-in. To test
  logout, restart without the flag.

### Security headers

Operator pages and every API response carry:

- `Content-Security-Policy: frame-ancestors 'self'` (plus
  `RER_MANAGEMENT_ORIGIN` when it is configured);
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `X-Frame-Options: SAMEORIGIN`, but only when no management origin may frame
  the app.

Published Help Center pages stay embeddable on customer sites (no framing
restriction). The website-preview proxy keeps its own sandbox policy, and the
widget script is a static asset served without these headers.

### License, source tools and reproducible builds

The whole repository is MIT licensed (see `LICENSE`); third-party components
keep the notices listed in [docs/SOURCE-PROVENANCE.md](docs/SOURCE-PROVENANCE.md).

Maintainers use `pnpm run source:inspect`, `source:check`, `source:lock` and
`source:release` to author the source and track releases; see
[docs/AUTHORING.md](docs/AUTHORING.md). A source release, local checks and
importer fixtures do not by themselves establish a deployment or a production
data migration.

`pnpm run build` runs the pinned Base build tool (the delivery producer) and
writes a byte-reproducible schema-2 artifact, with raw hashed payloads, to
`delivery-artifact/`. For a given commit, the output does not depend on the
checkout path, build time, locale or host, provided you build with the Node and
pnpm versions declared in `package.json`. A different Node release may compress
the local agent download differently.

- The local agent download (`happytohelp-local-agent.tar.gz`) has normalized
  metadata: numeric root owner, 0644/0755 modes and a fixed 1985-10-26 timestamp
  on every file. Symlinks in `local-agent/` are refused at build time.
- `pnpm run test:reproducible-build` (about 90 seconds) builds two fresh copies
  at different paths and requires the same SHA-256 and no builder, repository,
  temporary or home paths. It runs in the delivery workflow, not in
  `pnpm run verify`.
- `dist/server/wrangler.json` is Wrangler's local deploy configuration and names
  your checkout. It is excluded from the artifact and must never be published.
