# HappyToHelp acceptance

The useful outcome is the HappyToHelp owner workspace described in
[CONTRACT.md](CONTRACT.md): durable conversations, the operator dashboard and
customer widget, configured AI/knowledge/context, explicit local delegation,
training/evaluation, management/integrations and an owned operating/source
workflow. The public surface is the “Customer Support, Solved.” homepage plus
dynamic published help centers. Pricing, legal, waitlist, referrer and public auto-widget behavior are
outside this edition's scope.

The homepage evidence (`tests/homepage-browser.mjs`, `tests/public-site-runtime.mjs`,
`tests/homepage-source.mjs`) must cover the exact “Customer Support, Solved.”
headline and the 14-word subhead, the six sections in order (hero, Not just
better. Free., Help before they ask, The rest of your support desk, Try it beside
what you have, Ready when you are.), the one-column hero drawing of a conversation
the connected Codex or Claude has already fixed (Maya's message, Codex's note, the
reply in the composer ready for Send, three numbered callouts and the caption
steps, six strings and at least 15px at 1440), the MIT licence, offer, product and
import drawings, the absence of any price, hosting, provider or Run Edit Run text,
the labelled drawings built from real text, the single self-hosted Outfit typeface
with no third-party request, the monochrome page chrome
with colour only inside the drawings, repository-derived navigation destinations,
layout without horizontal overflow from 320px to 1920px, and reduced-motion
behavior (owner approval 2026-10-01).

Acceptance binds to an exact source revision and build. An acceptance record
must identify the source revision, emitted bundle, clean installation,
browser/runtime evidence, excluded provider tests and material remaining gaps.
This document defines the gate; it does not declare that every clause has passed.

## Qualification boundary

The current inventory is 108 tables and 41 migrations; version 0.2.1 has 97 tables
and 37 migrations. Every revision needs its own exact inventory and recovery
proof. The current independent-runtime gate requires 108 tables plus the named
inventory. The genuine upgrade test checks the append-only migration ledger,
original row values and explicit secret/citation backfills; local D1 timing
metadata is not spend-row content.

Full verification, browser, upgrade and recovery results must be reported for
the exact candidate. Historical focused results do not qualify a new revision.
The timed activation recording remains missing, and hosted or live-provider
acceptance requires separately recorded evidence.

The accessibility checker verdict remains **FAIL / confirmed owner HOLD**.
The earlier bounded 21-state run with zero Axe violations does not clear its
independently reproduced false accepts or establish WCAG conformance. The
[maintainer handover](HANDOVER.md) preserves this limitation and the outstanding
portable-storage fidelity obligation.

## Required evidence

| Clauses | Required acceptance evidence |
| --- | --- |
| NATIVE-001, SOURCE-001 | Clean owner source release, locked install, operating describe/check, selected source locks, build/typecheck, generated migrations and local packaging dry run. Distinct public archive projections pass offline extraction/comparison checks; separately run the digest-pinned original/projected equivalence command in `scripts/source-projection/README.md`. Distinguish remotely provisioned resources from published code. |
| IDENTITY-001, UI-001 | Real native Worker/session and browser flows for setup/login, project selection, current membership, revoked/deleted denial, approved “Customer Support, Solved.” homepage, dashboard navigation and responsive customer widget. The public identity pages (login, sign-up, recovery, verification, invitation, completed setup) and pending-invitation revoke/resend/copy-link, with role refusals, are covered by `pnpm run test:identity-browser`, `tests/identity-links.mjs` and `tests/management-invitations.mjs`. Public request limits refuse over-limit visitor, registration and project-creation requests with 429 and `Retry-After` (`tests/abuse-limits.mjs`, `tests/abuse-limits-runtime.mjs`, `tests/widget-rate-limit.mjs`). |
| CONVERSATION-001, DELIVERY-001 | Real D1/DO/R2 contention, duplicate/lost-response, reconnect/replay, attachments, new-message supersession and operator takeover; no incompatible final answers Owner/admin contact erasure removes the contact's personal data from real local D1/R2 and keeps a coherent transcript (`tests/contact-erasure.mjs`, `pnpm run test:contact-erasure-browser`); [docs/PRIVACY.md](docs/PRIVACY.md) lists what is stored, sent and erased. |
| AI-001, CONTEXT-001 | Retained source regressions, configured execution graph, context/evidence/schema bounds, raw per-round provider usage, bounded budgets, daily AI ceilings (skipped replies recorded, never replayed) and uncertain-attempt behavior. Test fixtures and live provider execution reported separately. |
| KNOWLEDGE-001, PUBLIC-001 | Published corpus survives failed refresh, scoped retrieval/citations, article/category publication, dynamic help URLs/search and approved “Customer Support, Solved.” homepage behavior, including its drawings and typeface. Customer widget remains a separately installed product surface; pricing, legal, waitlist, referrer and public auto-widget behavior are not active acceptance. |
| DELEGATION-001, TRAINING-001 | Real persisted pairing/grant/work/run state, revocation, resolve/reply authority, recovery/cancellation, budget and ambiguous provider fences; separately packaged local connector. |
| INTEGRATION-001 | Provider-boundary fixtures for email/GitHub/branding and knowledge imports, idempotency and no ambiguous replay; real separate-origin preview/network denial. Live account/provider effects require their own evidence. |
| MIGRATION-001 | Explicit representative legacy IDs, permissions, exact historical financial values, content/media hashes and pending holds through real local D1/R2; deterministic resume, conflict refusal and no hidden provider work. Historical financial SQL/imported records remain immutable custody and do not activate payment or balance behavior, except that an explicit owner/admin contact erasure redacts that contact's imported personal data and archive copies and leaves a `contact_erasures` tombstone (`tests/contact-erasure.mjs`). |

`pnpm run verify` is the common verification command. It includes the
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
above. Operating costs remain unmeasured unless an exact evidence record establishes them.
