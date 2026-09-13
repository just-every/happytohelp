# HappyToHelp operations

Run HappyToHelp from the exported edition with Node 26.8.1 and pnpm 10.12.4.
The target is always explicit.

`pnpm run setup -- --remote` runs checks, prepares the selected remote D1 and
ignored Worker configuration, and applies migrations without publishing or
initializing the owner. Use '-- --local' for local preparation.

`pnpm run deploy -- --remote` runs checks, prepares the remote D1, builds and
validates the emitted Worker, applies migrations, uploads temporary private
secrets, waits for `/health`, and initializes or verifies the owner. The
deployment does not execute agent work. Optional outbound mail requires
SENDGRID_API_KEY and MAIL_FROM together.

`pnpm run verify` is bounded local implementation evidence: it covers the
listed tests, a fresh Worker/D1/browser journey and the production build. See
[ACCEPTANCE.md](ACCEPTANCE.md); a green verify does not prove business-workspace
effects, mailbox delivery, or complete release acceptance.

`GET /health` performs a D1 SELECT and reports service availability. It does
not verify owner bootstrap, agent credentials, connected workspace effects,
mail delivery, or provider outcomes.

Run `node scripts/operations.mjs describe` to inspect the operation interface,
or `node scripts/operations.mjs check` to check inputs. The check validates local static inputs only and
does not contact Cloudflare or certify generated configuration, artifacts,
migrations, or hosted health.
