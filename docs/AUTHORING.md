# Author this edition and select its modules

HappyToHelp owns its complete UI, integrations, schema, commands and policy.
`edition.json` records selected licensed source, immutable origins/mappings and
retained comparison archives; it does not generate the product or restrict owner
changes to configuration. `base-copies.json` records byte-exact Base copies and
Git modes. [Source origins](SOURCE-PROVENANCE.md) retains attribution/licensing.

Run the app through `node scripts/rer.mjs`. The self-contained CLI export contains
the shared operations implementation. Setup reads `rer-setup.json` with the
maintained manifest reader, while native owner/password identity stays in this
edition's adapter. Do not patch copied Base files or create another setup schema,
secret generator, process runner, readiness loop or archive engine.

Stage intentional changes, refresh the lock and verify it:

```sh
pnpm run source:inspect
pnpm run source:lock
pnpm run source:check
node scripts/edition-authoring/cli.mjs verify-base --offline
```

Local source locks and offline copy checks prove local byte/mode custody. They
do not authenticate origin records or qualify the app. Tests use committed Git
origin fixtures to exercise refusal of drift, forged hashes, missing paths,
unrecorded copies and modes. Before merging a Base refresh, fetch its selected
immutable official commit and run the stronger origin checks:

```sh
pnpm run source:verify-base-origin -- --base /absolute/base-checkout
pnpm run test:base-origin -- --base /absolute/base-checkout
```

Use maintained `record-base` for new official copies. Preserve the selected
archives and dependency closure, asset provenance and immutable applied SQL.
Native passwords, tenant authority, privacy and import/undo equality remain
product requirements. Public projection identities preserve approved original
bytes separately from public source; never waive a publication scanner finding.

Local, exact-head CI, hosted installation, configured providers, accessibility
and public release are separate acceptance surfaces. Keep qualification evidence
outside product source and retain [the owner holds](../HANDOVER.md#acceptance-boundaries).
