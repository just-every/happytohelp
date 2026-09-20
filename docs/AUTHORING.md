# Author this edition and select its modules

HappyToHelp is an edition-owned application. Its complete UI, integrations,
schema, operation commands and policy live here. The source graph records real
existing paths; it does not generate application files or restrict owner changes
to configuration. First-party work, owner forks and other publishers use the same
Base edition-authoring 1.1.0 commands.

The retained tool is selected independently of runtime Base. Base runtime/tool origin is
`ac90a05c0549e1f8a65a94f64ac6e2d629f4d5e1`. `src/base` maps to
`foundation/runtime`; `scripts/edition-authoring` maps to `edition-authoring`;
`scripts/operations.mjs` maps to `operations/operations.mjs`. The parent comparison
is the committed `foundation/template`. The independently selected onboarding source retains Base comparison commit
`cb9a22d3a8a5e894c1b7b8b48b24beca3379f576`, path `onboarding`.
Local changes are effective source; origin
mappings never claim current bytes are equal to old bytes.

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
training runner or D1 schema. `ai-support/module.json` lists the context-only
selection. The isolated Beacon exercise uses those exact source bytes in Beacon's
real reviewed-preparation request path; it does not change canonical Beacon.
Its proof record distinguishes copied working bytes from a final pinned release.
After this edition's final source commit exists, a recipient may use the standard
Git selector and `materialize` to produce a build workspace, then normal install,
build and product verification. `extract`, `compare` and `changes` inform a future
update; they do not choose its merge method or infer behavioral acceptance.
