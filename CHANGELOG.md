# Changelog

All notable changes to HappyToHelp are recorded here. Versions follow
[Semantic Versioning](https://semver.org/); before 1.0.0, minor versions may
include breaking changes.

## 0.2.2

### Added — T-021 / T-022

- AI answers carry publication-bound citations. Retrieval excludes unpublished or
  withdrawn sources, and stored citations retain the source version used for the answer.
- The empty inbox and Setup page share an observed, project-scoped eight-step
  activation checklist. Saved settings alone do not count as delivery, DNS, model,
  inbound-mail or widget proof; unknown provider outcomes are never replayed.
- Knowledge authoring exposes article publication, retrieval eligibility and
  source navigation. Conversation AI controls share one state, demo workspaces
  retain their context, and the spend card explains effective runtime ceilings.
- Migration `0107_activation_receipts.sql` adds activation observations;
  `0108_public_answer_citations.sql` adds publication identities, retained
  citation sources and customer-context mutation fences. The upgrade also includes
  `0105_edition_delegation.sql` and
  `0106_project_verification_secret.sql` after public v0.2.1.

### Qualification boundary

- Version 0.2.2 is prepared on the private release line. The exact-source local
  results and owner handoff belong in `verification/release-0.2.2/`; a version
  number does not authorize publication or imply hosted/provider acceptance.
- T-021 and T-022 implementation are merged. T-022's recorder preparation is
  present; its timed live recording is still missing and is not claimed as passed.
- Accessibility remains **FAIL / confirmed owner HOLD** because the retained
  checker has false accepts and timing/background limitations. No WCAG
  conformance is claimed. Public release remains owner-held.

### Fixed

- Widget settings (Theme, Texts, Settings) now show what the widget actually renders:
  default colors, default copy and default toggles, with the default copy also shown as
  each text field's placeholder. Editing one field changes only that value in the form
  and the live preview, and Save stores only edited fields, so saving without edits no
  longer blanks the widget copy, turns defaults off or paints colors black. Clearing a
  text field or restoring a default removes its override. Saving widget settings no longer
  discards the theme and text when the form includes a `settings` section.
- Every project now has a server secret (`H2H_SECRET`) for signed-in-user verification.
  It is generated when a project is created (setup, registration, project creation, demo
  inbox) and migration `0106_project_verification_secret.sql` backfills existing projects
  that had none. Owners and admins can reveal and copy it from Widget > Code; other roles
  see an explanation instead of disabled buttons.
- `GET /api/identity/projects/:id` returns only the project's id, name, widget key, allowed
  origin and creation time; the server secret reaches owners and admins only through widget settings.
- The delegation consent page and Connected applications are served under a strict
  Content-Security-Policy (same-origin sources, no plugins, `base-uri 'self'`, no framing) and
  `form-action` limited to this origin plus, on the consent page, the callback registered for
  the request's client. The consent page keeps `X-Frame-Options: DENY` and `no-store`; the
  application header layer no longer replaces that `X-Frame-Options` with `SAMEORIGIN`.
- Every destructive delete in the management and library screens (saved reply,
  contact, AI assistant, plugin, agent/member, article, category and website
  dataset) now asks through one shared, accessible confirmation dialog instead
  of deleting at once or using a native browser prompt; Tab and Shift+Tab stay
  inside it. Contact erasure uses the
  same dialog with its exact typed `ERASE` confirmation. The last owner cannot
  be removed, and removing yourself is called out before it is confirmed.
- List tables on phones (saved replies, agents, contacts, plugins, websites,
  articles) stack each row as a captioned card, so no column or row action is
  hidden behind an unnoticed sideways scroll; row actions that sit in a ⋮ menu on
  wide screens are shown as visible controls on the card.
- The evaluation-run form shows field-level messages in place of the browser's
  JSON parser text, has an empty state, one consistent name (“Evaluation runs”)
  and explains its limits (a maximum cost of 0 is not accepted; 1 to 32,000
  tokens).
- Website datasets refuse crawl depths outside 0 to 100 and page limits outside
  1 to 10,000 in the form, the API and the crawler start; contacts created from
  the dashboard or API must have a name, an email or an external ID.

### Changed

- The owner-approved “Customer Support, Solved.” homepage clarity pass (owner direction 2026-10-02) keeps the 1, 2, 3 story and cuts everything
  that stood between a reader and it. The hero drawing is one column: Maya cannot turn on the Spanish
  version of her store, Codex has fixed it (a cyan note card with a check), and the reply is in the
  composer with Send circled, with callouts 1, 2, 3 and the caption steps; the subhead is “Your Codex
  or Claude fixes the problem and writes the reply. You press Send.” and the line under the actions
  is “100% free and open source.” “Not just better. Free.” now says it plainly (100% free and open
  source, free as in code and free as in cost, MIT licensed, “No seats. No plans. No fees.”) beside a
  drawing of the MIT licence. “Help before they ask”, “The rest of your support desk” and “Try it
  beside what you have” are trimmed to one short line each with smaller drawings, and a short
  “Ready when you are.” band replaces “Yours to run”. The page no longer mentions prices, hosting,
  providers or Run Edit Run, and the examples strip, the signals list, the bill, installer and Local
  panel drawings, and the costs and hosted-options links are removed. The page meta description is
  updated.
- Historical pre-clarity homepage state: the page then led with the local-agent handoff; its hero drew a conversation whose
  task Codex or Claude on the team's own computer had already completed, with the Local panel,
  internal note and drafted reply the team reviewed, and a subhead that said who ran it and who
  approved sending. “Help before they ask” then followed the hero, followed by the four product parts. The
  “Your own agent can investigate” section was replaced by a short “How the handoff works” detail
  built from the New task form. All drawings mirrored the real interface wording.
- Historical initial homepage approval (owner approval 2026-10-01; superseded by the 2026-10-02 clarity pass): the page at that point was described as the “Customer Support, Solved.” page with a drawn inbox hero, the four product parts, “Help before they ask”, “Your own agent can investigate” and “Yours to run”, set in Outfit on warm paper with colour only inside labelled HTML/SVG drawings. Outfit was self-hosted from public/fonts/outfit/ under the SIL Open Font License 1.1, so the page made no third-party request. This preserves the initial approved state; the current page is described by the clarity-pass entry above.

- The public identity pages (`/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/verify-email`, `/accept-invitation` and the completed-setup state of `/setup`) use the
  homepage's paper, ink and Outfit with the HappyToHelp wordmark, a link home and links to
  one another, instead of the dashboard-styled form. Invitation, verification and reset links are
  checked on load and report a missing, invalid, expired or used link with a way forward. A
  signed-out invitee sees the workspace and email and either creates an account or signs in and
  returns to the link. Every new-password field states and enforces the 12 to 1024 character rule.
  `/login` points to `/setup` while no owner exists; sign-up is offered only when it can work and
  stays closed until setup is done; forgot-password without an email provider still fails closed
  and says the workspace owner must reset the password.

- Local computers and delegation use the workspace design system. The Connect
  computer dialog is styled outside the inbox; authorizing a computer shows
  “Computer approved” or “Request denied” and clears the code; Connected
  applications and the connection consent screen render in the application
  shell instead of bare server HTML, cancelling a connection returns to
  Connected applications, and missing, invalid, unavailable or signed-out
  requests show friendly pages. The consent form and revocation rules are
  unchanged. Registering a client whose identifier already exists now answers
  409 `CLIENT_EXISTS` instead of a server error. URLs keep text that reads as a
  number (an OAuth `state`, a device code) exactly as written.

### Added

- Pending invitations on Agents can be copied, resent (when email is configured) and revoked by
  owners and by admins for agent invitations. The routes re-check the caller's role. New public
  helpers `GET /api/identity/auth-options` and `POST /api/identity/link-status`, with
  `pnpm run test:identity-browser`, `tests/identity-links.mjs` and `tests/management-invitations.mjs`.

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
- The final accessibility gate on historical source f2054 is recorded as FAIL / confirmed owner HOLD after
  two rounds: four independently replicated oracle false accepts and a widget
  timing/background reliability failure. Its 21 passing states, 18 LIMITED
  review nodes and carried parity/demo evidence do not establish conformance.
  The owner chose to hold the checker and record the limitation; see the [historical final-qualification receipt](verification/rc-0.2.2-rc.1/final-qualification.json).
- The original v0.2.1 independent runtime proof is recorded as passing through an external
  port/import-only adapter, replicated by root at 97 tables/37 migrations.
  The unchanged command remains held; this historical proof does not qualify f2054's
  104-table candidate or the later merged line.
- The separate privately pushed portability-fidelity branch is not integrated.
  After two correction rounds, a resizable ArrayBuffer still restores as fixed
  length 4 instead of preserving maximum length 12 and length tracking. The
  further correction question remains unanswered, default HOLD.
- Historical f2054 qualification did not claim a passing full verification result. Its schema was 104 tables/38 migrations, while the separate unchanged independent-runtime assertion expects the public v0.2.1 inventory of 97/37. In the current package scripts, `pnpm run test:independent-runtime` is separate from `pnpm run verify`; the adapter proof for 97/37 applies only to v0.2.1, not to a later candidate. The historical port/lifecycle exceptions and Durable Object decisions also remained unanswered and unapplied.
- At `557cb4e`, the root refreshed `sources.lock.json`; `pnpm run source:lock` and `pnpm run source:check` both exited 0, changing only the lock file. That validates recorded source bytes, not full verification or release acceptance. Exact historical command logs are pinned in the receipt.

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
