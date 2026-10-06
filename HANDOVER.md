# Maintainer handover

This is the orientation for someone taking over HappyToHelp maintenance. Start
with [README.md](README.md) to install and run it, then read this page.

## What it is

HappyToHelp 0.2.2 is prepared on the private release line for the native
TypeScript rewrite of the original HappyToHelp
customer support application, which ran on PHP/Laravel and AWS. It keeps the
original React dashboard and Shadow DOM customer widget, the AI assistance
pipeline, knowledge ingestion, customer context and local-agent delegation, and
runs them on a single Cloudflare Worker. Pricing, billing, marketing, waitlist
and referrer features of the original service are deliberately not part of this
edition. The `0.2.2` version does not mean public release or product
acceptance: the public source release remains 0.2.1 until a separate owner
decision. [CONTRACT.md](CONTRACT.md) states the required behavior;
[ACCEPTANCE.md](ACCEPTANCE.md) states the evidence each requirement needs.

## Private 0.2.2 release preparation and qualification status

T-021 cited answers and T-022 activation/Knowledge changes are merged on
`release/0.2.x`. T-022's timed live recording is missing; recorder preparation
is not a completed recording or live-provider acceptance. Version 0.2.2 is
finalized in source; public publication and tagging remain owner-held.

The current schema is 108 tables and 41 migrations. Public v0.2.1 at
`59c6e2e1beb321e9f1cb5493efd05e20fc068638` has 97 tables/37 migrations;
historical launch `09d80a7` has 104/38, and merged baseline `a78076a` has
104/39. Migrations 0107/0108 add activation receipts and publication-bound
answer citations. Keep each revision's inventory distinct.

[The release receipt](verification/release-0.2.2/release.json) records the exact
source, artifact digest, row comparison and local test outcomes. The genuine
v0.2.1 upgrade proof builds archived public source, writes through its setup and
journey APIs, stops that Worker and applies head migrations to the same D1
file. Its comparison reports original-column row bytes and explicit migration
differences; any failed gate stays failed in the receipt.

`pnpm run verify` runs operations describe, build, typecheck, module checks,
runtime checks, the first-release journey, source check, independent-contract
and homepage-source checks. It does not invoke `test:upgrade`, the browser
scripts or `test:independent-runtime`; their outcomes must be read separately.
The unchanged independent-runtime suite retains its original 97-table restore
assertion. A head artifact with 108 tables cannot claim that historical proof
as its own recovery qualification.

No public push, tag, release, deployment, live-provider proof or production
acceptance follows from this preparation. Public v0.2.1 remains the known
published baseline. [Owner commands](verification/release-0.2.2/OWNER-STEPS.md)
are conditional on release approval and a passing local release gate; service,
site, stage and production work belongs to other lanes.

## Retained accessibility HOLD and historical qualification evidence

The current accessibility disposition remains **FAIL / confirmed owner HOLD**, carried forward from the final gate on historical source `f2054c3b7cd19fcddd9962e418f680f92c89109b`. After two correction rounds, the owner answered question 12: “Hold the checker; record the audit limitation (default)”. No third checker correction is authorized. Public release remains on HOLD. The [historical exact receipt](verification/rc-0.2.2-rc.1/final-qualification.json) records the original source and evidence; it is not a fresh gate on `a78076a`.

That final gate passed 21 states with zero Axe violations, but the independent and root 23-case oracle both reproduced four false accepts: pseudo/ancestor opacity text was reported as 8.475:1 or 12.63:1 while actual pixels were at most 2.27:1. The root widget audit failed at 4.36:1; the independent timing/background diagnosis measured settled actual glyphs at 6.324:1. Its exact original animation frame is inferred because the root capture omitted opacity. No remaining steady product defect was established in the exercised corrected states. Eighteen review nodes and every covered or unsupported pixel remain LIMITED; no complete WCAG conformance is claimed.

The historical f2054 gate retained passing build/typecheck, six product correction checks, four occlusion regressions, 26 independent keyboard checks and five independent runtime checks. Native demo and the ten parity rows carry only from the exact unchanged source and emitted bundles used in that gate. The historical c7 gate receipt is retained as historical evidence, not the current disposition. Exact reports, root failures, commands and external SHA-256 references are in the receipt above.

The original v0.2.1 independent runtime proof passed through an external port/import-only adapter, preserving the original assertions and runtime semantics. Both the independent run and root replication proved 97 tables/37 migrations on artifact `f082bded3dd64470d7283c935934f4a2d7224e69fe540cece7c862a15989b968`. The unchanged CLI remains held at HTTP ports 12401/12501 and default inspector ports. This does not qualify the merged candidate's 104-table inventory, Durable Object portable storage or complete RER export.

Portability fidelity is separate from this merge. The owner-held portability candidate at `ef8406f654908cf67612a498511f99ce13f8ae12` stays excluded and unintegrated. After two rounds, a persisted resizable ArrayBuffer with maximum length 12 still restores as a fixed length 4 buffer, losing resizability/length tracking. The further narrow correction question remains unanswered; default HOLD.

The earlier root record refresh at `557cb4e` ran source-lock and source-check successfully, changing only sources.lock.json. That validates those recorded source bytes, not full verification or release acceptance. The actual composed usage measurement remains pinned to `c7f0d1b8` and [its receipt](verification/rc-0.2.2-rc.1/composed-usage.json): two passing local tests, request admissions 201/201/429 and zero actual provider calls. Actual paid AI and hosted/billing totals remain unknown. Current UI changes do not establish a new measurement. Cost assumptions and limitations remain in [OPERATIONS.md](OPERATIONS.md#measured-local-usage-and-cost-scenarios).

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

Install Chromium once with `pnpm exec playwright install chromium`. Each browser command starts its own isolated local Worker. Local tests use provider fixtures only; they do not prove a live provider or deployment.

Other separate focused commands include `pnpm run test:independent-runtime`, `pnpm run test:delegation-authority-runtime`, `pnpm run test:delegation` and `pnpm run test:usage`. These do not expand the `verify` script. The accessibility command is bounded to its declared browser states; the final checker limitations remain on confirmed owner HOLD. `test:usage` prepares generated migrations before running the two existing usage tests.

The `pnpm run verify` script runs operations describe, build, typecheck, module suites, emitted-Worker runtime and security-header checks, the first-release journey (`pnpm run test:journey`), source integrity, independent-contract and homepage-source checks. The browser suites start isolated emitted Workers with local D1, R2 and Durable Objects and write evidence to a temporary directory or `H2H_EVIDENCE_DIR`. The resize suite accepts `H2H_RUNTIME_PORT` and `H2H_RUNTIME_INSPECTOR_PORT`; contact-erasure and identity suites accept `H2H_TEST_PORT`. Identity also starts its sign-up-and-email Worker two ports above; it never sends mail.

Homepage browser/runtime checks are separate from the package `test:*-browser` scripts. Against a local native preview, run `H2H_TEST_ORIGIN=http://127.0.0.1:5186 node tests/homepage-browser.mjs` and `node tests/public-site-runtime.mjs` with the same origin after `pnpm run setup -- --local` and `pnpm exec vite preview --host 127.0.0.1 --port 5186`. `pnpm run dev` also needs local setup first: an unknown one-segment path such as `/does-not-exist` looks up a project name, so on an unmigrated local D1 it answers 500 (`no such table: projects`) instead of the branded 404. `H2H_TEST_ORIGIN=<dev origin> node tests/dev-smoke.mjs` checks `/`, `/login` and `/does-not-exist` (200, 200, 404). `node tests/independent-browser.mjs` checks homepage and setup against the delivery artifact after `node scripts/build-delivery-artifact.mjs`. Provider tests use fixtures at the real SDK/HTTP boundary and never call a paid provider.

Continuous integration's `.github/workflows/verify.yml` runs on pushes to `main` and pull requests with the declared Node and pnpm versions: a frozen install, `pnpm run verify`, the browser suites above and homepage/public-site checks against a local native preview. It needs no secrets. The delivery workflow (`.github/workflows/delivery.yml`) also runs the reproducible-build check and builds the delivery artifact.

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
`management/integration/{profile,recipe}.json` carry its `owner/name` form. Other
tests read the value from `package.json`. To rename the repository, change
`package.json`, substitute the old URL and `owner/name` in the files that test
names, and run `pnpm run verify`.

The release version is `package.json` `version`, mirrored in `seed.json`; record
each release in [CHANGELOG.md](CHANGELOG.md). Report vulnerabilities as described
in [SECURITY.md](SECURITY.md).

## Known gaps

- Accessibility is targeted at WCAG 2.2 AA. The bounded 21-state audit is not a
  complete conformance review; the retained f2054 gate is FAIL and the owner
  HOLD remains because of checker false accepts and timing/background reliability.
  Hosted operating costs remain
  unmeasured; local scenarios preserve unknown usage and billing totals
  (`seed.json` and the composed-usage receipt).
- Some legacy dashboard features are not yet native; see
  [docs/UI-PARITY.md](docs/UI-PARITY.md).
- The separate portability candidate still has a resizable-`ArrayBuffer`
  fidelity failure and is not integrated or accepted for this RC. Durable
  Object storage is not part of a portable export; recovery relies on D1 and R2
  ([docs/INDEPENDENT-RELEASE.md](docs/INDEPENDENT-RELEASE.md)).
