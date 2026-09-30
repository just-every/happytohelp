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

The measured application source is `c7f0d1b8ce447e59804d736ce364e9812dcf2715`.
Its emitted local Worker digest is recorded in
[`verification/rc-0.2.2-rc.1/composed-usage.json`](verification/rc-0.2.2-rc.1/composed-usage.json).
That measurement predates the RC metadata edits and any subsequent accessibility
correction; it is not the final emitted identity for the frozen candidate.

The root's focused local usage run passed 2/2 tests. It made no provider calls.
The receipt preserves unknown D1 totals, hosted Worker CPU, Durable Object
duration/storage and total billing as unknown; its monthly price scenarios are
component subtotals under stated assumptions, not invoices or total costs.
At `c7f0d1b`, the root also reported frozen install, build and typecheck as
passing. Earlier focused delegation evidence passed on
`e6c1136043f7ccd649f43969f57254f3d5be492d`; it is lane evidence, not the final
composed RC gate.

The failed source-specific composed accessibility gate on `c7f0d1b` reported
three reproduced findings:

- The article-editor **Delete** link measured 4.15:1 against white at desktop
  and 320 CSS pixels, below the 4.5:1 text threshold.
- Add note keyboard navigation can leave the dialog on forward Tab and strand
  reverse navigation on the dialog container.
- A branding focus outline measured 1.90:1 after alpha compositing; an earlier
  audit result of 6.06:1 did not account for the alpha channel.

The earlier 19-state Axe result remains bounded to its documented states and
does not close these findings. The accessibility corrections are integrated in
the root's later `6ffffb0` composition; its fresh composed gate is pending. Treat
the c7 result as historical evidence for that exact source snapshot. The root
will append the corrected final adjudication after the gate. Do not mark
accessibility accepted before that result.
The gate also found the UI parity record incomplete: six rows (53 and 55–59)
need an explicit consequence and supported alternative, or an explicit
statement that none exists. The onboarding/demo row omits the existing native
**Try a demo inbox** option. The failed-gate receipt and external report digest
are in
[`verification/rc-0.2.2-rc.1/composed-accessibility-gate.json`](verification/rc-0.2.2-rc.1/composed-accessibility-gate.json).

Portability recovery work remains on the separate private branch
`codex/h2h-portability-fidelity-20260929` at
`ef8406f654908cf67612a498511f99ce13f8ae12`; it is not selected by this
candidate. Its two bounded correction rounds ended with a reproduced persisted
resizable-`ArrayBuffer` fidelity loss. The owner's question about one further
narrow correction is unanswered (default: hold). This candidate has no fresh
full-restore claim.

The retained original verification harness expects 97 application tables and
37 migrations; the composed candidate has 104 tables (the 97-table baseline
plus seven delegation tables) and 38 migrations. The owner-exception proposal
is review-only and has not been applied. Full `pnpm run verify`, source-lock
freshness and final composed acceptance are therefore not claimed here. The
metadata branch leaves `sources.lock.json` for the root to refresh after the
source and records are frozen. No public push, tag or deployment is part of
this candidate record.

## Architecture

| Layer | Implementation |
| --- | --- |
| Pages | TanStack Start/React (`src/routes`, `src/ui`). `/` is the village homepage (`src/ui/homepage`); the authenticated workspace is one pathless dashboard layout (see [docs/NAVIGATION.md](docs/NAVIGATION.md)). |
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
pnpm run test:ui-browser
pnpm run test:navigation-browser
pnpm run test:public-help-center-browser
pnpm run test:setup-browser
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
declared browser states; the three fresh composed-gate findings above remain
open. `test:usage` prepares generated migrations, then runs the two existing
usage tests.

`pnpm run verify` runs the operations descriptor, build, type check, module
suites, the emitted-Worker runtime and security-header suites, the first-release
journey (`pnpm run test:journey`) and the source integrity check. The browser
suites start their own isolated emitted Worker with local D1, R2 and Durable
Objects and write evidence to a temporary directory or `H2H_EVIDENCE_DIR`; the
resize suite also accepts `H2H_RUNTIME_PORT` and `H2H_RUNTIME_INSPECTOR_PORT` to
fix its server and inspector ports, and the contact-erasure suite accepts
`H2H_TEST_PORT` (its inspector uses the next port). The homepage and public-site checks run
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

- Accessibility is targeted at WCAG 2.2 AA. The bounded 19-state audit is not a
  complete conformance review; the c7 composed gate failed and awaits final
  adjudication against the corrected source. Hosted operating costs remain
  unmeasured; local scenarios preserve unknown usage and billing totals
  (`seed.json` and the composed-usage receipt).
- Some legacy dashboard features are not yet native; see
  [docs/UI-PARITY.md](docs/UI-PARITY.md).
- The separate portability candidate still has a resizable-`ArrayBuffer`
  fidelity failure and is not integrated or accepted for this RC. Durable
  Object storage is not part of a portable export; recovery relies on D1 and R2
  ([docs/INDEPENDENT-RELEASE.md](docs/INDEPENDENT-RELEASE.md)).
