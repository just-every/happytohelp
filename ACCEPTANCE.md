# HappyToHelp acceptance

The useful outcome is the HappyToHelp owner workspace described in
[CONTRACT.md](CONTRACT.md): durable conversations, the operator dashboard and
customer widget, configured AI/knowledge/context, explicit local delegation,
training/evaluation, management/integrations and an owned operating/source
workflow. The public surface is the “Customer Support, Solved.” homepage, the
documentation at `/docs` built from the repository's Markdown, and dynamic
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

The current inventory is 109 tables and 42 migrations; migration 0109 adds
`magic_signins` and its expiry index. Version 0.2.1 has 97 tables
and 37 migrations. Every revision needs its own exact inventory and recovery
proof. The current independent-runtime gate requires 109 tables plus the named
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
| NATIVE-001, SOURCE-001 | Clean owner source release, locked install, operating describe/check, selected source locks, build/typecheck, generated migrations and local packaging dry run. Distinguish remotely provisioned resources from published code. |
| IDENTITY-001, UI-001 | Real native Worker/session and browser flows for setup/login, project selection, current membership, revoked/deleted denial, approved “Customer Support, Solved.” homepage, dashboard navigation and responsive customer widget. The public identity pages (login, sign-up, recovery, verification, invitation, completed setup) and pending-invitation revoke/resend/copy-link, with role refusals, are covered by `pnpm run test:identity-browser`, `tests/identity-links.mjs` and `tests/management-invitations.mjs`. Public request limits refuse over-limit visitor, registration and project-creation requests with 429 and `Retry-After` (`tests/abuse-limits.mjs`, `tests/abuse-limits-runtime.mjs`, `tests/widget-rate-limit.mjs`). |
| CONVERSATION-001, DELIVERY-001 | Real D1/DO/R2 contention, duplicate/lost-response, reconnect/replay, attachments, new-message supersession and operator takeover; no incompatible final answers Owner/admin contact erasure removes the contact's personal data from real local D1/R2 and keeps a coherent transcript (`tests/contact-erasure.mjs`, `pnpm run test:contact-erasure-browser`); [docs/PRIVACY.md](docs/PRIVACY.md) lists what is stored, sent and erased. |
| AI-001, CONTEXT-001 | Retained source regressions, configured execution graph, context/evidence/schema bounds, raw per-round provider usage, bounded budgets, daily AI ceilings (skipped replies recorded, never replayed) and uncertain-attempt behavior. Test fixtures and live provider execution reported separately. |
| KNOWLEDGE-001, PUBLIC-001 | Published corpus survives failed refresh, scoped retrieval/citations, article/category publication, dynamic help URLs/search and approved “Customer Support, Solved.” homepage behavior, including its drawings and typeface, and the `/docs` documentation built from repository Markdown. Customer widget remains a separately installed product surface; pricing, legal, waitlist, referrer and public auto-widget behavior are not active acceptance. |
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

## 0.3.0 focused release gates

- `pnpm run test:hero-connector-browser`: 1440×900 and 390×844, actual device pairing
  and `local-agent/bin/h2h-local.mjs`, test-only Codex app-server boundary, native
  article publication before/after, resolve without automatic send, operator Use
  and Send, visitor socket and reload sharing one stable message ID.
- `pnpm run test:appearance-browser`: saved/reloaded/removal/default appearance,
  preview parity, current tenant scope, published/canonical/draft/deleted routes,
  and rendered empty/loading/error/offline/recovery states on widget and Help Center.
  Each captured state has an unrestricted axe run requiring zero serious/critical
  violations. This is a bounded regression gate, not a complete WCAG claim.
- `pnpm run test:magic-link-browser` and `node --test tests/magic-link.mjs`: native
  request/explicit browser sign-in plus SendGrid boundary, timing-neutral admission,
  rate limits, atomic replay denial, expiry/current membership/email/deletion,
  session flags, account-only behavior and safe return paths.
- `pnpm run test:delivery-base`: current emitted tree against the preserved
  test-only old producer, exact deployment spec and payload SHA-256/byte equality.
  The two font LICENSE.txt MIME values change from octet-stream to text/plain.
  Current Base rejects private inputs and exposes unsupported export/restore
  capabilities. Schema-2 consumers check raw sidecar sizes and hashes.

The complete final-source verify and independent hosted/native-mail/real-model
proof remain separate acceptance boundaries. Preserve the earlier checker HOLD.
