# HappyToHelp

**Customer Support, Solved.**

Your Codex or Claude fixes the problem and writes the reply. You press Send.

That line describes HappyToHelp's [local agent](local-agent/README.md). When a
customer reports a problem, you hand the conversation to Codex or Claude running
on a computer you control, using your own Codex or Claude account or API key. It
looks into the problem, can fix it if you allow it, and drafts a reply. Nothing
reaches the customer until you press **Send**. The local agent is optional, and
HappyToHelp doesn't provide or charge for Codex or Claude.

HappyToHelp is a free, open-source customer support desk that you run yourself.
It is MIT-licensed, and it gives your team:

- a live chat widget for your website
- a shared inbox for your team
- AI-drafted replies in the inbox, using an AI provider key you add (OpenAI,
  Anthropic, Google, DeepSeek, xAI or OpenRouter). This is separate from the
  local agent, and also optional.
- a knowledge base, which you can publish as a Help Center for your customers
- context about your customers
- optionally, the local agent described above

Without any AI set up, HappyToHelp still works as a chat widget, shared inbox and
Help Center that your team answers by hand.

HappyToHelp runs on Cloudflare Workers, Cloudflare's platform for running apps
on its network. You run it on your own computer or in your own Cloudflare
account. You don't need a HappyToHelp account or any shared service.

Prefer not to host it yourself? [Run Edit Run](https://runeditrun.com), a
separate service, hosts HappyToHelp for you through its **Assisted** and
**Managed** options. Its site describes what each option includes.

## What it costs

HappyToHelp itself is free: no seats, plans or fees. The services it runs on,
and the optional providers you connect, bill you directly on your own accounts:

- **Cloudflare**, to put HappyToHelp online. HappyToHelp uses Workers, D1, R2,
  Queues and Durable Objects. The Workers Paid plan (US$5 per month at the time
  of writing) covers all of them, and you need it to send email through
  Cloudflare Email Sending. These docs don't promise that Cloudflare's free plan
  is enough, so check Cloudflare's pricing for those products before you rely on
  it.
- **Email** (optional): Resend, SendGrid or Cloudflare Email Sending. Several of
  these have free tiers.
- **AI replies** (optional): your AI provider bills each reply and suggestion.
  Automatic replies that website visitors trigger are capped each day, by
  default at an estimated US$10 per workspace (see
  [Limits and AI ceilings](docs/PUBLIC-LIMITS.md)).
- **The local agent** (optional): it uses your own Codex or Claude, under
  whatever plan or API key you already have with OpenAI or Anthropic.

There is no typical monthly total in these docs. If you want to estimate your
own, see [Measure local usage and costs](OPERATIONS.md#measure-local-usage-and-costs).

## Choose how to run it

- **Publish it to your Cloudflare account.** Choose this if real customers will
  use it. The chat widget on your website has to reach HappyToHelp over the
  internet, so it must run online.
- **Run it on your own computer.** Choose this to try HappyToHelp out, or to
  work on the code. It runs only while your computer and its terminal window
  are open, and only you can reach it, so customers on your website can't use it.

Either way, the easiest route is the
[guided installer](#install-with-the-guided-installer). It opens a page in your
browser, asks a few questions and sets everything up. If you would rather run
each command yourself, see
[Develop locally without the installer](#develop-locally-without-the-installer)
or [Deploy to your own Cloudflare account](#deploy-to-your-own-cloudflare-account).

You'll know it worked when you can sign in to your new workspace.

## What you need

To run HappyToHelp at all:

- **Node.js 26.8.1 or newer.** Check with `node --version`. If yours is older,
  install a newer one from [nodejs.org](https://nodejs.org). This version is set
  in `package.json` under `engines`.
- **pnpm 10.12.4**, the exact version the repository is locked to (set in
  `package.json` under `packageManager`). One way to install it:
  `npm install --global pnpm@10.12.4`.
- **Git**, to download the code.

The local agent is different: it runs on whichever computer does the support
work, and it only needs Node.js 20 or later there (see
[Local agent](local-agent/README.md#what-you-need)).

To put it online, you also need:

- **A Cloudflare account.** Sign up at [cloudflare.com](https://www.cloudflare.com)
  if you don't have one.
- **R2 turned on in that account.** R2 is Cloudflare's file storage. In the
  Cloudflare dashboard, open **R2** and turn it on before you install;
  Cloudflare may ask you to add a payment method first. Setup creates the R2
  storage before it deploys anything, so if R2 is off, installation stops at
  that step. [If setup fails at the R2 step](OPERATIONS.md#if-setup-fails-at-the-r2-step)
  explains how to recover.

Optional, and billed to you directly by each provider:

- **An email provider:** Resend, SendGrid or Cloudflare Email Sending, with a
  verified sender (usually an address on a domain you own). HappyToHelp uses it
  for sign-in links, password recovery, invitations and email replies.
- **An AI provider key:** OpenAI, Anthropic, Google, DeepSeek, xAI or
  OpenRouter. HappyToHelp never calls a provider until you add one. See
  [Set up AI replies](#set-up-ai-replies).

You can also connect your own accounts for website crawling into the knowledge
base (Apify), semantic search (Qdrant) and GitHub. All of these are optional.
Every setting is listed in
[Optional features and their settings](OPERATIONS.md#optional-features-and-their-settings).

The commands in these docs are written for a macOS or Linux terminal (or WSL on
Windows).

## Install with the guided installer

1. Download the code and start the installer:

   ```sh
   git clone https://github.com/just-every/happytohelp happytohelp
   cd happytohelp
   node scripts/install.mjs
   ```

   The installer itself uses only what comes with Node, so you don't need to
   install HappyToHelp's dependencies first. It installs them for you later,
   using pnpm.

2. A setup page opens in your browser. It fills in what it can find out by
   itself and asks you only for the rest.

3. Choose where HappyToHelp will run:

   - **Publish online with Cloudflare.** The installer creates the database
     (D1), file storage (R2) and queues in your Cloudflare account, deploys the
     app and creates your owner account on it.
   - **Run locally.** The installer installs the exact dependency versions
     HappyToHelp is locked to, prepares a local database, starts the app and
     creates your owner account. Keep the installer's terminal window open
     while you use the app on this computer.

4. Review your answers and press **Approve and install**. Nothing is installed
   or deployed until you press it, and it is the only approval button.

[Install](docs/INSTALLER.md) walks through every screen, including how the
installer connects to Cloudflare, what to do if something fails and how to start
a local copy again later. It also covers the installer's command-line options
and how a coding agent can fill in the answers for you.

## After you install

Sign in, then work through **Setup** in your workspace's sidebar. (This is a
checklist inside the app, not the `/setup` page you used to create your
account.) It ticks off each item only once HappyToHelp has actually seen it
working:

- **Owner mail delivered**, **Sender DNS** and **Inbound address**: email.
- **Model key** and **Spend ceilings**: AI replies.
- **First published article**: knowledge.
- **Widget origin saved** and **Widget seen**: the chat widget on your website.

A sensible order for a small team:

1. **Add the chat widget to your website.** Open **Settings → Widget**, copy the
   installation snippet and add it to every page where you want the widget to
   appear. It works on any site where you can add your own HTML, but only on
   the one website address you entered during setup (see
   [The widget website origin](docs/SETUP-WORKFLOW.md#the-widget-website-origin)).
2. **Set up AI replies**, if you want them (see
   [Set up AI replies](#set-up-ai-replies)).
3. **Add knowledge.** Open **Knowledge** and publish articles that answer common
   questions. When AI answers search your knowledge, they use only published
   articles and datasets, never drafts or anything else unpublished.
4. **Set up email**, so you can send invitations and password resets and
   receive customer email (see [Email and integrations](src/modules/integrations/README.md)).
5. **Invite your team** from **Settings → Agents**. (The dashboard calls
   teammates who answer customers *agents*.)
6. **Connect a computer**, if you want the local agent (see
   [Local agent](local-agent/README.md)).

## Set up AI replies

AI replies need two things: a key from an AI provider, and an assistant in your
workspace that uses one of that provider's models.

1. **Get an API key** from OpenAI, Anthropic, Google, DeepSeek, xAI or
   OpenRouter. The provider bills you for what you use.
2. **Add the key to your installation** under the name for that provider:
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` (or
   `GEMINI_API_KEY`), `DEEPSEEK_API_KEY`, `XAI_API_KEY` or
   `OPENROUTER_API_KEY`.
   - **On Cloudflare:** in the Cloudflare dashboard, open your Worker, go to
     **Settings → Variables and Secrets** and add the key as a secret. You can
     also set it in your terminal before you run `pnpm run deploy -- --remote` (see
     [Optional features and their settings](OPERATIONS.md#optional-features-and-their-settings)).
   - **On your own computer:** add a line such as `OPENAI_API_KEY=your-key` to
     a file named `.dev.vars` in the `happytohelp` folder, then restart the app.
3. **Choose an assistant.** In your workspace, open **AI** in the sidebar. Add an
   assistant (or choose **Customize** on an existing one), enter the **Model**
   it uses and keep it **Enabled**. Then, under **Responder defaults**, choose
   which assistant answers visitors.

Keep key values out of chat messages and the browser. To cap what visitors can
spend, see [Limits and AI ceilings](docs/PUBLIC-LIMITS.md).

## Try a demo inbox

When your workspace has no conversations yet, the inbox shows a **Try a demo
inbox** button. It creates a separate, clearly labelled workspace called
**Demo inbox · Northstar Outfitters**, with:

- fictional customer conversations
- a drafting assistant you can edit
- three published FAQ articles

Creating the demo makes no AI, email or other provider calls. To see AI drafting,
open a demo conversation and press **Generate**. HappyToHelp then drafts
suggested replies for you to review, using your AI provider. The demo's
assistant uses OpenAI's `gpt-5.6-luna` model, so this needs `OPENAI_API_KEY`
unless you change the assistant's model (see
[Set up AI replies](#set-up-ai-replies)). Generate never sends a reply to a
customer.

When you are done, delete the demo workspace from its settings.

## Develop locally without the installer

Use this path if you want to work on the code yourself.

1. Install the dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Prepare the local database. This collects the database migrations (the
   files that create and update the database's tables) and applies them to a
   local D1 database:

   ```sh
   pnpm run setup -- --local
   ```

   Type `pnpm run setup`, not `pnpm setup`. `pnpm setup` is an unrelated pnpm
   command.

3. Start the app:

   ```sh
   pnpm run dev
   ```

   This builds the customer chat widget and the local agent download, then
   starts the Vite development server. To choose the port, pass Vite's flags
   straight through, for example `pnpm run dev --port 5174 --strictPort`.

4. Open the address it prints (normally `http://localhost:5173`) and go to
   `/setup`. Enter an email and password to create the first owner account
   ([First-run setup](docs/SETUP-WORKFLOW.md) walks through the page).

5. After that, `/setup` closes. Sign in at `/login` from then on.

Your data stays on this computer between runs. To start the app again later, run
`pnpm run dev` in the same folder.

If you have set up an email provider and `APP_ORIGIN` (the public address of
your app), you can also sign in without a password: choose **Email me a sign-in
link** on the sign-in page, then press **Sign in** on the page that the link
opens.

Optional settings for local development, such as API keys, go in a private
`.dev.vars` file, one `NAME=value` per line. See
[Optional features and their settings](OPERATIONS.md#optional-features-and-their-settings)
for the names.

### When you need a setup token

You can create the first owner account without a setup token only during local
development: the request must go to `localhost`, `127.0.0.1` or `[::1]`, and
there must be no public `APP_ORIGIN`. Any other address, including a LAN
address, a tunnel or a deployed Worker, needs the private `H2H_SETUP_TOKEN`
configured for that installation. [First-run setup](docs/SETUP-WORKFLOW.md#have-your-setup-token-ready)
explains where the token comes from.

## Deploy to your own Cloudflare account

The installer's **Publish online with Cloudflare** option does all of this for
you. To do it by hand, follow
[Deploy to your Cloudflare account](OPERATIONS.md#deploy-to-your-cloudflare-account)
in the Operations guide. It is the full, step-by-step version, including where
to find your Cloudflare account ID and `workers.dev` subdomain, the permissions
an API token needs, custom domains and every optional setting.

In outline, you:

1. Turn on R2 in your Cloudflare account.
2. Install the dependencies and sign in with Wrangler, Cloudflare's
   command-line tool (`pnpm exec wrangler login`), or set
   `CLOUDFLARE_API_TOKEN` instead.
3. Set four values in your terminal: `CLOUDFLARE_ACCOUNT_ID`,
   `H2H_RESOURCE_PREFIX` (the name for your app and its resources),
   `H2H_PUBLIC_ORIGIN` (its web address) and `H2H_SETUP_TOKEN` (a private value
   you'll need at `/setup`).
4. Run `pnpm run setup -- --plan`, `pnpm run setup -- --remote` and
   `pnpm run deploy -- --remote`.
5. Open your address followed by `/setup`, enter the setup token and create the
   owner account.

Want to try a hosted installation from start to finish on a throwaway account
first? Follow
[Try a first deployment on a throwaway account](OPERATIONS.md#try-a-first-deployment-on-a-throwaway-account).

## Where to go next

Read these in roughly this order:

1. [Install](docs/INSTALLER.md): the guided installer, screen by screen.
2. [First-run setup](docs/SETUP-WORKFLOW.md): the `/setup` page, where the
   owner account and first workspace are created if the installer didn't do it.
3. [Email and integrations](src/modules/integrations/README.md): sending and
   receiving email, and connecting GitHub.
4. [Local agent](local-agent/README.md): connect a computer and hand support
   work to Codex or Claude.
5. [Limits and AI ceilings](docs/PUBLIC-LIMITS.md): how visitor traffic and AI
   spending are capped, and how to change the caps (`RATE_LIMITS` and
   `AI_DAILY_CEILINGS`).

Look things up later:

- [Operations](OPERATIONS.md): the manual commands and every setting.
- [Personal data](docs/PRIVACY.md): what is stored and sent to providers, and
  how to erase a customer's data.
- [Updates and recovery](docs/INDEPENDENT-RELEASE.md): updates, backups and
  restores.
- [Inbound email recovery](docs/INBOUND-EMAIL-RECOVERY.md): when an incoming
  email didn't reach the inbox.
- [Security](SECURITY.md) and the [Changelog](CHANGELOG.md).

For maintainers and contributors (on GitHub):

- [HANDOVER.md](HANDOVER.md): orientation for maintainers
- [CONTRACT.md](CONTRACT.md) and [ACCEPTANCE.md](ACCEPTANCE.md): product
  requirements and the checks that prove them
- [docs/MODULES.md](docs/MODULES.md) and [docs/AUTHORING.md](docs/AUTHORING.md):
  reusable modules and how the source is put together

## Words these docs use

- **Installation:** one running copy of HappyToHelp, on your computer or in your
  Cloudflare account.
- **Workspace:** one support space with its own inbox, chat widget, settings and
  team. The API, setting names and a few screens call a workspace a *project*.
- **Owner, admin and operator:** the roles on a workspace's team. The first
  owner is created at `/setup`; operators answer customers. The dashboard shows
  the operator role as **Agent**.
- **Contact:** the record of a customer who has talked to you. A **visitor** is
  someone using the chat widget on your website.
- **Origin:** the start of a web address, with nothing after it: the scheme,
  host and any port, such as `https://help.example.com`. HappyToHelp uses exact
  origins to decide which website may use a workspace's widget, and
  `APP_ORIGIN` is the public address of your installation.
- **Setup token:** the private `H2H_SETUP_TOKEN` that protects the first owner
  sign-up everywhere except local development on your own computer (see
  [When you need a setup token](#when-you-need-a-setup-token)).
- **Local agent:** the small program you install on a computer you control, so
  Codex or Claude on that computer can take on support work. A computer that
  runs it is a **paired computer**.
- **Worker:** HappyToHelp's server, which runs on Cloudflare Workers (both on
  Cloudflare and, for development, on your own computer).

## Verify

For developers: run the full set of checks on your copy of the code.

```sh
pnpm run verify
```

It does the following:

- checks the app's operations configuration
- builds the app and type-checks it
- runs the module and runtime test suites
- runs the first-release journey: one owner, customer and operator go through
  the app on a real local Worker
- checks source integrity: that the source files match the recorded source lock
- runs the contract, homepage and docs tests

These local tests use provider fixtures (stand-in responses) instead of real AI
or email providers. They don't prove that a live provider or a deployment works.

### Run the browser tests

Browser tests need Chromium. Install it once:

```sh
pnpm exec playwright install chromium
```

Each `test:*-browser` script in `package.json` then starts its own separate local
Worker. For example:

```sh
pnpm run test:setup-browser
pnpm run test:ui-browser
pnpm run test:conversation-panel-resize-browser
```

### Test how failed agent tasks are handled

Since 0.3.0, the local agent requires strict structured output from its AI
model. When delegated work fails, HappyToHelp keeps the HTTP status the provider
reported and a short, redacted excerpt of the error. Failed work never sends a
customer reply and never restarts on its own.

`pnpm run test:provider-errors-browser` checks this. It covers pairing a
computer, the local runner, the saved failure records and what an operator sees
after reloading the page, at desktop and mobile widths. For what you see when a
task fails, see
[When an AI provider request fails](local-agent/README.md#when-an-ai-provider-request-fails).

## How it's built

HappyToHelp is one Cloudflare Worker:

- **Pages:** TanStack Start and React
- **API:** Hono
- **Records:** D1, Cloudflare's SQL database
- **Files:** R2, Cloudflare's file storage
- **Background work:** Cloudflare Queues
- **Live conversations:** a Durable Object that holds the live chat connections

## License

MIT; see [LICENSE](LICENSE). This covers the whole repository, including the
homepage drawings and setup artwork. Bundled third-party components keep their
own notices in [docs/licenses](docs/licenses) and in their package metadata; see
[docs/SOURCE-PROVENANCE.md](docs/SOURCE-PROVENANCE.md).
