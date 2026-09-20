# HappyToHelp native edition handover

The edition now owns the native HappyToHelp owner workspace and its selected
source. The PHP application has been replaced by TanStack Start/React, Hono and
the RER Worker runtime. Existing dashboard, customer widget, prompts, evaluation
and local-agent source were retained or ported with their behavior and provenance
recorded. As of 17 September, the owner-approved public root is the designed
journey homepage with dynamic published help centers. Its selected art is the
sculpted beacon hero loop, horse-and-spear rider, crossing/lookout/helping-hand/
well sculptures, journey map backgrounds and official/app brand icons. Pricing,
legal, waitlist, referrer and public auto-widget behavior remain outside the
active edition. The earlier 15 September simple-landing description is historical.

## Current launch status — 20 September 2026

The core standalone replacement is recorded as qualified on the exact native
source commit `f09c68194ce8212a122a44433cdcd69a4d93d8df`, with 34 migrations and
the deployed artifact and Worker recorded in
`/Users/zemaj/.orchestrator/evidence/happytohelp/launch-20260920-v3/launch-status.json`.
The public `help.justevery.com` root and `/health` endpoint are live and readable,
and the source release is public at
`https://github.com/runeditrun/support-happytohelp`. The later native GitHub
adapter repair in the current source working line remains under qualification
against the deployed artifact. RER Assisted and Managed paid workflows remain
separate launch gates; the current evidence and open gates are listed in
`reports/happytohelp-launch-plan-2026-09-20.md`. The dated preparation sections
below retain their historical evidence boundaries.

## 20 September launch-preparation checkpoint

The owner selected HappyToHelp as the first launch lane. The current native
source now has an acyclic edition graph: AI lifecycle and required effects,
training, customer-context and local-delegation adapters are edition-owned;
failed model attempts record their generation state. Widget collection cleanup
and typed event dispatch are in place. Inbound email has caught local retry
failures and exposes explicit administrator reconciliation with claim tokens
(`migrations/0100_inbound_email_claims.sql`).

Base and HappyToHelp share the private installer state implementation byte for
byte, with 17 shared onboarding tests and 17 private-state tests passing in each
tree. The standalone installer and deployment
path now derives the full queue topology and performs custom-zone preflight
before remote mutations. The managed service retains a 34-migration
HappyToHelp plan with shared mail environment inputs and artifact qualification
checks. User homepage and service scene edits that
predated this checkpoint remain preserved.

The latest exact verification record is
`/Users/zemaj/.orchestrator/evidence/happytohelp/launch-20260920`:
service build, typecheck, 623 tests and runtime checks pass, and the prebuilt
native runtime passes after the IPv6 authority and current homepage assertions
were repaired. Provider checks use local fixtures. The production service pin
`446c1ce` is unchanged. Clean installation and aggregate results are recorded
there separately; this checkpoint itself does not qualify hosted/provider/public
execution or declare a complete launch.

## 17 September homepage integration — local verification

The approved journey homepage is now the native React/TanStack root route, with
scoped editable section components and all 15 selected assets preserved byte for
byte. The retired raw owner landing, CSS and purple illustration were removed.
Setup, login, workspace and published help-center routes remain available.
The headline uses container-relative sizing, retains its still during interrupted
video playback, and resumes expected motion on return. Reduced motion is respected.

Build, typecheck, emitted Worker runtime, setup browser and navigation browser
checks passed. Focused homepage checks passed at five widths from 390 to 2560px:
two mask lines, no horizontal overflow, advancing video, pause/resume and reduced
motion. Root reviewed every section in the existing in-app browser and observed a
real Vite stylesheet hot update without refreshing. Local app: http://localhost:5174/.
Evidence: `/Users/zemaj/.orchestrator/evidence/runeditrun/happytohelp-native-homepage-20260917/README.md`.

This is local integration evidence, not deployment or source-release acceptance.
The 18 September commit checkpoint stages the replacement assets and retired-file
deletions together and refreshes the source lock through the authoring CLI. Checks ran on Node 26.0.0 with the recorded
>=26.8.1 engine warning; no hosted/provider acceptance is claimed.

`docs/MODULES.md` identifies conversation, widget, AI support, knowledge, customer
context, local computer, training, plugin SDK and site preview capabilities.
They are editable source with explicit integration contracts. Neutral entry points
can be selected independently; full HappyToHelp route adapters carry the actual
edition dependencies. `docs/SECOND-CONSUMER-PROOF.json` records an isolated Beacon
adoption without changing canonical Beacon.

The 15 September [UI restoration record](docs/UI-PARITY.md) covers comparison
against a running original Laravel instance, the restored workspace/forms and
remaining legacy differences. Desktop/mobile screenshots and real save/reload
checks accompany this pass; it does not claim full legacy feature equality. Its
public marketing and billing observations are historical comparison evidence,
not active scope.
The native route and shell contract is recorded in
[`docs/NAVIGATION.md`](docs/NAVIGATION.md), including the focused browser check.

## Source and review state

All selected components are edition-local, including `src/base` and
`scripts/edition-authoring`. Base and original HappyToHelp repositories are
comparison/porting origins, not sibling runtime dependencies. See
[AUTHORING.md](docs/AUTHORING.md) for source updates and portable releases.

The clean-release migration acceptance applies to `510f62d`; the subsequent
UI restoration (`0cc5dab`) and navigation (`a97a500`) have their own linked
records above. Do not apply the earlier aggregate counts to later source.
Owner review and any new consolidated verification should identify their exact
source revision and evidence separately.
The 15 September consolidated local review is indexed at
`/Users/zemaj/.orchestrator/evidence/runeditrun/happytohelp-local-review-20260915/FINAL-REVIEW.md`.

## Run and verify

Use Node 26.8.1 and pnpm 10.12.4. Run `node scripts/operations.mjs describe` before
installation, then `pnpm install --frozen-lockfile`, `pnpm run setup -- --local`
and `pnpm run dev`. Open `/setup` to create the first owner with an email and password. Subsequent access uses `/login`.

For this trusted local review, automatic access to the single existing owner is
opted in with `H2H_LOCAL_OWNER_LOGIN=1 pnpm run dev --port 5174 --strictPort`.
Open `http://localhost:5174/projects`; login issues a normal local owner session
without changing the password. Vite is loopback-only and remote bindings are
turned off. The endpoint is absent from emitted production builds. Restart
without the flag for normal login/logout testing. See OPERATIONS.md and the local
evidence at `/Users/zemaj/.orchestrator/evidence/runeditrun/happytohelp-local-owner-login-20260917/`.


`pnpm run verify` checks operations, build, types, module tests, a fresh emitted
Worker and source integrity. The final verification must cover the approved
journey homepage and dynamic help-center checks; the retained customer-widget
browser checks remain a separate product surface and evidence lane.
After `pnpm exec playwright install chromium`, run `pnpm run test:setup-browser`,
`pnpm run test:ui-browser` and `pnpm run test:widget-browser`.
Run `pnpm run test:navigation-browser` for the native shell, loader, project
provider and dirty-navigation coverage; it starts its own isolated emitted
Worker runtime.
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

## Migration and external operation — historical migration checkpoint

`scripts/import-legacy.mjs` plans and applies an explicit local export with
resumable row and object custody. Read the importer README before running it.
Tests preserve original IDs, blocked contacts, AI versus human assignments,
publication privacy, object hashes and historical financial values. Historical
financial SQL and imported financial rows remain immutable custody only; removing
active payment, Stripe and balance behavior does not permit deleting that prior-
data evidence.
All input rows are archived; unsupported encrypted or provider-only data remains
explicitly archive-only until supplied in the documented normalized form.
This is a tested migration mechanism, not a claim that production data was moved.

Original HappyToHelp repositories remain unchanged. The native commit retains
the earlier RER desk's Git ancestry; that historical implementation can be read
in Git and is no longer an alternative runtime in this edition.

At the migration checkpoint represented by this section, provider setup, real
email/model acceptance, deployments, production-data imports and public
publication had not been performed. Current hosted and public evidence is in
the launch-status section above and the launch plan; this historical paragraph
must not be read as the current deployment state. Missing configured providers
return an explicit unavailable state. Unknown provider outcomes retain their
historical receipts and do not automatically replay provider work. The active
source and asset attribution boundary is recorded in
`docs/SOURCE-PROVENANCE.md` and `docs/PUBLIC-SOURCE-PROVENANCE.md`.

## 17 September fictional demo inbox onboarding

Owners of an empty project can choose **Try a demo inbox** in the main empty
panel (or the list on mobile). Creation writes a separate, labelled Northstar
Outfitters demo project and six fictional persisted ten-message support transcripts. The same action
safely extends untouched older demo transcripts, preserving edited or replied-to
conversations. An editable assistant and three published fictional FAQ documents
make normal configured-provider reply suggestions available for review. Normal
inbox reads, assignments, counts, replies and deletion apply. Creation schedules
no AI, delivery, email or other provider work. Repeated requests preserve edits;
concurrent requests create one complete inbox per owner. Deleting it retains
history and a later explicit request creates a new demo generation.

Local build/typecheck, `node tests/demo-inbox.mjs` and
`pnpm run test:demo-inbox-browser` passed. D1 evidence covers role boundaries,
tenant separation, atomic rollback, concurrent idempotence, actual transcript
revisions/counts, edit preservation, deletion/recreation and absence of queued
side effects. The isolated emitted-Worker browser check covers setup, desktop
and mobile invitation, project switch, real list/detail and reload, repeat reuse
and the unchanged original inbox. Screenshots/results:
`/Users/zemaj/.orchestrator/evidence/runeditrun/happytohelp-demo-inbox-20260917`.
This is local verification, not deployment or provider acceptance.

The richer demo revision adds Leah's group-hike planning and Owen's damaged-strap
follow-up as separate 16-message histories, preserving existing conversations and
Maya's real generated suggestion. They exercise consecutive message runs, grouped
page visits, internal notes, human assignment and two-day gaps between buckets.
Tracked events now reach the native transcript through explicit conversation,
contact, project and bucket scope; normal widget event ingestion supplies trusted
conversation attribution. Historical unscoped telemetry is not guessed into chats.

The richer pass also fixed a development-only bucket ordering bug: React Strict
Mode called a state updater twice while it mutated the fetched array with
`reverse()`. It now reverses a copy. Public widget telemetry accepts only page
visits; trusted conversation/bucket scope is applied before identity hashing.
Assignment and insight display events cannot be supplied by public telemetry.
Real D1 spoofing, replay, cross-conversation identity and newly opened bucket tests
passed, alongside the richer browser flow and management regressions.

## 17 September real scenic first-run setup

The approved Ocean Cliffs layout now lives in the native `/setup` route. Three
steps gather owner identity, workspace/widget origin and brand colour, then review
before the existing guarded atomic bootstrap. Known details sit within the left
panel. Passwords and installation tokens are never stored in resumable tab drafts.
`scripts/setup-link.mjs` provides an availability-checked nonsecret agent handoff;
`docs/SETUP-WORKFLOW.md` describes the limits and existing provisioning path.
The selected coast image is copied from the approved 12ui conversion into
`public/setup/ocean.png`; the editable interface is split under `src/ui/native/setup`.

Build, typecheck, isolated D1 identity setup and emitted-Worker setup browser tests
passed. The browser verifies prefill removal/resume, password validation, actual
owner/session creation, widget preview, reload, later login and closed first-run
setup. Existing installations are untouched; no remote provisioning, provider
connection, email invitation, deployment or source release was performed.

## Standalone installer correction

The first-run app page above is a protected fallback, not the install entry point.
`node scripts/install.mjs` now serves an independent Node-built-in installer before
node_modules or the app runtime exists. It orchestrates locked installation,
existing local/remote setup commands, app readiness and guarded owner creation.
See docs/INSTALLER.md for explicit effects, provider/email boundaries and recovery.
A real clean-copy local test proves the no-dependencies UI, dependency installation,
migrations, nonce-identified runtime and owner creation; remote effects were not run.
The scenic interface now keeps editable known details in the left panel and asks only for missing inputs or unresolved required connections. There is one approval action, no forced walkthrough of known answers. Email configuration or explicit deferral remains a required decision. Provider device-code handling is covered by a child-process fixture; no real authentication or remote effects were run.

## 18 September launch continuation checkpoint

This checkpoint collects the journey homepage, standalone installer, shared Base
onboarding adoption, Cloudflare email adapter, demo inbox/transcript and editor
improvements, scenic setup, and authenticated workspace artwork into committed
edition source. The source lock is refreshed with the actual authoring CLI after
staging the replacement homepage and its deletions. Shared onboarding retains
Base comparison commit `5e8146003eba71d862c1856165fa7cf16724b71c`; its copied source
was checked byte-for-byte. Unused artwork explorations and their provenance are
retained in `evidence/setup-artwork-exploration/`, outside public assets.

Fresh local checks passed: operating description, build, TypeScript, emitted Worker
with 32 isolated migrations, setup browser, demo-inbox browser, AI-instruction
keyboard checks, 10 shared onboarding tests and three focused installer
security/artwork suites. The identity harness now creates an isolated Wrangler
configuration so local installation settings cannot change its bootstrap contract.
The full module suite passed 143 tests, with the live-provider test explicitly
skipped (144 total). The earlier real
clean-copy installer and sign-in evidence remains separate; this checkpoint does
not repeat remote installation or establish live email/model acceptance.

Next launch work remains hosted/provider qualification, public asset rights review
and exact-release acceptance against the intended deployment target. No push,
deployment, production-data import or portable source release is performed by this
checkpoint. Checks use Node 26.0.0; the declared minimum remains 26.8.1.

Migrations 0098/0099 retain previously applied personal-artwork columns as history;
the current workspace artwork lives in `project_settings` and is shared with
authorized workspace members. Installer artwork requires an alpha-channel PNG;
the general authenticated artwork API accepts PNG images. Shared installer private
files are created with mode 0600; tightening permissions on pre-existing local
credential files remains an operating hardening follow-up.
