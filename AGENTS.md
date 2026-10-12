# Run it locally

Use Node **22.20.0** and pnpm **10.12.4**, from the checkout root. Prepare a
private `.seed/local-answers.json` using [the manifest fields](docs/INSTALLER.md#private-setup-answers);
HappyToHelp requires a workspace name, widget origin and native owner password.
Keep secrets in that file, never command arguments.

```sh
node scripts/rer.mjs install
node scripts/rer.mjs setup --owner-email you@example.com --answers .seed/local-answers.json
node scripts/rer.mjs dev
```

Dev prints the app address and its `/__dev/outbox`. Open the outbox, choose the
newest sign-in message, follow its link and press **Sign in**. No email is sent.
Stop dev with Ctrl+C before verification or data operations.

```sh
node scripts/rer.mjs verify
node scripts/rer.mjs reset --yes
node scripts/rer.mjs export --output exports/support.rer
node scripts/rer.mjs import --input exports/support.rer --yes
node scripts/rer.mjs deploy --dry-run
node scripts/rer.mjs deploy --environment production
node scripts/rer.mjs describe
```

Reset erases the printed local inventory; export your data **before** resetting
if you need it. Import requires an empty destination and retains native owners.
Deploy requires explicit owner authorization and private account configuration;
`--dry-run` validates locally without deployment. See [OPERATIONS.md](OPERATIONS.md)
for state, deployment and restore requirements.

## Working on HappyToHelp

Read [CONTRACT.md](CONTRACT.md), [ACCEPTANCE.md](ACCEPTANCE.md) and
[HANDOVER.md](HANDOVER.md) for requirements, proof boundaries and architecture.
Use the TanStack Start/React/Hono/TypeScript Worker runtime. The rer adapter is
`scripts/installer/local.mjs`; internal `build:app`, `build:assets` and `verify:app`
are its execution targets. Agents start the application through rer.

The site's `/docs` pages are built from Markdown listed in `docs/site.json`.
List each root or docs Markdown file there as published or GitHub-only. Modules
under `src/modules` own reusable capabilities through ordinary imports. Split
files by responsibility and remove replaced code.

Preserve native passwords, message admission/revisions, tenant isolation,
permissions, knowledge publication, prior data and local-agent authority.
Unknown paid or remote outcomes remain unknown and never trigger automatic
replay. Provider fixtures belong only in tests; no mock application behavior or
silent-success fallback. Never commit credentials, local state or customer data.

Run touched tests and the typecheck. Full verification and browser checks belong
on the designated remote runner; keep local, hosted and configured-provider
results distinct. After tracked edits, run `pnpm run source:lock`, then
`pnpm run source:check`. Preserve the selected byte-exact Base sources.
