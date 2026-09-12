# HappyToHelp owner pilot acceptance — 2026-09-12

Live origin: https://support-happytohelp-pilot-20260912.james-d16.workers.dev

Source: Support `4fdbba1dbe50292ba473438ba4f5f37504650071`, Base `1d3ce621240460baa029370b7ef001c4ec67930a`. Export remained pristine; deployment ran from a private temporary copy. Second deployment reused the same D1 and authenticated the existing owner. Worker version: `c3207877-68a9-46c5-819b-f5203e498bfe`.

The installation began with zero requests, workspaces and agent connections. The owner signed in, created a workspace pointing only to an isolated temporary folder, and connected a scoped native Python helper. A read-only investigation exercised repeatable claim recovery, context/check/progress, required operator input, resume, actual file SHA256 evidence, screenshot upload, verified completion and operator resolution. The file remained unchanged.

A separate explicitly authorized Resolve and reply request sent exactly one message to james@justevery.com through the durable outbox. The provider accepted it and the request resolved automatically. Mailbox delivery was not verified. The scoped agent credential was then revoked and the native helper was rejected; operator signout also rejected subsequent data access.

`receipt.json` records actual identifiers and checks. `deployment-first.json` and `deployment-second.json` record resource reuse and versions. Desktop/mobile images are actual browser captures. No passwords, bearer tokens or provider secrets are included in this directory.

Full `pnpm verify` passed on the exact v2 source: selected composition tests (1 core + 4 sender), manifest validation, TypeScript, 19 product/setup/helper tests, real Worker/D1 browser journey, and production build. See `verify.log`.
