# Working on HappyToHelp

This is the native Run Edit Run migration candidate for the full HappyToHelp
application. It owns editable product source and selects reusable capabilities.
Read README.md, ACCEPTANCE.md, CONTRACT.md and docs/MIGRATION.md for implemented
scope and evidence. The old small RER delegation desk is historical source, not
the full application's acceptance.

Use the maintained TanStack Start/React/Hono/TypeScript Worker runtime and common
dev/build/verify/setup/deploy/source commands. Modules under src/modules own useful
capabilities, with explicit ordinary-code integration. Owners may edit any source
or adopt a different tested target. Module boundaries save work; they do not
restrict product changes. Keep modules coherent and files split by responsibility.

Port actual behavior from the current HappyToHelp JavaScript and React source;
replace PHP services. Preserve message admission, revisions, tenant isolation,
permission checks, knowledge publication and local-agent authority. Unknown paid
or remote outcomes must remain unknown and must not trigger automatic side-effect
replay. Reuse substantial existing implementations and meaningful regression tests.

No mock application data, silent success fallback or pretend provider behavior.
Provider fixtures belong only in tests. Do not expose credentials, local state or
private test/customer content in source releases. Original HappyToHelp checkouts
are preserved; change this native source for migration work.

Source release proves custody and portability, not product behavior or deployment.
Use real local Worker/D1/R2/socket/browser evidence and distinguish configured
provider and hosted acceptance. Record unfinished inventory items explicitly and
continue until the authorized migration is complete.
