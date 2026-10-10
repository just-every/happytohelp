# First-run setup

The `/setup` page is where you create the first **owner** account (the account
that owns this HappyToHelp installation) and your first **workspace** in one go.
You use it once, on a brand-new installation, after the app is already running.
This page explains whether you need it, what to have ready, and what each step
asks for.

When you finish, setup:

- creates your owner account and workspace together, so you never end up with
  one without the other
- saves your workspace name, brand colour and the website where your chat widget
  will run
- signs you in
- opens your workspace's widget settings, with your real installation snippet
  and a live preview of the widget

## Do you need this page?

- **You used the installer** (`node scripts/install.mjs`, see
  [Install](INSTALLER.md)): it creates your owner account for you, so you can
  usually skip this page.
- **You set things up by hand**: get the app running first, then open `/setup`.
  On your own computer, that means `pnpm run setup -- --local` and then
  `pnpm run dev`. For your own Cloudflare account, follow
  [Deploy to your Cloudflare account](../OPERATIONS.md#deploy-to-your-cloudflare-account)
  in the Operations guide.
- **A hosting service set it up for you**, such as Run Edit Run's hosted
  options: the service creates the repository, the Cloudflare resources and the
  installation. You finish with this page once the app is running.

Setup only opens on a brand-new installation. Once an owner exists, or the
installation already holds data (including imported data or a workspace that was
later deleted), `/setup` shows **You’re already set up** and you sign in at
`/login` instead.

## Have your setup token ready

A **setup token** is a private value that proves you are the person allowed to
claim a new installation. Whether you need one depends on where the app runs:

- **On your own computer**: no token is needed. This applies only to loopback
  addresses, which only your own computer can reach (`localhost`, `127.0.0.1`
  or `[::1]`), with no public `APP_ORIGIN`.
- **Anywhere else**, including a LAN address, a tunnel, a deployed Worker and
  hosted Assisted and Managed installations: the installation must be deployed
  with `H2H_SETUP_TOKEN`, and `/setup` asks for that token before it creates the
  owner.
  - If you deployed it yourself, the token is the value you exported as
    `H2H_SETUP_TOKEN` (at least 32 characters; see
    [What you need first](../OPERATIONS.md#what-you-need-first)).
  - If someone else installed it for you, they give you the token privately with
    your installation.

Until a token is configured, a non-local installation refuses owner setup with
HTTP 503, and `pnpm run deploy -- --remote` refuses to publish a fresh
installation without one.

If the installation was also deployed with `H2H_SETUP_OWNER_EMAIL`, setup only
accepts that email address for the owner.

## Create your owner account and workspace

1. Open `/setup` on your installation: the address `pnpm run dev` prints
   followed by `/setup`, or `https://<your public origin>/setup`.
2. **Your details.** Enter your name, your email and a password of at least 12
   characters. If the page asks for an **Owner setup token**, enter it here.
3. **Workspace.** Enter:
   - a workspace name
   - the **widget website origin**: the website where your chat widget will run,
     such as `https://example.com` (see
     [The widget website origin](#the-widget-website-origin))
   - a brand colour (`#7c3aed` unless you change it). You can change it later.
4. **Review.** Check your details. Use **Back** to change anything, then choose
   **Create workspace**.

Before anything is created, the page checks every step again, and the server
validates everything again too.

The **Known details** panel on the left sums up the app you're setting up: the
product, your workspace name, the runtime and this installation's address. It
only describes this app; it doesn't mean any Cloudflare or GitHub account is
connected. Its **Edit** button takes you back to the Workspace step.

### The widget website origin

The widget website origin is the web address of the site where customers will
see your chat widget. HappyToHelp refuses the widget's requests from any other
address, so it's worth getting exactly right:

- Only the origin is kept: the scheme (`https://`), the host name and any port.
  Any path you type, such as `/shop`, is dropped.
- It must match exactly. `https://example.com` and `https://www.example.com` are
  different origins, and so are `http://` and `https://`. Enter the address your
  customers actually see in their browser's address bar.
- Each workspace has one widget website origin. A second address, such as a
  staging copy of your site or a second domain, doesn't match it.

### If you need to stop partway

**Save for later** (or moving between steps) keeps your owner name, email,
workspace name, widget website and colour in this browser tab's session storage.
Your password and setup token are only held in memory, never saved, so you need
to enter them again after a reload. The saved draft is cleared once your
workspace is created.

## After setup

You land in your workspace's widget settings, which show the real installation
snippet and a preview. Setup itself makes no calls to outside providers and
sends no invitations.

What to do next, such as adding the widget to your site, setting up AI replies,
adding knowledge and inviting your team, is in
[After you install](../README.md#after-you-install). To see how HappyToHelp
works before you connect a real website,
[try a demo inbox](../README.md#try-a-demo-inbox).

## Let a coding agent prefill the setup page

If a coding agent is helping you install HappyToHelp, it can check whether setup
is still open and hand you a link with your details already filled in. You then
review them, add your password (and token, if needed) in the browser, and create
the workspace yourself.

```sh
node scripts/setup-link.mjs --url http://localhost:5174 --ownerName 'Alex' --email 'alex@example.com' --name 'Alex’s team' --allowedOrigin https://example.com --primaryColor '#7c3aed'
```

Replace `http://localhost:5174` with your installation's actual address, and the
other values with your own.

| Option | What it sets |
| --- | --- |
| `--url` | Required. The address of your running installation. |
| `--ownerName` | Your name. |
| `--email` | The owner email. |
| `--name` | The workspace name. |
| `--allowedOrigin` | The widget website origin. |
| `--primaryColor` | The brand colour, as `#RRGGBB`. |

Every field stays editable on the page. The command prints a `setupUrl` to open,
and `tokenRequired: true` when the page will ask for a setup token. If the
installation already has an owner, it stops and tells you to sign in instead.

The command only checks availability and prints a link. It does not create
accounts, connect providers, deploy or invite anyone.

Your details travel in the link's fragment (the part after `#`), and the page
removes them from the address bar as soon as it reads them. Only the plain,
non-secret details above go in the link. Never put passwords or setup tokens in
the command; the script accepts only the options in the table. Enter them in the
form instead.

## For developers: how setup is tested

You don't need this section to set up HappyToHelp.

`pnpm run test:setup-browser` starts a fresh local copy of the built Worker with
its own isolated storage, then checks in a real browser:

- the agent link handoff and resuming a saved draft
- that no password is ever stored
- password validation
- that the account and workspace are created together or not at all
- the real widget preview
- staying signed in after a reload
- signing in later with the chosen password
- that setup refuses to run again once complete

Browser tests need Chromium once (`pnpm exec playwright install chromium`).

`tests/identity-setup.mjs` runs against a real D1 database (Cloudflare's SQL
database). It checks that creation is all-or-nothing, that the workspace name,
owner name and brand colour are saved, and that only the first owner can claim
the installation.
