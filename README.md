# HappyToHelp

HappyToHelp is a free, MIT-licensed customer support workspace you run yourself.
It gives a team a live chat widget for their website, a shared inbox, AI-drafted
replies from the model providers you choose, a knowledge base with published help
centers, customer context and optional delegation of support work to a paired
local computer.

It runs on Cloudflare Workers: TanStack Start and React for the pages, Hono for
the API, D1 for records, R2 for files, Queues for background work and a Durable
Object for live conversation sockets. You can run it on your own machine or
deploy it to your own Cloudflare account. No company account or shared service is
needed.

Prefer not to host it yourself? Hosted **Assisted** and **Managed** options are
available through [Run Edit Run](https://runeditrun.com).

## Before you start

| You need | Notes |
| --- | --- |
| Node.js 26.8.1 or newer | Declared in `package.json` `engines`. |
| pnpm 10.12.4 | Declared in `package.json` `packageManager`; for example `npm install --global pnpm@10.12.4`. |
| Git | To clone the repository. |
| A Cloudflare account | Only to host it online. HappyToHelp uses Workers, D1, R2, Queues and Durable Objects. Check that your plan includes them: the Workers Paid plan (US$5 per month at the time of writing) covers all of them and is required for Cloudflare Email Sending. Enable R2 in the Cloudflare dashboard before the first deployment. |
| Email provider (optional) | Resend, SendGrid or Cloudflare Email Sending, with a verified sender, for password recovery, invitations and email replies. Each provider bills you directly; several have free tiers. |
| AI provider keys (optional) | OpenAI, Anthropic, Google, DeepSeek, xAI or OpenRouter. AI replies and suggestions are billed per use by the provider on your own account. Nothing calls a provider until you configure one. Automatic replies that visitors trigger are capped per day ([docs/PUBLIC-LIMITS.md](docs/PUBLIC-LIMITS.md)). |

Knowledge crawling (Apify), semantic search (Qdrant) and GitHub are also
optional, bring-your-own-account integrations. See
[OPERATIONS.md](OPERATIONS.md#optional-native-capabilities) for every setting.

## Install

```sh
git clone https://github.com/just-every/happytohelp happytohelp
cd happytohelp
node scripts/install.mjs
```

The installer uses only Node built-ins. It opens a local browser page before any
dependencies are installed, asks only for what it cannot discover, and lets you
choose where to run:

- **This computer**: installs locked dependencies, prepares local D1, starts the
  app and creates your owner account. Keep the installer terminal open while you
  use the local app.
- **Cloudflare**: provisions D1, R2 and Queues in your account, deploys the
  Worker and creates your owner account on it.

Nothing is installed or deployed until you press the single approval button.
Options (`--no-open`, `--port`, `--resume`, `--no-prefill`, `--agent`) and
agent-assisted setup are described in [docs/INSTALLER.md](docs/INSTALLER.md).

## Develop locally without the installer

```sh
pnpm install --frozen-lockfile
pnpm run setup -- --local
pnpm run dev
```

`pnpm run setup -- --local` collects the migrations and applies them to a local
D1 database. `pnpm run dev` builds the customer widget and local-connector
download, then starts Vite; open the URL it prints (normally
`http://localhost:5173`) and go to `/setup` to create the first owner with an
email and password. Setup then closes; use `/login` afterwards. To choose a port,
pass Vite's flags directly: `pnpm run dev --port 5174 --strictPort`.

Setup without a token is accepted only for loopback development: a request to
`localhost`, `127.0.0.1` or `[::1]` with no public `APP_ORIGIN`. Any other host,
including a LAN address, tunnel or deployed Worker, requires the private
`H2H_SETUP_TOKEN` configured for that installation.

Use `pnpm run setup`, not `pnpm setup` (that is an unrelated pnpm command).
Optional provider settings for local development go in a private `.dev.vars`
file; see [OPERATIONS.md](OPERATIONS.md).

## Deploy to your own Cloudflare account

The installer's Cloudflare option does this for you. To do it by hand, install
dependencies, sign in with Wrangler (or set `CLOUDFLARE_API_TOKEN`), then set the
target and run the three commands:

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login

export CLOUDFLARE_ACCOUNT_ID=<32-character account ID>
export H2H_RESOURCE_PREFIX=my-support          # Worker and resource name prefix
export H2H_PUBLIC_ORIGIN=https://my-support.<your-subdomain>.workers.dev
export H2H_SETUP_TOKEN=$(openssl rand -hex 32)  # keep it; you enter it at /setup

pnpm run setup -- --plan     # validate and print resource names only
pnpm run setup -- --remote   # create D1, R2 and Queues; apply migrations
pnpm run deploy -- --remote  # build, publish the Worker and check /health
```

Then open `https://…/setup`, enter the setup token and create the owner account.
Read [OPERATIONS.md](OPERATIONS.md#remote-setup-and-publication) first: it
covers the `workers.dev` naming rule, custom domains, the separate preview
origin, the Cloudflare API token permissions and every optional provider.

## Verify

```sh
pnpm run verify
```

This checks the operations descriptor, builds the app, type-checks, runs the
module and runtime suites and a first-release journey against a real local
Worker, and checks source integrity. Browser suites need Chromium once
(`pnpm exec playwright install chromium`); each `test:*-browser` script in
`package.json` then starts its own isolated local Worker, for example
`pnpm run test:setup-browser`, `pnpm run test:ui-browser` or
`pnpm run test:conversation-panel-resize-browser`. Local tests use provider
fixtures only; they do not prove a live provider or deployment.

## Try a demo inbox

In an empty workspace, choose **Try a demo inbox**. It creates a separate,
clearly labelled **Demo inbox · Northstar Outfitters** project with fictional
conversations, an editable drafting assistant and three published FAQ articles.
Creating it makes no AI, email or other provider calls. **Generate replies** then
uses your configured provider to draft suggestions for review; it never sends a
customer reply. Delete the demo project from its settings when you are done.

## Documentation

- [OPERATIONS.md](OPERATIONS.md): local and remote setup, deployment, providers, data import
- [docs/PRIVACY.md](docs/PRIVACY.md): what personal data is stored and sent to providers, and how to erase a contact
- [docs/PUBLIC-LIMITS.md](docs/PUBLIC-LIMITS.md): request limits (`RATE_LIMITS`) and daily AI ceilings (`AI_DAILY_CEILINGS`)
- [docs/INSTALLER.md](docs/INSTALLER.md): the standalone installer and agent-assisted setup
- [docs/SETUP-WORKFLOW.md](docs/SETUP-WORKFLOW.md): the in-app `/setup` page
- [docs/INDEPENDENT-RELEASE.md](docs/INDEPENDENT-RELEASE.md): hosted delivery, backup, restore and clean snapshots
- [docs/MODULES.md](docs/MODULES.md) and [docs/AUTHORING.md](docs/AUTHORING.md): reusable modules and source authoring
- [CONTRACT.md](CONTRACT.md) and [ACCEPTANCE.md](ACCEPTANCE.md): product requirements and their evidence gates
- [HANDOVER.md](HANDOVER.md): maintainer orientation
- [CHANGELOG.md](CHANGELOG.md) and [SECURITY.md](SECURITY.md)

## License

MIT; see [LICENSE](LICENSE). This covers the whole repository, including the
homepage and setup artwork. Bundled third-party components keep their own
notices in [docs/licenses](docs/licenses) and in their package metadata; see
[docs/SOURCE-PROVENANCE.md](docs/SOURCE-PROVENANCE.md).
