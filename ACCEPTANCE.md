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

## Current qualification status

The local merged baseline is `a78076a822e01af7727d1deaa2dbf0c5dad6f73e`. Its schema is 104 tables and 39 migrations. The historical launch baseline `09d80a7` is 104/38; public v0.2.1 `59c6e2e` is 97/37. The original 97-table assertion stays unchanged, and each schema needs its own exact-revision recovery evidence.

On the merged baseline, the recorded focused run passed 21 checks; the operations descriptor and source check also reported success. Full `pnpm run verify`, every browser suite, the recovery comparison and fresh 1440/390 captures remain pending. Public release, deployment, live-provider proof and production acceptance are not established.

The retained accessibility checker verdict is **FAIL / confirmed owner HOLD**. The earlier bounded 21-state run with zero Axe violations does not clear the independently reproduced false accepts or establish WCAG conformance; see [HANDOVER.md](HANDOVER.md) for its exact source and limitations.

## Required evidence

| Clauses | Required acceptance evidence |
| --- | --- |
| NATIVE-001, SOURCE-001 | Clean owner source release, locked install, operating describe/check, selected source locks, build/typecheck, generated migrations and local packaging dry run. Distinguish remotely provisioned resources from published code. |
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
