# Maintainer handover

This is the orientation for someone taking over HappyToHelp maintenance. Start
with [README.md](README.md) to install and run it, then read this page.

## Product and current scope

HappyToHelp 0.2.2 is the native TypeScript edition of the original customer
support application. It preserves the React dashboard, Shadow DOM widget, AI
assistance, knowledge ingestion, customer context and local-computer delegation
on a Cloudflare Worker. Pricing, billing, waitlist and referrer features are
outside this edition. [CONTRACT.md](CONTRACT.md) defines required behavior and
[ACCEPTANCE.md](ACCEPTANCE.md) defines the evidence needed to qualify it.

The current schema has 108 tables and 41 migrations. Version 0.2.1 has 97 tables
and 37 migrations. Keep the inventories separate when testing upgrades. New
migrations include project verification secrets, activation observations and
publication-bound answer citations. Applied migration names and bytes are part
of the data contract: never rewrite them.

The common verification command covers the local application. Upgrade,
independent recovery, browser and configured-provider checks are separate.
The upgrade comparison preserves original-column row bytes and permits only
the explicitly asserted secret and citation backfills. The independent recovery
check requires the exact 108-table inventory and native D1/R2 export/restore.
Any failed gate stays failed; a source version or lock is not acceptance.

## Acceptance limits and outstanding work

The timed activation recording is still missing. Recorder preparation and local
fixture tests do not establish a timed installation or live-provider acceptance.
Use [tests/live/RECORDING.md](tests/live/RECORDING.md) for the real-run recorder and
[tests/live/README.md](tests/live/README.md) for configured cited-answer evidence.

Accessibility remains **FAIL / confirmed owner HOLD**. A historical bounded run
passed 21 states with zero Axe violations, but independent 23-case oracles
reproduced four false accepts: pseudo/ancestor-opacity text reported 8.475:1 or
12.63:1 while screenshot contrast was at most 2.27:1. A widget audit reported
4.36:1 while settled glyphs measured 6.324:1; the exact earlier animation frame
is inferred because the capture omitted opacity. Eighteen review nodes and all
covered or unsupported pixels remain LIMITED. No complete WCAG conformance is
claimed. The decision remains to hold the checker and record the limitation;
no further checker correction is authorized by these maintenance instructions.
[The accessibility audit](docs/ACCESSIBILITY-AUDIT-2026-09-30.md) preserves the
findings and reproducible checks.

Portable storage fidelity remains unaccepted: a separate, unintegrated approach
restored a resizable ArrayBuffer as fixed length 4 instead of retaining maximum
length 12 and length tracking. Further correction is pending; default HOLD.
Durable Object portable storage is not included in the native D1/R2 recovery
contract. These obligations must not be inferred complete from local tests.

Hosted operating costs and actual paid model execution remain unmeasured.
The synthetic local usage fixture preserves missing D1 metadata and unknown
billing rather than estimating them as zero. See
[the usage guide](docs/usage/README.md). Historical qualification records are
kept in maintainer custody outside the product source. Fresh qualification must
identify its exact revision, artifact digest, commands and unresolved limits.
Publishing source does not establish deployment, production-import, configured
provider or full accessibility acceptance.

## Architecture

| Layer | Implementation |
| --- | --- |
| Pages | TanStack Start/React (`src/routes`, `src/ui`). `/` is the “Customer Support, Solved.” homepage (`src/ui/homepage`: one component per section, drawings in `drawings/`, scoped `homepage.css` and `drawings.css`); the authenticated workspace is one pathless dashboard layout (see [docs/NAVIGATION.md](docs/NAVIGATION.md)). |
| API | Hono (`src/app.ts`, mounted by `src/server.ts`), with identity, project and role checks in `src/platform`. |
| Records | D1 (`DB`). Schema lives in `migrations/` plus module migrations; `pnpm run migrations:prepare` collects them into `.generated/migrations`. |
| Files | R2 (`FILES`) for attachments, media and knowledge artifacts. |
| Background work | Queues (`JOBS`, dead letter `JOBS_DEAD_LETTER`) consumed in `src/jobs.ts`; a minute cron recovers persisted work. |
| Live delivery | The `ConversationSocket` Durable Object. Transcripts and the replay outbox live in D1, so sockets can always be reauthorized and replayed. |
| Customer widget | `src/modules/widget`, built to `public/widget.js` by `pnpm run build:widget`. |
| Local agent | `local-agent/`, packaged to `public/downloads/happytohelp-local-agent.tar.gz`; pairs a computer that runs delegated work. |
| Installer | `scripts/install.mjs` with shared onboarding in `scripts/base-onboarding/` and HappyToHelp adapters in `scripts/installer/`. |
| Deployment | `scripts/setup.mjs`, `scripts/deploy.mjs` and `scripts/deployment/`; hosted delivery artifacts via `scripts/build-delivery-artifact.mjs`. |

## Where things live

- `src/modules/*`: capabilities with their own `module.json` and README
  (conversations, widget, ai-support, knowledge, customer-context,
  local-computer, training-runs, plugin-sdk, site-preview, identity,
  management, integrations, public-site, legacy-import, sendgrid-email).
  [docs/MODULES.md](docs/MODULES.md) describes the reusable ones.
- `src/edition`: HappyToHelp-specific wiring between modules.
- `src/base` and `scripts/edition-authoring`: runtime foundation and source
  authoring tools retained from Run Edit Run Base (see [docs/AUTHORING.md](docs/AUTHORING.md)).
- `management/`: integration profile for Run Edit Run's hosted Assisted and
  Managed service.
- `tests/`: runtime, module and browser suites. `scripts/verify-modules.mjs`
  lists the module suites that `pnpm run verify` runs.
- `docs/`: operator and developer documentation; `docs/licenses/` holds
  third-party notices. [docs/PRIVACY.md](docs/PRIVACY.md) is the operator-facing
  privacy note and [docs/PUBLIC-LIMITS.md](docs/PUBLIC-LIMITS.md) the public
  request limits and daily AI ceilings.

## How to verify a change

Use the declared package commands for the exact source revision under review. The aggregate `pnpm run verify` does not include the separate `pnpm run test:independent-runtime` recovery assertion.

The package currently declares these browser suites:

- `pnpm run test:widget-browser`
- `pnpm run test:widget-settings-browser`
- `pnpm run test:ui-browser`
- `pnpm run test:accessibility-browser`
- `pnpm run test:navigation-browser`
- `pnpm run test:workspace-shell-browser`
- `pnpm run test:public-help-center-browser`
- `pnpm run test:not-found-browser`
- `pnpm run test:setup-browser`
- `pnpm run test:identity-browser`
- `pnpm run test:demo-inbox-browser`
- `pnpm run test:mobile-inbox-browser`
- `pnpm run test:conversation-panel-resize-browser`
- `pnpm run test:inbox-conversation-browser`
- `pnpm run test:widget-lifecycle-browser`
- `pnpm run test:contact-erasure-browser`
- `pnpm run test:management-library-browser`
- `pnpm run test:delegation-scoped-browser`
- `pnpm run test:delegation-browser`
- `pnpm run test:computers-delegation-browser`
- `pnpm run test:activation-browser`
- `pnpm run test:activation-spend-browser`

Install Chromium once with `pnpm exec playwright install chromium`. Each browser command starts its own isolated local Worker. Local tests use provider fixtures only; they do not prove a live provider or deployment.

Other separate focused commands include `pnpm run test:independent-runtime`, `pnpm run test:delegation-authority-runtime`, `pnpm run test:delegation` and `pnpm run test:usage`. These do not expand the `verify` script. The accessibility command is bounded to its declared browser states; the final checker limitations remain on confirmed owner HOLD. `test:usage` prepares generated migrations before running the two existing usage tests.

The `pnpm run verify` script runs operations describe, build, typecheck, module suites, emitted-Worker runtime and security-header checks, the first-release journey (`pnpm run test:journey`), source integrity, independent-contract and homepage-source checks. The browser suites start isolated emitted Workers with local D1, R2 and Durable Objects and write evidence to a temporary directory or `H2H_EVIDENCE_DIR`. The resize suite accepts `H2H_RUNTIME_PORT` and `H2H_RUNTIME_INSPECTOR_PORT`; contact-erasure and identity suites accept `H2H_TEST_PORT`. Identity also starts its sign-up-and-email Worker two ports above; it never sends mail.

Homepage browser/runtime checks are separate from the package `test:*-browser` scripts. Against a local native preview, run `H2H_TEST_ORIGIN=http://127.0.0.1:5186 node tests/homepage-browser.mjs` and `node tests/public-site-runtime.mjs` with the same origin after `pnpm run setup -- --local` and `pnpm exec vite preview --host 127.0.0.1 --port 5186`. `pnpm run dev` also needs local setup first: an unknown one-segment path such as `/does-not-exist` looks up a project name, so on an unmigrated local D1 it answers 500 (`no such table: projects`) instead of the branded 404. `H2H_TEST_ORIGIN=<dev origin> node tests/dev-smoke.mjs` checks `/`, `/login` and `/does-not-exist` (200, 200, 404). `node tests/independent-browser.mjs` checks homepage and setup against the delivery artifact after `node scripts/build-delivery-artifact.mjs`. Provider tests use fixtures at the real SDK/HTTP boundary and never call a paid provider.

Continuous integration's `.github/workflows/verify.yml` runs on pushes to `main` and pull requests with the declared Node and pnpm versions: a frozen install, `pnpm run verify`, the browser suites above and homepage/public-site checks against a local native preview. It needs no secrets. The delivery workflow (`.github/workflows/delivery.yml`) also runs the reproducible-build check and builds the delivery artifact.

Source archives use distinct sanitized public projection identities. Public checks
run without private originals; release qualification also requires the separate
[private equivalence proof](scripts/source-projection/README.md).

After tracked source changes, regenerate the source lock with `pnpm run source:lock` and confirm `pnpm run source:check` passes (see [docs/AUTHORING.md](docs/AUTHORING.md)).

## Conventions that matter

- Missing provider configuration returns an explicit unavailable result. Do not
  add mock data, silent fallbacks or pretend provider success to application code;
  fixtures belong in tests.
- Uncertain outcomes of paid or remote work (AI generations, email sends,
  provider imports) stay uncertain and are never replayed automatically.
- Persist before broadcasting. Final replies are admitted atomically so two
  writers cannot both finalize a conversation turn.
- Every private read or write re-checks the current user, project and role.
- Never edit an applied migration; add a new numbered one.
- Keep files split by responsibility and remove replaced code instead of
  disabling it.

## Repository identity and releases

The canonical public repository URL is declared once, in `package.json`
`repository.url`. The homepage links derive from it; `tests/repository-identity.mjs`
checks that `seed.json`, `README.md`, `SECURITY.md` and the two runtime defaults
that cannot import it (the widget's default logo link and the OpenRouter referer
header) carry the same URL, and that `rer-project.json` and
`management/integration/{profile,recipe}.json` carry its GitHub owner and repository name. Other
tests read the value from `package.json`. To rename the repository, change
`package.json`, substitute the old URL and GitHub repository identity in the files that test
names, and run `pnpm run verify`.

The release version is `package.json` `version`, mirrored in `seed.json`; record
each release in [CHANGELOG.md](CHANGELOG.md). Report vulnerabilities as described
in [SECURITY.md](SECURITY.md).

## Known gaps

- Accessibility is targeted at WCAG 2.2 AA. The bounded 21-state audit is not a
  complete conformance review; the retained checker verdict is FAIL and the owner
  HOLD remains because of checker false accepts and timing/background reliability.
  Hosted operating costs remain
  unmeasured; local scenarios preserve unknown usage and billing totals
  (`seed.json` and the usage guide).
- Some legacy dashboard features are not yet native; see
  [docs/UI-PARITY.md](docs/UI-PARITY.md).
- The separate portability candidate still has a resizable-`ArrayBuffer`
  fidelity failure and is not integrated or accepted. Durable
  Object storage is not part of a portable export; recovery relies on D1 and R2
  ([docs/INDEPENDENT-RELEASE.md](docs/INDEPENDENT-RELEASE.md)).
