# Changelog

All notable changes to HappyToHelp are recorded here. Versions follow
[Semantic Versioning](https://semver.org/); before 1.0.0, minor versions may
include breaking changes.

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
- Village public homepage with layered, reduced-motion-aware artwork.
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
