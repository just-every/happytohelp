# HappyToHelp native acceptance

The useful outcome is the full native HappyToHelp product described in CONTRACT.md,
with the existing dashboard/widget and public content, durable conversations,
configured AI/knowledge/context, explicit local delegation, training/evaluation,
management/integrations and an owned operating/source workflow. The old small
RER delegation desk does not satisfy this acceptance.

Acceptance binds to the final exact source/build under test. The root acceptance
record owns the final verdict and must identify source revision, emitted bundle,
clean installation, browser/runtime evidence, excluded provider tests and material
remaining gaps. This document defines the gate; it does not declare that every
clause has passed.

## Required evidence

| Clauses | Required acceptance evidence |
| --- | --- |
| NATIVE-001, SOURCE-001 | Clean owner source release, locked install, operating describe/check, selected source locks, build/typecheck, generated migrations and local packaging dry run. Distinguish remotely provisioned resources from published code. |
| IDENTITY-001, UI-001 | Real native Worker/session and browser flows for setup/login, project selection, current membership, revoked/deleted denial, dashboard navigation and responsive widget; original content/control continuity. |
| CONVERSATION-001, DELIVERY-001 | Real D1/DO/R2 contention, duplicate/lost-response, reconnect/replay, attachments, new-message supersession and operator takeover; no incompatible final answers. |
| AI-001, CONTEXT-001 | Retained source regressions, configured execution graph, context/evidence/schema bounds, usage and uncertain-attempt behavior. Test fixtures and live provider execution reported separately. |
| KNOWLEDGE-001, PUBLIC-001 | Published corpus survives failed refresh, scoped retrieval/citations, article/category publication, original help URLs/search, original page/assets and referrer behavior, real waitlist write/denial and separate notification outcome. |
| DELEGATION-001, TRAINING-001 | Real persisted pairing/grant/work/run state, revocation, resolve/reply authority, recovery/cancellation, budget and ambiguous provider fences; separately packaged local connector. |
| INTEGRATION-001 | Provider-boundary fixtures for email/Stripe/GitHub/branding, idempotency and no ambiguous replay; real separate-origin preview/network denial. Live account/provider effects require their own evidence. |
| MIGRATION-001 | Explicit representative legacy IDs, permissions, exact amounts, content/media hashes and pending holds through real local D1/R2; deterministic resume, conflict refusal and no hidden provider work. |

`pnpm run verify` is the common verification command. The current package script,
`scripts/verify-modules.mjs`, `tests/runtime.mjs` and named module/browser suites
are executable evidence inventories; their presence alone is not a passing result.
Do not claim aggregate clause coverage from a smaller test count.

## Bounded public-source evidence from this port

- `tests/public-referrer.mjs`: 100 original PHP-source input/output cases plus
  message-priority and injection-safety checks passed against the native port.
- `tests/public-waitlist.mjs`: real local D1 validation, CSRF, duplicate admission,
  configured notification and uncertain no-replay passed with provider fixtures.
- `tests/public-help-center.mjs`: real local D1 canonical and `/help` aliases,
  Markdown/search, draft/tenant/deleted-project denial and alias auth passed.
- `tests/public-site-runtime.mjs`: the earlier integrated Worker returned all 16
  original pages and referenced assets successfully; its valid waitlist insert
  failed before migration 0095 was applied. That earlier failure is preserved,
  and the final emitted-build run must supersede it before full acceptance.

These are bounded local results, not hosted/provider/production-import acceptance.
Source asset rights need the review recorded in
`docs/PUBLIC-SOURCE-PROVENANCE.md`; removing identified Pro SVGs is not universal
redistribution clearance. Accessibility and operating costs remain unmeasured
unless an exact final evidence record establishes them.
