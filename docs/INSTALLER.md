# Install HappyToHelp

Use Node **22.20.0** and pnpm **10.12.4**. The command descriptor works before
dependencies or private configuration exist:

```sh
node scripts/rer.mjs describe --json
node scripts/rer.mjs check --profile first-party
node scripts/rer.mjs install
```

Install uses the pinned package manager and frozen lockfile. It does not set up
an owner, start the app, change global tools or deploy.

## Private setup answers

Create `.seed` with mode 0700 and `.seed/local-answers.json` with mode 0600 using
your editor. Keep the file inside the checkout. Use your own values:

```json
{
  "WORKSPACE_NAME": "My support",
  "WIDGET_ORIGIN": "https://example.com",
  "PRIMARY_COLOR": "#7c3aed",
  "OWNER_NAME": "Owner",
  "OWNER_PASSWORD": "Enter your own password of at least 12 characters",
  "EMAIL_PROVIDER": "later"
}
```

The email comes from `--owner-email` below. An `OWNER_EMAIL` in the file must
agree with that flag. `rer-setup.json` owns field names and conditional
requirements. Secrets belong in the private answer file, never command arguments,
logs or source. Native password identity is retained. Local setup explicitly
selects development capture; it refuses to overwrite a saved remote provider.

## Run it locally

```sh
node scripts/rer.mjs setup --owner-email you@example.com --answers .seed/local-answers.json
node scripts/rer.mjs dev
```

Setup builds, applies local migrations, prepares private settings and the first
owner, checks a normal sign-in message and stops its temporary runtime. Reruns
preserve the same owner, data and exact existing private settings. Conflicting
saved email or origin is refused; preserve data before any recovery or reset.

Dev reports readiness only after real health and sign-in checks. Open the
`/__dev/outbox` address it prints, select the newest message, follow its link and
press **Sign in**. No mail is sent. Link-scanner GETs do not consume the link;
confirmation uses an ordinary single-use POST. Native password sign-in remains
available. Keep dev in the foreground and stop with Ctrl+C.

Choose an explicit loopback port with `--port 8788`, using the same saved origin
for setup. See [Local command reference](../RUN-LOCALLY.md) for preview and
bounded serving. Sign-in takes you to the workspace checklist described in
[First-run setup](SETUP-WORKFLOW.md).

## Verify, reset and move data

Stop dev, then run `node scripts/rer.mjs verify`. Export before destructive reset
if you need the data. Reset requires `node scripts/rer.mjs reset --yes` after
reviewing its printed inventory. Export/import use `--output FILE` and
`--input FILE --yes`; import requires an empty destination. Native owners survive
restore. Re-enter private configuration before setup/dev. See
[Operations](../OPERATIONS.md#local-data-and-backups).

## Deploy and inspect

`node scripts/rer.mjs deploy --dry-run` builds and validates locally without
provider requests. `node scripts/rer.mjs deploy --environment production`
requires owner authorization and the private credentials/declaration described
in [Operations](../OPERATIONS.md#deploy-to-your-cloudflare-account).
`node scripts/rer.mjs describe` lists the remaining commands and real flags.
All new verbs accept `--help`, `--cwd PATH`, `--non-interactive` and `--json`;
release has its own preserved parser. No command implies provider acceptance.
