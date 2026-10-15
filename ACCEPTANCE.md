# HappyToHelp acceptance

The useful outcome is a support desk that handles real customer work: a customer
opens the widget and sends a message or attachment; the team sees it in the shared
inbox, replies and sees the reply reach the widget. Customers who enter an email
can also receive replies by email. Operators can insert saved replies, publish
knowledge in a help center and use Reports to understand response times,
resolutions and customer feedback. These jobs, together with configured AI and
customer context, explicit local delegation, training/evaluation,
management/integrations and an owned operating/source workflow, are governed by
[CONTRACT.md](CONTRACT.md). The public surface is the “Customer Support, Solved.”
homepage, the documentation at `/docs` built from the repository's Markdown, and dynamic
published help centers. Pricing, legal, waitlist, referrer and public auto-widget behavior are
outside this edition's scope.

The homepage evidence (`tests/homepage-browser.mjs`, `tests/public-site-runtime.mjs`,
`tests/homepage-source.mjs`) must cover the exact “Customer Support, Solved.”
headline and the 14-word subhead, the six sections in order (hero, Not just
better. Free., Help before they ask, The rest of your support desk, Try it beside
what you have, Ready when you are.), the hero drawing of a conversation the
connected Codex or Claude has already fixed (three staggered bubbles on a pale aqua
blob: Maya's message, the untitled fix beside a code glyph, the reply with Send inside
it beside a person glyph, ink arrows landing on the bubbles they point at, five strings
and at least 15px at 1440), the aqua number discs of the caption steps, the hero
flourish that draws in once and stands drawn under reduced motion, the MIT licence, offer, product and
import drawings in the hero's language (pale aqua blobs, the mark's sparks, frames kept only for the code
editor, checkout and import, filled aqua number discs, the promises' icon circles, aqua link underlines, two
full-width dividers, the closing headline's aqua line and the footer lockup), each moment below the hero playing
once on scroll within 1.8s with no layout shift and resting in the reduced-motion final state, the absence of any price, hosting, provider or Run Edit Run text,
the labelled drawings built from real text, the single self-hosted Outfit typeface
with no third-party request, the monochrome page chrome
with colour only inside the drawings, in aqua accents (the hero's and those below it) and in the sparks of the header and footer mark, repository-derived navigation destinations,
layout without horizontal overflow from 320px to 1920px, and reduced-motion
behavior (owner approval 2026-10-01).

The documentation evidence (`tests/docs-site.mjs`, `tests/docs-dev-sync.mjs`,
`pnpm run test:docs-browser`, and the `/docs` assertions in
`tests/public-site-runtime.mjs`, `tests/security-headers-runtime.mjs` and
`tests/not-found-browser.mjs`) must cover: `docs/site.json` listing the 12
published pages in 3 sections and 17 GitHub-only files, with every Markdown file
at the root, under `docs/` or as a top-level README listed one way or the other
(an unlisted file fails verification); every relative link and anchor resolving to
a `/docs` page or a GitHub path, with a broken one failing the build and, in the
dev server, the docs pages alone with its message; the dev server serving an edited
file, a broken link's error, a new manifest page and the loss of a page removed with
its folder without a restart, through the docs routes' own loader, and removing any
folder without an error; each page's h1 and h2 sequence matching its
Markdown in the emitted build; `/docs` and every `/docs/<slug>` answering 200,
`/docs/` ending on the docs home, and unknown or miscased slugs and deeper paths
answering the branded 404; `docs` reserved from help-center aliases without a D1
lookup, with `/help/docs` still served; the application security headers on the
pages and their 404; GitHub-compatible heading ids, labelled focusable table
regions, class-only highlighting on light drawn cards, escaped raw HTML and no
inline style or handler; no page body in the client entry and at most 160 KB for
`/docs/operations`; no new dependency; the homepage `SiteHeader` (lockup on one
line, Docs current with the deep-aqua underline) and `SiteFooter`; the sidebar
from 861px, the phone menu below, the contents column from 1200px and the compact
contents below; a 55 to 80 character measure; Outfit for text, a monospace stack
for code and 17px prose; aqua only on the current item and the underlines; no
horizontal overflow from 375px to 1920px; previous and next in manifest order and
an edit link to the page's source; axe-clean pages at 375px and 1440px; the skip
link, phone menu, focus rings and contents links by keyboard; one banner, one
visible Documentation navigation, `main`, the footer and one h1; and the homepage
Docs, Read the docs and Read the installation guide links opening these pages.

Acceptance binds to an exact source revision and build. An acceptance record
must identify the source revision, emitted bundle, clean installation,
browser/runtime evidence, excluded provider tests and material remaining gaps.
This document defines the gate; it does not declare that every clause has passed.

## Qualification boundary

The private release line is untagged source. A source lock, build, fixture,
local browser result or publication never qualifies a different revision or a
hosted installation. Keep exact-head commands and results outside product source.
No compliance or FedRAMP qualification is claimed. Preserve native password
identity and prior owner data under the recorded 8 October decision.

## Required evidence

| Clauses | Required acceptance evidence |
| --- | --- |
| MOVE-IN-001 | Current-role/tenant denied uploads, private source/plan/reports, all five kinds, malformed/unsupported source reasons, conflict refusal, inert apply/resume/repeat/undo, immutable original-byte custody, native tags, actual 1,000-conversation Worker/D1/R2 and browser journeys. Exact business-state repeat/undo equality excludes only named platform counters/sequences, audit and import journals; synthetic documented-format fixtures qualify this local flow. |
| CONNECTIONS-001 | Seven scoped show-once/hash/expiry/revoke/audit workspace grants; all thirteen Bearer operations with native/tenant/erasure fences; four signed events, safe logs, SSRF and explicit tests; recorded Slack incoming-webhook and bot modes; ordinary HTTPS fetch with redirect refusal, timeout, request/response bounds, uncertain HTTP 500 without replay and bounded 429 retry. |
| FIRST-RUN-001, LOCAL-MAIL-001 | Exact-source pnpm exec rer setup/dev/outbox flows from the one-screen first run (email, password, website, and the setup token only where required) to the Setup page: derived workspace name and colour, one welcome email to the owner that is captured locally and never called delivery, the provisioned starter assistant, mailbox and installation sender, password/snippet/Advanced/header/name/mobile flows and restartable local capture; with no provider key a visitor message stays with the team and no generation fails, and with a key the starter answers within the daily ceilings (`tests/first-release-journey.mjs`, `tests/provisioning.mjs`, `tests/identity-setup.mjs`); forged-request/production refusal before D1 and no remote-failure fallback. Native first-run checks remain in test:first-run. |
| ACTIVATION-001 | `GET` performs no provider request and writes nothing; a fresh workspace has no confirmed step; the page's own checks run under the owner's session, observe within freshness windows, never send mail and never request generation; an owner or admin can skip the widget, AI service or sending-domain step for now and undo it, durably per workspace on the server, a skipped step leaves the count and is never shown as confirmed while an observed step still counts and a rejected key stays under Needs you, and the help-article step is hidden and never counts (`tests/activation-routes.mjs` skip test, `tests/first-run/setup-browser.mjs` skip flow); a used emailed sign-in link, or a provider-reported welcome or test email, confirms owner mail while local capture, a preset and provider acceptance never do; uncertain sends are never replayed; unsupported status APIs stay unavailable; keys and fingerprints never leave the server (`tests/activation-routes.mjs`, `tests/activation-provider-probes.mjs`, `tests/activation-migration.mjs`). |
| NATIVE-001, SOURCE-001 | Clean owner source release, locked install, pnpm exec rer describe/check, selected source locks, build/typecheck, generated migrations and local packaging dry run. Distinguish remotely provisioned resources from published code. |
| IDENTITY-001, IDENTITY-002, UI-001 | Real native Worker/session and browser flows for setup/login, project selection, current membership, revoked/deleted denial, approved “Customer Support, Solved.” homepage, dashboard navigation and responsive customer widget. The public identity pages (login, sign-up, recovery, verification, invitation, completed setup) and pending-invitation revoke/resend/copy-link, with role refusals, are covered by `pnpm run test:identity-browser`, `tests/identity-links.mjs` and `tests/management-invitations.mjs`. Public request limits refuse over-limit visitor, registration and project-creation requests with 429 and `Retry-After` (`tests/abuse-limits.mjs`, `tests/abuse-limits-runtime.mjs`, `tests/widget-rate-limit.mjs`). |
| CONVERSATION-001, DELIVERY-001 | Real D1/DO/R2 contention, duplicate/lost-response, reconnect/replay, attachments, new-message supersession and operator takeover; no incompatible final answers Owner/admin contact erasure removes the contact's personal data from real local D1/R2 and keeps a coherent transcript (`tests/contact-erasure.mjs`, `pnpm run test:contact-erasure-browser`); [docs/PRIVACY.md](docs/PRIVACY.md) lists what is stored, sent and erased. |
| OUTCOMES-001, REPORTS-001 | `pnpm run test:reports`: native current-session/cycle/rating authority, rerating and erasure, validated draft provenance and mixed outcomes, atomic resolve/reopen races, handwritten report and DST/tenant/CSV oracles above 10,000 rows, actual prior-ledger upgrade, 1440/390 widget/operator/Reports browser journeys with axe and reloads, and additive M9 emitted-artifact D1/R2 recovery. These are required checks, not an acceptance claim. |
| AI-001, CONTEXT-001 | Retained source regressions, configured execution graph, context/evidence/schema bounds, raw per-round provider usage, bounded budgets, daily AI ceilings (skipped replies recorded, never replayed) and uncertain-attempt behavior. Test fixtures and live provider execution reported separately. |
| KNOWLEDGE-001, PUBLIC-001 | Published corpus survives failed refresh, scoped retrieval/citations, article/category publication, dynamic help URLs/search and approved “Customer Support, Solved.” homepage behavior, including its drawings and typeface, and the `/docs` documentation built from repository Markdown. Customer widget remains a separately installed product surface; pricing, legal, waitlist, referrer and public auto-widget behavior are not active acceptance. |
| DELEGATION-001, TRAINING-001 | Real persisted pairing/grant/work/run state, revocation, resolve/reply authority, recovery/cancellation, budget and ambiguous provider fences; separately packaged local connector. Required check: `tests/delegation-journey.mjs` and its `--browser` mode exercise the seven-step fixture case, a distinct read-only observation after the approved child fix, human Send with exact-request replay, and stale/revoked/offline/unverified/uncertain-delivery refusals. Browser mode uses fresh installed rer setup/dev and ordinary outbox sign-in at 1440 and 390. The provider is scripted and customer-system changes affect a loopback fixture only; this is a required check, not qualification or a live-provider acceptance claim. |
| INTEGRATION-001 | Provider-boundary fixtures for email/GitHub/branding and knowledge imports, idempotency and no ambiguous replay; real separate-origin preview/network denial. A widget visitor's entered email receives an operator reply even with an online widget and an unverified identity, without requiring an inbound token or mailbox. The reply shows **Sent to email provider** only on provider acceptance, distinct from confirmed delivery; local capture is labelled and never claimed as external mail. Provider failure and uncertain outcomes remain visible without automatic replay. A generated inbound token is deployed but receiving mail still requires the provider's domain routing and webhook. Live account/provider effects require their own evidence. |
| MIGRATION-001 | Explicit representative legacy IDs, permissions, exact historical financial values, content/media hashes and pending holds through real local D1/R2; deterministic resume, conflict refusal and no hidden provider work. Historical financial SQL/imported records remain immutable custody and do not activate payment or balance behavior, except that an explicit owner/admin contact erasure redacts that contact's imported personal data and archive copies and leaves a `contact_erasures` tombstone (`tests/contact-erasure.mjs`). |

`pnpm exec rer verify` is the common verification command. It includes the
first-release journey (`pnpm run test:journey`): health, owner setup and login,
tenant isolation, a widget conversation with an attachment, operator handling
with a stale-frontier 409, refusal of AI work with no provider configured,
WebSocket replay and resume, session revocation and the project deletion
boundary, all against a local emitted Worker. The package scripts,
`scripts/verify-modules.mjs`, `tests/runtime.mjs` and the named module/browser
suites are executable evidence inventories; their presence alone is not a passing
result. Do not claim aggregate clause coverage from a smaller test count.

Local results are not hosted, live-provider or production-import acceptance.
Accessibility is targeted at WCAG 2.2 AA but remains on the confirmed checker HOLD
in [Acceptance holds](#acceptance-holds). Operating costs remain unmeasured unless an exact evidence record establishes them.

## Command journeys

`tests/rer-journey.mjs` drives a fresh clone through the installed pinned `@runeditrun/rer` launcher: structural
check, `rer install` with frozen dependencies, manifest setup and teardown, foreground
dev with `RER_READY` and an app origin, an explicit local sign-in request through
`/login/magic` for the local owner, then ordinary one-use confirmation through the
newest sign-in email at that origin plus `/__dev/outbox`, owner/data/private-settings retention,
active/unconfirmed reset refusal, private export/import, confirmed reset and
fresh setup. It replaces the standalone installer qualification. Native auth,
tenant, secrets, destructive operations and restore require actual runtime proof.
A hosted first claim derives the owner's name from the actual configured owner
email and lands email sign-in on Setup. A `workers.dev` website defaults to
**My workspace** regardless of the owner email; an explicitly chosen native
workspace name takes precedence. An infrastructure hostname never becomes the
business name. A real separate-origin widget page and the app origin must both work after
saving the website origin. Normal deployment removal must remove an installation
with an uploaded attachment in one pass through rer, with absence readback; manual
bucket emptying is not the person-facing removal path.

## Acceptance holds

Accessibility is **FAIL / confirmed owner HOLD**; keep the bounded checker
limitations in [the accessibility audit](docs/ACCESSIBILITY-AUDIT-2026-09-30.md).
Timed activation and paid-provider execution remain unqualified. D1/R2 archives
omit Durable Object storage; full portable-storage fidelity remains held.
[HANDOVER.md](HANDOVER.md#acceptance-boundaries) records those obligations and the
owner's import equality, native-auth and bounded-HTTPS decisions.
