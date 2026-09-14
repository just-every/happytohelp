# HappyToHelp native product contract

The edition preserves the useful full HappyToHelp application: public acquisition
and help content, customer widget, operator dashboard, AI assistance and reply,
knowledge, customer context, delegated local work, training and integrations.
It owns editable source and replaces the original PHP/AWS application runtime
with the maintained RER Worker stack. These clauses state required behavior;
implementation and acceptance evidence are tracked separately in ACCEPTANCE.md.

- **NATIVE-001 — Native owner installation.** A clean owner can inspect the
  operating description before installing dependencies, install locked source,
  prepare local or selected remote bindings/migrations, build, verify and deploy
  through the common commands. Resource setup and publication have distinct
  effects. The delivered runtime requires no original checkout or PHP service.
- **IDENTITY-001 — Scoped authority.** Owner setup, registration, login/recovery,
  project switching, membership and widget admission establish native identity.
  Every private read/write enforces the current actor/project/role; blocked or
  deleted projects and revoked credentials lose access. Provider configuration
  never substitutes for user authority.
- **CONVERSATION-001 — Durable transcript.** Customer, operator, generation,
  import and administrative writers preserve stable message/command identity,
  revision/frontier, attachment ownership and final-reply admission atomically.
  Competing or repeated writes cannot admit two incompatible final replies.
- **DELIVERY-001 — Live delivery and recovery.** Persist before broadcast;
  reconnect/outbox replay and socket authorization recover committed messages
  after reload, disconnection or process wake. Provisional AI deltas never become
  durable final answers until guarded admission succeeds.
- **UI-001 — Existing editable experience.** Reuse the original React dashboard,
  transcripts/drafts/suggestions, settings and Shadow DOM widget; preserve useful
  desktop/mobile flows, attachment display, collector/privacy controls and errors.
  Native routing/transport replaces baked origins and Laravel bootstrapping.
- **AI-001 — Configured model execution.** Retain Ensemble model selection,
  context/tools, streamed events, normalization, per-round usage, attribution,
  bounded suggestions and reply lifecycle. Missing providers fail explicitly;
  uncertain paid attempts remain uncertain and are not replayed automatically.
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
  and advance-authorized resolve-and-reply distinctions. Local processes remain
  in the optional connector, never an implicit Worker capability.
- **TRAINING-001 — Durable evaluation.** Training and evaluation preserve run/case
  state, model/budget selection, usage and cancellation/recovery. Synthetic data
  admission is explicitly local/test-only. Historical pending attempts require
  reconciliation; a fixture pass is not live-provider quality acceptance.
- **INTEGRATION-001 — Honest external effects.** Email/inbound mail, Stripe,
  GitHub and branding use configured native adapters, tenant-scoped credentials,
  durable identity and ambiguous-outcome handling. Website previews use a
  separate origin, scoped expiring grants and public-network restrictions.
- **PUBLIC-001 — Public product source.** Retain original marketing, resources,
  pricing/legal copy, referrer-aware hero and public widget integration as native
  editable source. Waitlist validation persists a real entry; optional email
  notification reports its own state. No mock application response replaces an
  unavailable demo or provider.
- **MIGRATION-001 — Prior-data custody.** Explicit legacy artifacts preserve IDs,
  exact money, transcripts, object hashes, publication and permissions through
  resumable guarded D1/R2 import. Archive-only records and reconciliation holds
  remain visible. Old credentials do not become trusted native authority.
- **SOURCE-001 — Author-owned capability graph.** The edition selects maintained
  source with inspect/check/lock/release commands. Shared capabilities include
  substantial implementation, migrations and meaningful tests; a second consumer
  preserves its own policy. Release excludes credentials/private fixtures and
  retains asset provenance/licensing obligations. Original work is preserved.

The wider accepted migration plan remains
`platform/happytohelp-rer-migration-plan-2026-09-14.md` in the RER workspace. These
clauses consolidate its behavior without treating a source manifest, compiling
bundle or provider fixture as evidence of complete product acceptance.
