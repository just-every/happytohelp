# Author this edition and select its modules

HappyToHelp is an edition-owned application. Its complete UI, integrations,
schema, operation commands and policy live here. The source graph records real
existing paths; it does not generate application files or restrict owner changes
to configuration. First-party work, owner forks and other publishers use the same
Base edition-authoring 1.1.0 commands.

The retained tool is selected independently of runtime Base. The observed Base
runtime/tool revision is `ac90a05c0549e1f8a65a94f64ac6e2d629f4d5e1`:
`src/base` came from the foundation/runtime directory,
`scripts/edition-authoring` from `edition-authoring`, and `scripts/operations.mjs`
from `operations/operations.mjs`.
The template ancestry and independently selected onboarding and email revisions
are recorded in [SOURCE-PROVENANCE.md](SOURCE-PROVENANCE.md).

`edition.json` selects retained local files. Its optional private donor origins,
parent comparison and unused donor archives are absent from the public edition.
The source lock binds the current local source and exact tool bytes, so
`pnpm source:check` works offline without accessing the private donor. Historical
revision attribution does not claim current bytes equal upstream bytes. A future
comparison needs a separately authorized source selection and retained baseline.

Inspect with `pnpm source:inspect`. After the owner freezes the intended tree,
stage actual inputs, run `pnpm source:lock`, stage sources.lock.json and retained
.edition/sources, commit, then run `pnpm source:check`. The check binds effective
files and exact tool bytes. Do not lock during parallel edits. `source:release`
takes an absent output directory and requires a clean committed source check;
its adjacent receipt is distributed separately from the portable repository.
No command here deploys, pushes, tags or replaces another edition.

Each reusable capability's module.json lists its source paths, including useful
migrations/tests. To reuse one, select the required paths at an immutable source
commit and choose a destination in the consuming edition. Use ordinary imports
and edition adapters. Paths outside that capability listed as dependencies remain
explicit choices. Hono adapters using this edition's platform/auth contract need a
consumer-owned authorization adapter; copying them alone is not integration.
Migrations apply once in the consumer's existing ledger; source adoption never
resets existing data or rewrites applied migration history.

Neutral AI assistance entry points can be selected without an inbox, provider,
training runner or D1 schema. `src/modules/ai-support/module.json` lists the
context-only selection; `tests/module-boundaries.mjs` copies it outside the checkout and
exercises it there. After a source commit exists, a recipient may use the standard
Git selector and `materialize` to produce a build workspace, then normal install,
build and product verification. `extract`, `compare` and `changes` inform a future
update; they do not choose its merge method or infer behavioral acceptance.
