# HappyToHelp product contract

HappyToHelp preserves the useful parts of the original HappyToHelp owner
workspace: customer widget, operator dashboard, AI assistance and reply,
knowledge, customer context, delegated local work, training and integrations.
Its public surface is the “Customer Support, Solved.” homepage and dynamic published help centers.
It is editable source that replaces the original PHP/AWS application runtime with
a Cloudflare Worker stack. These clauses state required behavior; the evidence
each needs is in [ACCEPTANCE.md](ACCEPTANCE.md).

- **NATIVE-001 — Native owner installation.** A clean owner can inspect the
  operating description before installing dependencies, install locked source,
  prepare local or selected remote bindings/migrations, build, verify and deploy
  through the common commands. Resource setup and publication have distinct
  effects. The delivered runtime requires no original checkout or PHP service.
- **IDENTITY-001 — Scoped authority.** Owner setup, registration, login/recovery,
  project switching, membership and widget admission establish native identity.
  Every private read/write enforces the current actor/project/role; blocked or
  deleted projects and revoked credentials lose access. Provider configuration
  never substitutes for user authority. The public widget key and origin are not
  a secret: visitor, registration and project-creation requests are bounded by
  D1-backed limits (`RATE_LIMITS`) and refused with HTTP 429 and `Retry-After`.
- **CONVERSATION-001 — Durable transcript.** Customer, operator, generation,
  import and administrative writers preserve stable message/command identity,
  revision/frontier, attachment ownership and final-reply admission atomically.
  Competing or repeated writes cannot admit two incompatible final replies.
  Owner/admin contact erasure removes message content while keeping identity,
  revision and frontier, so erased transcripts stay coherent.
- **DELIVERY-001 — Live delivery and recovery.** Persist before broadcast;
  reconnect/outbox replay and socket authorization recover committed messages
  after reload, disconnection or process wake. Provisional AI deltas never become
  durable final answers until guarded admission succeeds.
- **UI-001 — Existing editable experience.** Reuse the original React dashboard,
  transcripts/drafts/suggestions, settings and Shadow DOM widget; preserve useful
  desktop/mobile flows, attachment display, collector/privacy controls and errors.
  Native routing/transport replaces baked origins and Laravel bootstrapping.
- **ACTIVATION-001 — Observed owner setup.** An owner sees the same durable,
  project-scoped eight-step checklist on the genuinely empty inbox and Setup page.
  Before explicit validation it is zero of eight, even when installer defaults exist.
  Checks distinguish saved configuration from observed delivery, sender DNS,
  authenticated model metadata, an inbound receipt, effective runtime ceilings,
  current article publication, allowed origin and an authenticated widget ping.
  GET performs no provider work. Only an explicit owner test-mail action may send,
  to that owner's mailbox, with durable identity; acceptance/queueing is pending
  and ambiguous work is never replayed. Missing provider permissions and unsupported
  status APIs remain unavailable. Configuration changes invalidate observations;
  model/DNS validation expires after 15 minutes and every observation shows its time.
  Publication does not assert model retrieval or a cited answer. Provider keys and
  their fingerprints never enter API responses or browser storage.
- **AI-001 — Configured model execution.** Retain Ensemble model selection,
  context/tools, streamed events, normalization, raw per-round provider usage,
  attribution, bounded suggestions and reply lifecycle. Missing providers fail
  explicitly; uncertain provider attempts remain uncertain and are not replayed
  automatically. Usage is diagnostic/provider accounting data, not an active
  payment, balance or debit system. Visitor-caused automatic AI work is capped per
  UTC day per project and installation (`AI_DAILY_CEILINGS`); a skipped reply is
  recorded as terminal and never replayed.
- **KNOWLEDGE-001 — Published knowledge.** Dataset ingestion/crawl, retained
  corpus, lexical/selected semantic retrieval, citations and article/category
  authoring maintain project scope and publication state. A failed refresh cannot
  replace the last usable published corpus. Public pages exclude drafts/deleted
  projects and preserve original canonical article/search routes.
- **CONTEXT-001 — Attributed customer context.** Profiles, monitoring, insights
  and context packets preserve evidence attribution, source bounds, consent and
  project ownership. Provider output must satisfy the selected schemas before
  becoming usable customer context.
- **DELEGATION-001 — Explicit local authority.** Pairing, devices/grants,
  revocation, tool context and work/result states preserve investigation, resolve
  and advance-authorized resolve-and-reply distinctions. Revocation withdraws
  authority and never asserts that a local process stopped: started work becomes
  terminal with an unconfirmed outcome, and only the device may report cancellation.
  Local processes remain in the optional connector, never an implicit Worker capability.
- **TRAINING-001 — Durable evaluation.** Training and evaluation preserve run/case
  state, model/budget selection, raw provider usage and cancellation/recovery.
  Synthetic data admission is explicitly local/test-only. Historical pending
  attempts require reconciliation; a fixture pass is not live-provider quality
  acceptance.
- **INTEGRATION-001 — Honest external effects.** Email/inbound mail, GitHub,
  branding and knowledge imports use configured native adapters, tenant-scoped
  credentials, durable identity and ambiguous-outcome handling. Website previews
  use a separate origin, scoped expiring grants and public-network restrictions.
  Machine-generated inbound mail never triggers autonomous AI replies,
  notifications or outbound email; its classification is recorded before
  admission and survives recovery and redelivery. The `email:` message local-id
  prefix is reserved for inbound claims and refused by the message API.
  Payment, checkout, Stripe and balance behavior are outside this edition.
- **PUBLIC-001 — Public product source.** The approved
  “Customer Support, Solved.” homepage (owner approval 2026-10-01, clarity pass
  2026-10-02) is the real public `/` experience, in this order: the hero, which
  shows a problem already solved in one column (a customer, Maya, cannot turn on
  the Spanish version of her store; Codex has fixed it and left a note; the reply
  is in the composer and only Send is left) beside the subhead “Your Codex or
  Claude fixes the problem and writes the reply. You press Send.”, the line
  “100% free and open source.” and the caption steps “The customer asks”, “The
  agent fixes it” and “You press Send”; “Not just better. Free.” (100% free and
  open source, free as in code and free as in cost, MIT licensed, “No seats. No
  plans. No fees.”, with the MIT licence drawn); “Help before they ask”; “The rest
  of your support desk” (chat widget, shared inbox, help centre, suggested
  replies); “Try it beside what you have” (install, bring the help centre from
  Zendesk, Intercom or Freshdesk, add the chat widget); “Ready when you are.”; and
  the footer. The page carries no price, hosting or provider line and no plug for any other service.
  The drawings mirror the real interface and make no claim the product cannot
  back; conversation, ticket-history and automation import, reporting and
  compliance claims are deliberately absent. It is a warm off-white page in one geometric sans-serif
  (Outfit, self-hosted from `public/fonts/outfit/`, so the page makes no
  third-party request) with near-black ink and black pill buttons; colour
  appears only inside the drawings, which are labelled HTML/SVG rather than raster images. Its text
  and real links, derived from `package.json` `repository.url`, are ordinary DOM
  content; the sketch marks draw in once and reduced-motion preferences remove
  all animation, transitions and smooth scrolling without changing layout. Dynamic published
  help centers retain project scope, canonical links, search and draft/deleted denial. The customer widget
  remains available through owner-configured installation; broader marketing
  routes, pricing, legal, referrer, waitlist and public auto-widget behavior
  are outside this edition.
- **MIGRATION-001 — Prior-data custody.** Explicit legacy artifacts preserve IDs,
  exact historical financial values, transcripts, object hashes, publication and
  permissions through resumable guarded D1/R2 import. Historical financial SQL,
  imported rows and reconciliation holds remain immutable archive custody; they
  never become active payments, balances or provider work. The one exception is an
  explicit owner/admin contact erasure: it takes precedence over archive custody for
  that contact's personal data and redacts the imported rows and their verbatim
  archive copies (row digests are kept, so replaying the bundle does not restore
  them), leaving a `contact_erasures` audit tombstone. Old credentials do not
  become trusted native authority.
- **SOURCE-001 — Author-owned capability graph.** The edition selects maintained
  source with inspect/check/lock/release commands. Shared capabilities include
  substantial implementation, migrations and meaningful tests; a second consumer
  preserves its own policy. Release excludes credentials/private fixtures and
  retains asset provenance/licensing obligations. Original work is preserved in
  digest-pinned private custody when sanitation is required. Public comparison
  archives have distinct reproducible identities; public verification requires
  no private input. Release qualification separately proves every archive
  comparison and retained test has equivalent original/projected semantics.

A source manifest, a compiling bundle or a provider fixture is not by itself
evidence that a clause is met.
