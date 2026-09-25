# Working on HappyToHelp

Guidance for contributors and coding agents. Read README.md, HANDOVER.md,
CONTRACT.md and ACCEPTANCE.md first for scope, architecture and evidence.

Use the TanStack Start/React/Hono/TypeScript Worker runtime and the common
`pnpm run dev`, `build`, `verify`, `setup`, `deploy` and `source:*` commands.
Modules under `src/modules` own reusable capabilities and are integrated through
ordinary imports. Module boundaries save work; they do not restrict product
changes. Keep modules coherent and files split by responsibility, and remove
replaced code rather than disabling it.

Preserve message admission, revisions, tenant isolation, permission checks,
knowledge publication and local-agent authority. Unknown outcomes of paid or
remote work must stay unknown and must never trigger automatic replay of side
effects. Reuse existing implementations and meaningful regression tests.

No mock application data, silent success fallbacks or pretend provider behavior:
provider fixtures belong only in tests. Never commit credentials, local state
(`.dev.vars`, `.seed/`, `.wrangler/`) or private customer content.

Verify with real local Worker, D1, R2, socket and browser runs (`pnpm run verify`
plus the relevant `test:*-browser` suites), and keep configured-provider and
hosted checks distinct from local results. After changing tracked files, run
`pnpm run source:lock` so `pnpm run source:check` passes.
