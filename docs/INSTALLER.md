# Install HappyToHelp

Use Node **22.20.0** and pnpm **10.12.4**. Install the checkout's exact command package before inspecting its descriptor; no private
configuration is needed:

```sh
pnpm install --frozen-lockfile
pnpm exec rer describe --json
pnpm exec rer check --profile first-party
```

Install uses the pinned package manager and frozen lockfile. It does not set up
an owner, start the app, change global tools or deploy.

## Private setup answers

Create `.seed` with mode 0700 and `.seed/local-answers.json` with mode 0600 using
your editor. Keep the file inside the checkout. Use your own values. Only the
website, the owner email and the owner password are required:

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
| `WORKSPACE_NAME` | named from the website, which you can change in Project settings |
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

Setup generates three private secrets in `.dev.vars`: `H2H_SETUP_TOKEN`,
`INTEGRATION_ENCRYPTION_KEY` and `INBOUND_EMAIL_TOKEN`. None is printed in
command output or logs. `INBOUND_EMAIL_TOKEN` is the bearer value your email
provider's inbound routing presents when it forwards replies to
`/api/integrations/email/inbound`. Cloudflare secrets cannot be read back, so keep
a copy from `.dev.vars` before you configure a hosted gateway.

Rerunning setup keeps an existing `.dev.vars` as it is. The one exception: a
checkout set up before `INBOUND_EMAIL_TOKEN` existed gains that single generated
line on its next setup, and no existing value is changed or rotated. New answers,
such as an AI key, are not applied to an existing `.dev.vars`; add the key there
yourself or deploy it as an installation secret.

`INBOUND_EMAIL_DOMAIN` is an optional variable for hosted installations: the domain
that workspace reply mailboxes are created under (for example `in.example.com`).
Without it, mailboxes default to `in.` followed by the workspace's website host. The
delivery packaging declares the domain as a public variable and the token as an
optional secret. Neither is a required deploy secret, so existing installations
deploy unchanged and older archives still import.

## Run it locally

```sh
pnpm exec rer setup --owner-email you@example.com --answers .seed/local-answers.json
pnpm exec rer dev --foreground
```

Setup builds, applies local migrations, prepares private settings and the first
owner, checks a normal sign-in message and stops its temporary runtime. Creating
the owner provisions the workspace and sends the owner one welcome email, which
local setup captures in the development outbox. Reruns
preserve the same owner, data and exact existing private settings. Conflicting
saved email or origin is refused; preserve data before any recovery or reset.

Dev reports readiness only after real health and sign-in checks. Open the
`/__dev/outbox` address it prints, select the newest message, follow its link and
press **Sign in**. No mail is sent. Link-scanner GETs do not consume the link;
confirmation uses an ordinary single-use POST. Native password sign-in remains
available. Keep dev in the foreground and stop with Ctrl+C.

Choose an explicit loopback port with `--port 8788`, using the same saved origin
for setup. See [Local command reference](../RUN-LOCALLY.md) for preview and
bounded serving. Sign-in takes you to the workspace Setup page described in
[First-run setup](SETUP-WORKFLOW.md).

## Verify, reset and move data

Stop dev, then run `pnpm exec rer verify`. Export before destructive reset
if you need the data. Reset requires `pnpm exec rer reset --yes` after
reviewing its printed inventory. Export/import use `--output FILE` and
`--input FILE --yes`; import requires an empty destination. Native owners survive
restore. Re-enter private configuration before setup/dev. See
[Operations](../OPERATIONS.md#local-data-and-backups).

## Deploy and inspect

`pnpm exec rer deploy --dry-run` builds and validates locally without
provider requests. `pnpm exec rer deploy --environment production`
requires owner authorization and the private credentials/declaration described
in [Operations](../OPERATIONS.md#deploy-to-your-cloudflare-account).
`pnpm exec rer describe` lists the remaining commands and real flags.
All new verbs accept `--help`, `--cwd PATH`, `--non-interactive` and `--json`;
release has its own preserved parser. No command implies provider acceptance.
