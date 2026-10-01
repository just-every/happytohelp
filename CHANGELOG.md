# Changelog

All notable changes to HappyToHelp are recorded here. Versions follow
[Semantic Versioning](https://semver.org/); before 1.0.0, minor versions may
include breaking changes.

## Unreleased

### Fixed

- Every destructive delete in the management and library screens (saved reply,
  contact, AI assistant, plugin, agent/member, article, category and website
  dataset) now asks through one shared, accessible confirmation dialog instead
  of deleting at once or using a native browser prompt. Contact erasure uses the
  same dialog with its exact typed `ERASE` confirmation. The last owner cannot
  be removed, and removing yourself is called out before it is confirmed.
- List tables on phones (saved replies, agents, contacts, plugins, websites,
  articles) stack each row as a captioned card, so no column or row action is
  hidden behind an unnoticed sideways scroll.
- The evaluation-run form shows field-level messages in place of the browser's
  JSON parser text, has an empty state, one consistent name (“Evaluation runs”)
  and explains its limits (a maximum cost of 0 is not accepted; 1 to 32,000
  tokens).
- Website datasets refuse crawl depths outside 0 to 100 and page limits outside
  1 to 10,000 in the form, the API and the crawler start; contacts created from
  the dashboard or API must have a name, an email or an external ID.

### Changed

- The public homepage is now the owner-approved “Customer Support, Solved.” page
  (approval 2026-10-01): a drawn inbox hero, the four product parts, “Help before
  they ask”, “Your own agent can investigate” and “Yours to run”, set in Outfit on
  warm paper with colour only inside labelled HTML/SVG drawings. Outfit is
  self-hosted from `public/fonts/outfit/` under the SIL Open Font License 1.1, so
  the homepage makes no third-party request.

### Removed

- The previous illustrated homepage: its components, styles, scroll-parallax
  hook, its artwork under `public/homepage` and their provenance entries.

## 0.2.2-rc.1 - 2026-09-30 (private candidate)

This version marks a private preservation candidate for review. It is not a
public release, tag, deployment or product-acceptance record.

### Added

- Focused commands for the existing scoped-delegation browser and authority
  runtime checks, plus the local usage-summary and request-limit checks. The
  original `verify`, `test:delegation` and browser commands remain unchanged.
- A compact receipt for a composed local emitted-Worker usage run on
  `c7f0d1b8ce447e59804d736ce364e9812dcf2715`, including its emitted artifact
  digest, measured units, pricing assumptions and unknowns.

### Qualification status

- The composed usage tests passed 2/2 at that source revision. The receipt is
  local-only: no model/provider was called, and hosted CPU, D1 totals, Durable
  Object duration/storage and actual billing remain unknown.
- The final f205 accessibility gate remains FAIL / confirmed owner HOLD after
  two rounds: four independently replicated oracle false accepts and a widget
  timing/background reliability failure. Its 21 passing states, 18 LIMITED
  review nodes and carried parity/demo evidence do not establish conformance.
  The owner chose to hold the checker and record the limitation; see the
  [current receipt](verification/rc-0.2.2-rc.1/final-qualification.json).
- The original v0.2.1 independent runtime proof now passes through an external
  port/import-only adapter, replicated by root at 97 tables/37 migrations.
  The unchanged command remains held; this does not qualify candidate 104 tables.
- The separate privately pushed portability-fidelity branch is not integrated.
  After two correction rounds, a resizable ArrayBuffer still restores as fixed
  length 4 instead of preserving maximum length 12 and length tracking. The
  further correction question remains unanswered, default HOLD.
- Full verify is not claimed: unchanged original 97-table/37-migration inventory
  differs from candidate 104 tables/38 migrations; owner port/lifecycle exceptions
  and DO decisions remain unanswered and unapplied.
- After integrating records at `557cb4e`, root source-lock refresh and source
  check passed (exit 0), changing only `sources.lock.json`. This validates bytes,
  not full verify or release acceptance; exact logs are pinned in the current receipt.

No public push, tag or deployment is part of this candidate record.

## 0.2.1 - 2026-09-27

### Fixed

- Hosted Assisted and Managed builds no longer fail with `pnpm: not found`.
  Run Edit Run's trusted project build provides Node but no global pnpm, and the
  package scripts that `build` and `verify` run call `pnpm`. The
  `rer-project.json` build and verify commands now put the pnpm 10.12.4 that
  `scripts/independent/setup-build.mjs` installs in `.rer-tools` first on
  `PATH`. Standalone installation and the `pnpm run` scripts are unchanged.
- The `rer-project.json` artifact check no longer fails with `97 !== 94`.
  `tests/independent-runtime.mjs` still requires an exact table count, now 97:
  migrations `0102_public_abuse_limits` (`abuse_counters`) and
  `0103_contact_erasure` (`contact_erasures`, `contact_erasure_objects`) in
  0.2.0 added three tables that the expected count had not been updated for.

## 0.2.0 - 2026-09-25

First public source release of the self-hosted edition.

### Added

- Native TypeScript rewrite on Cloudflare Workers: TanStack Start/React pages,
  Hono API, D1 records, R2 files, Queues for background work and a Durable
  Object for live conversation delivery, replacing the original PHP/Laravel and
  AWS services.
- The original dashboard, customer widget, AI assistance and suggestions,
  knowledge base with published help centers, customer context, local-agent
  delegation, training/evaluation runs and integrations (email, GitHub, help
  center imports, brand images and website preview), ported to the native
  runtime.
- Village public homepage with layered, reduced-motion-aware artwork. (Replaced on 2026-10-01 by the “Customer Support, Solved.” homepage; see Unreleased.)
- Standalone browser installer (`node scripts/install.mjs`) for local or
  Cloudflare installation, with agent-assisted prefill.
- Fictional demo inbox for trying the workspace without real customer data.
- Local importer for exports from the original HappyToHelp service.
- Contact erasure for owners and admins, from the dashboard (**Erase personal
  data…**) or `POST /api/management/projects/:projectId/contacts/:contactId/erase`.
  It removes the contact's identity, messages' content, attachments (including R2
  objects), customer context, AI and delegated-work text, inbound email evidence
  and legacy import copies, keeps transcript order, and records a non-identifying
  `contact_erasures` tombstone. [docs/PRIVACY.md](docs/PRIVACY.md) describes what
  is stored, what goes to which provider, and what erasure cannot reach.

### Security

- First-owner setup fails closed. Only loopback development may create the first
  owner without a private `H2H_SETUP_TOKEN`. A remote deploy of a fresh
  installation refuses to publish without a token of at least 32 characters, and
  a Worker reached any other way answers owner setup with HTTP 503 until one is
  configured.
- Operator pages and API responses send `Content-Security-Policy:
  frame-ancestors`, `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: strict-origin-when-cross-origin`; published Help Center pages
  stay embeddable.
- The dashboard parses user agents with `ua-parser-js` 1.0.41 directly,
  replacing a wrapper that pinned a release affected by a high-severity ReDoS
  advisory (GHSA-fhg7-m89q-25r3).
- Automatic inbound mail (autoresponders, bounces, list mail) is labelled and
  never triggers an AI reply or a notification. Notifications sent through
  Resend or SendGrid carry `Auto-Submitted` and `X-Auto-Response-Suppress`
  headers so that other systems do not answer them automatically.
- Public widget, registration and project-creation requests are rate limited
  per visitor, conversation, client address and account, with counters in D1
  (`RATE_LIMITS`). Per-project ceilings on widget sessions, conversations and
  attachments bound what rotating client addresses can create. A refused request
  gets HTTP 429 with `Retry-After`.
- Automatic AI work that visitors can trigger has daily ceilings per project
  (replies, estimated spend, context runs) and across the installation
  (`AI_DAILY_CEILINGS`). Past a ceiling, visitor messages still reach operators,
  the skipped reply is shown in the transcript, a visitor's explicit reply request
  gets HTTP 429 until 00:00 UTC without the operator-only reason or spend, and
  `GET /api/dashboard/projects/:projectId/ai-usage` reports the day's usage. See
  [docs/PUBLIC-LIMITS.md](docs/PUBLIC-LIMITS.md).
- A reply request's `requestId` (widget `request` command, dashboard `request`
  action) must be a UUID, or the request gets HTTP 400, so no caller-chosen text
  becomes a generation ID that contact erasure keeps.

### Fixed

- The scheduled outbox replay no longer leaves a conversation undelivered after
  a failed, queued or uncertain AI generation for an email message.
- Revoking a paired computer or its grant withdraws authority without claiming
  that the local run stopped: started work ends as revoked with an unconfirmed
  local outcome, and the conversation can be delegated again at once.

### Changed

- Licensed under MIT for the whole repository, including artwork.
- Dashboard styles are first-party, built on Bootstrap 5.3 (MIT) with icons from
  the `feather-icons` package (MIT); no commercial theme, font or image is used.
- The delivery artifact is byte-reproducible from a commit with the declared
  Node and pnpm versions (`pnpm run test:reproducible-build`).
- `pnpm run verify` includes a first-release journey test against a local
  emitted Worker, and continuous integration runs it with every browser suite
  and the homepage and public-site checks on pushes to `main` and on pull
  requests.
