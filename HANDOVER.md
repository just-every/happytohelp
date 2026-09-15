# HappyToHelp native edition handover

The edition now owns the native HappyToHelp application and its selected source.
The PHP application has been replaced by TanStack Start/React, Hono and the RER
Worker runtime. Existing dashboard, widget, prompts, evaluation and local-agent
source were retained or ported with their behavior and provenance recorded.

`docs/MODULES.md` identifies conversation, widget, AI support, knowledge, customer
context, local computer, training, plugin SDK and site preview capabilities.
They are editable source with explicit integration contracts. Neutral entry points
can be selected independently; full HappyToHelp route adapters carry the actual
edition dependencies. `docs/SECOND-CONSUMER-PROOF.json` records an isolated Beacon
adoption without changing canonical Beacon.

The 15 September [UI restoration record](docs/UI-PARITY.md) covers comparison
against a running original Laravel instance, the restored workspace/forms and
remaining legacy differences. Desktop/mobile screenshots and real save/reload
checks accompany this pass; it does not claim full legacy feature equality.

## Run and verify

Use Node 26.8.1 and pnpm 10.12.4. Run `node scripts/operations.mjs describe` before
installation, then `pnpm install --frozen-lockfile`, `pnpm run setup -- --local`
and `pnpm run dev`. Open `/setup` to create the first owner with an email and password. Subsequent access uses `/login`.

`pnpm run verify` checks operations, build, types, module tests, a fresh emitted
Worker and source integrity. It includes native public pages and waitlist checks.
After `pnpm exec playwright install chromium`, run `pnpm run test:setup-browser`,
`pnpm run test:ui-browser` and `pnpm run test:widget-browser`.
Each starts isolated local data and writes evidence
to a temporary directory, or under `H2H_EVIDENCE_DIR`. CI runs these checks.
`pnpm run deploy -- --local` verifies packaging without deploying a Worker.

The 15 September setup repair replaces the former three-request flow with an
atomic first-owner transaction. No bootstrap token is required. Invalid inputs
leave setup available; existing, imported or deleted installations cannot reopen
first-owner setup. The setup browser check submits the actual form, verifies
password validation, dashboard reload, subsequent login and completed setup.

The tests use actual local D1, R2, Durable Objects and Worker execution. Provider
fixtures intercept real SDK/HTTP boundaries in test harnesses. The optional live
human-voice evaluation remains explicitly skipped without provider authorization.
The repository's `evidence/` directory preserves integration-stage results;
final verification must identify the exact source revision and resulting bundle.

## Migration and external operation

`scripts/import-legacy.mjs` plans and applies an explicit local export with
resumable row and object custody. Read the importer README before running it.
Tests preserve original IDs, blocked contacts, AI versus human assignments,
publication privacy, object hashes, exact amounts and uncertain operations.
All input rows are archived; unsupported encrypted or provider-only data remains
explicitly archive-only until supplied in the documented normalized form.
This is a tested migration mechanism, not a claim that production data was moved.

Original HappyToHelp repositories remain unchanged. The native commit retains
the earlier RER desk's Git ancestry; that historical implementation can be read
in Git and is no longer an alternative runtime in this edition.

Provider setup, real email/model/payment acceptance, deployments, production-data
imports and public publication have not been performed. Missing configured
providers return an explicit unavailable state. Unknown paid outcomes retain
their receipts and do not automatically replay. Public asset rights and licence
decisions are documented in `docs/SOURCE-PROVENANCE.md` and
`docs/PUBLIC-SOURCE-PROVENANCE.md`; this migration does not assert universal
redistribution clearance.
