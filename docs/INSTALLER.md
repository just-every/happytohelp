# Install HappyToHelp

You need **Node.js 22 or later** (with npm) and Git. Check with `node --version`;
if it is older or missing, install Node 22 from [nodejs.org](https://nodejs.org/en/download),
or with a version manager (`nvm install 22`, `fnm install 22`, or `brew install node@22`
on macOS). The global `rer` command itself needs that Node. It then provisions the
checkout's own pinned Node and pnpm. Install dependencies, then start local setup:

```sh
npm install -g @runeditrun/rer@0.2.21
git clone https://github.com/just-every/run-happytohelp
cd run-happytohelp
rer install
rer dev
```

Dev uses its local address for the chat widget and generates a private owner
password. Wait for `RER_READY` and the app address. Open `/login/magic` on that
address, enter the local owner's email shown by dev (for example `owner@app.test`)
and choose **Create local sign-in link**. Then open `/__dev/outbox` on the same
app address, choose the newest **sign-in** email, follow its link and press
**Sign in** to open **Setup**. The outbox may initially contain only a welcome
email; request the sign-in link first. No private answers, email service or AI
account are needed, and no email leaves your computer. Use `rer dev --stop` from the checkout to stop the managed app.

## Contributor setup

For source work, select Node **22.20.0** and pnpm **10.12.4**:

```sh
pnpm install --frozen-lockfile
pnpm exec rer describe --json
pnpm exec rer check --profile first-party
```

This installs frozen dependencies without creating an owner or starting the app.
The following private-answer path is also available for scripted setup or to
choose your own website and password.

## Private setup answers

Create `.seed` with mode 0700 and `.seed/local-answers.json` with mode 0600 using
your editor. Keep the file inside the checkout. Use your own values. Explicit
`rer setup` requires the website, owner email and owner password:

```json
{
  "WIDGET_ORIGIN": "https://example.com",
  "OWNER_PASSWORD": "Enter your own password of at least 12 characters"
}
```

The email comes from `--owner-email` below. An `OWNER_EMAIL` in the file must
agree with that flag. These answers are optional; a missing one is not sent and
the workspace derives it:

| Answer | Left out |
| --- | --- |
| `WORKSPACE_NAME` | named from the website or company email domain, otherwise `My workspace`; change it in Project settings |
| `PRIMARY_COLOR` | a colour is chosen for you; change it in Widget settings |
| `OWNER_NAME` | taken from the first part of the owner email |
| `AI_PROVIDER` | `later`: no AI key is stored and no provider is contacted |

To store an AI key now, set `AI_PROVIDER` to `openai`, `anthropic`, `google`,
`deepseek`, `xai` or `openrouter` and add one key answer for that provider:
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`,
`XAI_API_KEY` or `OPENROUTER_API_KEY`. The key lands in the private `.dev.vars`
under that name and nowhere else; a key for a provider other than the chosen one
is refused. Setup does not contact the provider.

`rer-setup.json` owns field names and conditional requirements. Secrets belong in
the private answer file, never command arguments, logs or source. Native password
identity is retained. Local setup explicitly selects development capture; it
refuses to overwrite a saved remote provider.

## Generated and optional settings

Automatic `rer dev` setup uses the selected local origin as `WIDGET_ORIGIN` and
generates `OWNER_PASSWORD` when unanswered. The password is stored only in the
checkout's private `.dev.vars`, never printed. Supplied private answers and saved
settings take precedence; an `OWNER_PASSWORD` environment value is used when no
password was saved or answered. These local defaults do not relax explicit setup
or hosted owner password requirements.

Setup generates three private secrets in `.dev.vars`: `H2H_SETUP_TOKEN`,
`INTEGRATION_ENCRYPTION_KEY` and `INBOUND_EMAIL_TOKEN`. None is printed in
command output or logs. `INBOUND_EMAIL_TOKEN` is the bearer value your email
provider's inbound routing presents when it forwards replies to
`/api/integrations/email/inbound`. Deployment supplies the generated token to the
hosted Worker. A token and a provisioned mailbox do not route email by themselves:
configure your provider's inbound domain, forwarding and webhook for the deployed
endpoint, with the matching bearer token. Cloudflare secrets cannot be read back,
so keep a private copy from `.dev.vars` before configuring the provider.

Rerunning setup keeps an existing `.dev.vars` as it is. The one exception: a
checkout set up before `INBOUND_EMAIL_TOKEN` existed gains that single generated
line on its next setup, and no existing value is changed or rotated. New answers,
such as an AI key, are not applied to an existing `.dev.vars`; add the key there
yourself or deploy it as an installation secret.

`INBOUND_EMAIL_DOMAIN` is an optional variable for hosted installations: the domain
that workspace reply mailboxes are created under (for example `in.example.com`).
Without it, mailboxes default to `in.` followed by the workspace's website host. The
delivery packaging declares the domain as a public variable and the generated
token as a deploy secret. Rer supplies the token to the hosted installation and
retains an existing secret; older archives still import. A Workers deployment
hostname does not become your workspace name: a `workers.dev` website defaults
to **My workspace** regardless of owner email. An explicitly chosen native workspace
name takes precedence; you can change it in Project settings.

## Run it locally

```sh
rer setup --owner-email you@example.com --answers .seed/local-answers.json
rer dev --foreground
```

Setup builds, applies local migrations, prepares private settings and the first
owner and stops its temporary runtime. Creating
the owner provisions the workspace and sends the owner one welcome email, which
local setup captures in the development outbox. Reruns
preserve the same owner, data and exact existing private settings. Conflicting
saved email or origin is refused; preserve data before any recovery or reset.

Dev reports `RER_READY` and the app origin after real health checks. Open
`/login/magic` on that origin, enter your local owner email and choose **Create
local sign-in link**. Then open `/__dev/outbox` on the same origin, select the newest
sign-in email, follow its link and press **Sign in**. Local capture sends no mail. Link-scanner GETs do not
consume the link; confirmation uses an ordinary single-use POST. Native password sign-in remains
available. Use `rer dev --stop` to stop the managed app, or `rer dev --foreground`
to keep it in the terminal and stop with Ctrl+C.

Choose an explicit loopback port with `--port 8788`, using the same saved origin
for setup. See [Local command reference](../RUN-LOCALLY.md) for preview and
bounded serving. Sign-in takes you to the workspace Setup page described in
[First-run setup](SETUP-WORKFLOW.md).

## Try the customer widget locally

Use a real page to send a customer message, then reply from your workspace inbox:

1. In **Settings → Widget → Code**, copy the installation snippet. It already
   points at this HappyToHelp app and contains the workspace's public widget key.
2. Create an `index.html` in a separate test folder with a normal HTML document
   and paste the snippet before `</body>`. Serve that folder with your website's
   development server. For example, if Python 3 is installed, run this from the
   test folder:

   ```sh
   python3 -m http.server 8840 --bind 127.0.0.1
   ```

3. In **Settings → Widget → Settings**, set **Widget website origin** to
   `http://127.0.0.1:8840` and save. Use the actual origin if your server differs:
   scheme, hostname and optional port, without a path. `localhost` and `127.0.0.1`
   are different hosts, and different ports are different origins.
4. Open `http://127.0.0.1:8840` in another browser profile or private window. Open
   the widget, enter an email address and send a message. In your signed-in app,
   open **Inbox**, choose the conversation and reply. Check the reply in the
   visitor's widget; local email copies appear in the app's `/__dev/outbox`.

The website origin is where your customer page runs. The app origin is the
`RER_READY` address serving HappyToHelp, its API and `widget.js`; keep that app
address in the copied snippet. Saving a website origin replaces the previously
allowed external website, while the app's own origin always remains allowed.
An online website needs an online HappyToHelp installation reachable by its visitors.

**Unverified** on the contact means the website has not signed the visitor's
identity with the optional server secret. It does not prevent an operator reply
from being emailed to the address the visitor entered. Local mail is labelled as
capture and never leaves this computer. On a hosted installation with sending
configured, **Sent to email provider** on a reply records provider acceptance,
not confirmed inbox delivery. Inbound mail routing is configured separately.

## Verify, reset and move data

Stop dev, then run `rer verify`. Export before destructive reset
if you need the data. Reset requires `rer reset --yes` after
reviewing its printed inventory. Export/import use `--output FILE` and
`--input FILE --yes`; import requires an empty destination. Native owners survive
restore. Re-enter private configuration before setup/dev. See
[Operations](../OPERATIONS.md#local-data-and-backups).

## Deploy and inspect

Rer 0.2.21 requires the same private mail inputs for deployment dry runs and real
deployment: `EMAIL_PROVIDER`, `EMAIL_FROM` and `EMAIL_API_KEY`. The declaration maps
these to both rer's `MAIL_*` preflight bindings and HappyToHelp's native `EMAIL_*`
bindings. For Cloudflare mail, supply the additional account ID described in
[Operations](../OPERATIONS.md#deploy-to-your-cloudflare-account).

`rer deploy --dry-run` validates the input shape and builds locally. It makes no
provider requests, sends no mail and makes no deployment. `rer deploy --environment
production` requires owner authorization and the private credentials/declaration
in Operations. Local development still needs no email account.
`rer describe` lists the remaining commands and real flags.
All new verbs accept `--help`, `--cwd PATH`, `--non-interactive` and `--json`;
release has its own preserved parser. No command implies provider acceptance.
