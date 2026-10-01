# Maintainer handover

This is the orientation for someone taking over HappyToHelp maintenance. Start
with [README.md](README.md) to install and run it, then read this page.

## What it is

HappyToHelp 0.2.2-rc.1 is a private preservation candidate for the native
TypeScript rewrite of the original HappyToHelp
customer support application, which ran on PHP/Laravel and AWS. It keeps the
original React dashboard and Shadow DOM customer widget, the AI assistance
pipeline, knowledge ingestion, customer context and local-agent delegation, and
runs them on a single Cloudflare Worker. Pricing, billing, marketing, waitlist
and referrer features of the original service are deliberately not part of this
edition. The `0.2.2-rc.1` version does not mean public release or product
acceptance: the public source release remains 0.2.1 until a separate owner
decision. [CONTRACT.md](CONTRACT.md) states the required behavior;
[ACCEPTANCE.md](ACCEPTANCE.md) states the evidence each requirement needs.

## Private candidate qualification record

The current source-pinned candidate is `f2054c3b7cd19fcddd9962e418f680f92c89109b`.
Its final accessibility verdict is **FAIL / confirmed owner HOLD** because the
checker remains unreliable. After two correction rounds, the owner answered
question 12: “Hold the checker; record the audit limitation (default)”. No third
checker correction is authorized. Public release remains **HOLD**.

The untouched final gate passed 21 states with zero Axe violations, but the
independent and root 23-case oracle both reproduced four false accepts:
pseudo/ancestor opacity text was reported as 8.475:1 or 12.63:1 while actual
pixels were at most 2.27:1. The root's widget audit failed at 4.36:1; the
independent timing/background diagnosis measured settled actual glyphs at
6.324:1. Its exact original animation frame is inferred, since the root capture
omitted opacity. No remaining steady product defect was established in the
exercised corrected states. Eighteen review nodes and every covered or
unsupported pixel remain LIMITED; no complete WCAG conformance is claimed.

The final gate retains passing build/typecheck, six product correction checks,
four occlusion regressions, 26 independent keyboard checks and five independent
runtime checks. Native demo and the ten parity rows carry only from exact
unchanged verified source and emitted bundles. The historical c7 gate receipt
is retained as historical evidence, not the current disposition. Exact reports,
root failures, commands and external SHA-256 references are in the
[current receipt](verification/rc-0.2.2-rc.1/final-qualification.json).

The original v0.2.1 independent runtime proof now **passes through an external
port/import-only adapter**, preserving original assertions and runtime semantics.
Both the independent run and root replication prove 97 tables and 37 migrations
on artifact `f082bded3dd64470d7283c935934f4a2d7224e69fe540cece7c862a15989b968`.
The unchanged CLI remains held at HTTP ports 12401/12501 and default inspector
ports. This does not qualify the candidate's 104-table inventory, DO portable
storage or complete RER export.

Portability fidelity remains separate at
`ef8406f654908cf67612a498511f99ce13f8ae12`, privately pushed but not integrated.
After two rounds, a persisted resizable ArrayBuffer with maximum length 12 still
restores as a fixed length 4 buffer, losing resizability/length tracking. The
further narrow correction question remains unanswered, default HOLD.

Full `pnpm run verify` is not claimed: its retained original inventory expects
97 tables/37 migrations; this candidate has 104 tables/38 migrations. Original
port/lifecycle exceptions and DO decisions remain unanswered and unapplied.
The root integrated these records at `557cb4e`, then `pnpm run source:lock` and
`pnpm run source:check` both passed (exit 0); only `sources.lock.json` changed.
This validates recorded source bytes, not full verify or release acceptance.
Exact command logs are pinned in the current receipt. Public main remains v0.2.1 at
`59c6e2e1beb321e9f1cb5493efd05e20fc068638`, as verified by the root. No public
push, tag, deployment or production cutover is authorized by this record.

The actual composed usage measurement remains pinned to `c7f0d1b8` and
[its receipt](verification/rc-0.2.2-rc.1/composed-usage.json): two passing local
tests, request admissions 201/201/429 and zero actual provider calls. Actual
paid AI and hosted/billing totals remain unknown. Current UI changes do not
establish a new measurement. Cost assumptions and limitations remain in
[OPERATIONS.md](OPERATIONS.md#measured-local-usage-and-cost-scenarios).

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

```sh
pnpm install --frozen-lockfile
pnpm run verify
pnpm exec playwright install chromium   # once
pnpm run test:widget-browser
pnpm run test:widget-lifecycle-browser
pnpm run test:widget-settings-browser
pnpm run test:ui-browser
pnpm run test:navigation-browser
pnpm run test:workspace-shell-browser
pnpm run test:public-help-center-browser
pnpm run test:setup-browser
pnpm run test:identity-browser
pnpm run test:demo-inbox-browser
pnpm run test:mobile-inbox-browser
pnpm run test:conversation-panel-resize-browser
pnpm run test:contact-erasure-browser
```

The candidate also exposes these focused commands for its existing tests:

```sh
pnpm run test:accessibility-browser
pnpm run test:delegation-authority-runtime
pnpm run test:delegation-scoped-browser
pnpm run test:usage
```

They are supplemental qualification commands, not changes to `verify` or the
existing delegation commands. The accessibility command is bounded to its
declared browser states; the final checker limitations above remain
on confirmed owner HOLD. `test:usage` prepares generated migrations, then runs
the two existing usage tests.

`pnpm run verify` runs the operations descriptor, build, type check, module
suites, the emitted-Worker runtime and security-header suites, the first-release
journey (`pnpm run test:journey`) and the source integrity check. The browser
suites start their own isolated emitted Worker with local D1, R2 and Durable
Objects and write evidence to a temporary directory or `H2H_EVIDENCE_DIR`; the
resize suite also accepts `H2H_RUNTIME_PORT` and `H2H_RUNTIME_INSPECTOR_PORT` to
fix its server and inspector ports, and the contact-erasure suite accepts
`H2H_TEST_PORT` (its inspector uses the next port). The identity suite also accepts `H2H_TEST_PORT` for its default
Worker and runs its sign-up-and-email Worker two ports above; it never sends mail. The homepage and public-site checks run
against a local native preview:
`H2H_TEST_ORIGIN=http://127.0.0.1:5186 node tests/homepage-browser.mjs` and
`node tests/public-site-runtime.mjs` with the same origin, after
`pnpm run setup -- --local` and `pnpm exec vite preview --host 127.0.0.1 --port 5186`;
`node tests/independent-browser.mjs` runs the homepage and setup checks against
the delivery artifact after `node scripts/build-delivery-artifact.mjs`.
`pnpm run test:reproducible-build` (about 90 seconds) checks that the delivery
artifact is byte-reproducible. Provider tests use fixtures at the real SDK/HTTP
boundary and never call a paid provider.

Continuous integration (`.github/workflows/verify.yml`) runs on pushes to `main`
and on pull requests with the declared Node and pnpm versions: a frozen install,
`pnpm run verify`, every browser suite above, and the homepage and public-site
checks against a local native preview. It needs no secrets. The delivery
workflow (`.github/workflows/delivery.yml`) also runs the reproducible-build
check and builds the delivery artifact.

After changing tracked source, regenerate the source lock with
`pnpm run source:lock` and confirm `pnpm run source:check` passes (see
[docs/AUTHORING.md](docs/AUTHORING.md)).

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
  complete conformance review; the final f205 gate remains FAIL / confirmed
  owner HOLD because of checker false accepts and timing/background reliability.
  Hosted operating costs remain
  unmeasured; local scenarios preserve unknown usage and billing totals
  (`seed.json` and the composed-usage receipt).
- Some legacy dashboard features are not yet native; see
  [docs/UI-PARITY.md](docs/UI-PARITY.md).
- The separate portability candidate still has a resizable-`ArrayBuffer`
  fidelity failure and is not integrated or accepted for this RC. Durable
  Object storage is not part of a portable export; recovery relies on D1 and R2
  ([docs/INDEPENDENT-RELEASE.md](docs/INDEPENDENT-RELEASE.md)).
