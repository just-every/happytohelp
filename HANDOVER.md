# Maintainer handover

This is the orientation for someone taking over HappyToHelp maintenance. Start
with [README.md](README.md) to install and run it, then read this page.

## What it is

HappyToHelp 0.2.0 is a native TypeScript rewrite of the original HappyToHelp
customer support application, which ran on PHP/Laravel and AWS. It keeps the
original React dashboard and Shadow DOM customer widget, the AI assistance
pipeline, knowledge ingestion, customer context and local-agent delegation, and
runs them on a single Cloudflare Worker. Pricing, billing, marketing, waitlist
and referrer features of the original service are deliberately not part of this
edition. [CONTRACT.md](CONTRACT.md) states the required behavior;
[ACCEPTANCE.md](ACCEPTANCE.md) states the evidence each requirement needs.

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

- Accessibility is targeted at WCAG 2.2 AA but has not been audited; operating
  costs and limits are unmeasured (`seed.json`).
- Some legacy dashboard features are not yet native; see
  [docs/UI-PARITY.md](docs/UI-PARITY.md).
- Durable Object storage is not part of a portable export; recovery relies on D1
  and R2 (see [docs/INDEPENDENT-RELEASE.md](docs/INDEPENDENT-RELEASE.md)).
