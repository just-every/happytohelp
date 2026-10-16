# HappyToHelp product contract

Target edition · 16 October 2026 · US-first, USD. HappyToHelp is a complete customer service help desk and AI support agent for a US SMB support lead switching from Zendesk, Intercom (with Fin), Help Scout or Freshdesk. It owns the job from customer intake through a shared operational queue, self-service and live business context to an authorized resolution and continued customer recovery. Decagon, Sierra and Pylon set the agent/procedure and B2B-channel baseline; the target goes further with verified repair and obligations that survive handoffs.

This is the product we are building towards. Required behavior is not a claim of current implementation, provider acceptance or compliance. The final table records current code/test coverage as done, partial or missing; each clause names the public journey that will prove it. The matching evidence map is [ACCEPTANCE.md](ACCEPTANCE.md). A cited test is implementation evidence, not a claim that it was executed for this document change.

Keep the owner-approved homepage, UI and behavior intact. The retained owner decisions of 8 October (native passwords), 9 October (import equality and bounded ordinary HTTPS transport) and the detailed PUBLIC-001 specification remain in force. This contract expansion authorizes future build rounds against the missing work; it does not silently change today's marketing claims. The product remains editable source on Cloudflare Workers with a separately authorized local connector, run through `rer`.

## Retained product and operating guarantees

- **NATIVE-001 — Native owner installation.** A clean owner can inspect the
  operating description before installing dependencies, install locked source,
  prepare local or selected remote bindings/migrations, build, verify and deploy
  through `rer`. Local setup exits with no app running; dev
  prints a private `RER_OPEN` address that enters as the real local owner through
  the rer dev v2 boundary, preserving native sessions, roles and passwords.
  Reset is explicitly confirmed and local;
  export/import preserve supported native data with documented exclusions.
  Deployment dry-run makes no provider requests. The delivered runtime requires no original checkout or PHP service.

  **Acceptance evidence:** Use a clean checkout through rer describe/check, locked installation, setup, dev, verify, reset, export/import and deployment dry-run; preserve owner/data/settings and refuse unconfirmed destructive work. Prove the runtime works independently of the original checkout; separately qualify remote provisioning.

- **IDENTITY-002 — Retained native password identity (owner decision 2026-10-08).** Preserve native password sign-in, first-owner setup, the accepted owner
  experience and prior account/workspace data with the maintained Base command mechanisms. Retain this edition's authentication and native owner setup. Existing tenant and permission checks
  continue to govern every session.

  **Acceptance evidence:** Complete native password setup, login, recovery and workspace re-entry, then upgrade with prior owner credentials and data intact; configured providers must not replace native identity.

- **IDENTITY-001 — Scoped authority.** Owner setup, registration, login/recovery,
  project switching, membership and widget admission establish native identity.
  Every private read/write enforces the current actor/project/role; blocked or
  deleted projects and revoked credentials lose access. Provider configuration
  never substitutes for user authority. The public widget key and origin are not
  a secret: visitor, registration and project-creation requests are bounded by
  D1-backed limits (`RATE_LIMITS`) and refused with HTTP 429 and `Retry-After`.

  **Acceptance evidence:** Through native session and widget routes, deny cross-tenant, blocked/deleted and revoked access; prove public admission returns 429 with Retry-After when limited and provider configuration conveys no actor authority.

- **FIRST-RUN-001 — A useful first workspace.** First-run setup is one screen: the
  owner's email, a password, the website and, only where the server requires one,
  the private setup token. Missing names and colours are derived and every derived
  value can be changed. A completed installation leads the owner to a workspace that
  is already set up, whose Setup page lists only what cannot be done for them (an
  AI service key, the widget on their website and, with a hosted email provider, a
  verified sending domain), leads with the widget, lets the owner skip any of
  them for now, and shows everything else under "What we've set". Every workspace created by first-owner setup, signed-in
  workspace creation or email-verified registration, and never a demo workspace,
  is provisioned in one step: a starter
  assistant as its default visitor assistant, a reply-by-email mailbox when the
  installation holds `INBOUND_EMAIL_TOKEN`, and mail sent from the installation
  sender until the workspace's own domain is verified. The starter assistant answers
  visitors by itself once a provider key exists, within the daily AI ceilings; with
  no key no assistant is assigned to a new conversation, it stays with the team and
  the AI page and Setup say a key is missing. The first-run Create workspace action
  may send one welcome email to the owner; an uncertain send is never replayed.
  Ordinary workspace creation leads with the widget snippet; Advanced retains the
  server secret and verification examples. Empty inboxes offer installation, a link to
  Setup and a demo. Workspace headers follow workspace switching.
  Visitor headers retain the operator's display name.

  **Acceptance evidence:** Run fresh first-owner setup and signed-in workspace creation to Setup and an installable widget; inspect derived editable name/colour, starter assistant, mailbox/sender, skip/Advanced controls and mobile headers. With no model key a new visitor stays with the team; with a configured provider exercise the capped starter. A workers.dev hostname must not become a business name.

- **LOCAL-MAIL-001 — Rer dev mail.** Trusted local development configuration
  uses the rer dev v2 development transport: it validates and suppresses visitor
  and teammate mail, reports `development`, stores no messages and exposes no mail viewer.
  It sends no external email and never claims delivery. The local
  owner enters automatically through the dev boundary; native password identity,
  ordinary hosted email-link confirmation and prior stored data are retained.
  Production has no local dev surface. Missing credentials or failed remote
  delivery never select a local substitute.

  **Acceptance evidence:** Enter through rer dev v2; send visitor and teammate mail and prove development suppression without storage, viewer or external send; refuse forged and production dev entry and never substitute suppression for a failed hosted provider.

- **CONVERSATION-001 — Durable transcript.** Customer, operator, generation,
  import and administrative writers preserve stable message/command identity,
  revision/frontier, attachment ownership and final-reply admission atomically.
  Competing or repeated writes cannot admit two incompatible final replies.
  Owner/admin contact erasure removes message content while keeping identity,
  revision and frontier, so erased transcripts stay coherent.

  **Acceptance evidence:** Race visitor, operator, model and import writers through conversation routes with duplicate and lost responses; admit only compatible final replies. Erase a contact through the owner door and verify coherent identity/revision/frontier with content removed.

- **DELIVERY-001 — Live delivery and recovery.** Persist before broadcast;
  reconnect/outbox replay and socket authorization recover committed messages
  after reload, disconnection or process wake. Provisional AI deltas never become
  durable final answers until guarded admission succeeds.

  **Acceptance evidence:** Disconnect/reconnect widget and operator sockets after persisted writes, restart the runtime and recover the same committed messages/attachments; unauthorized replay is denied and superseded AI deltas never become final replies.

- **UI-001 — Existing editable experience.** Reuse the original React dashboard,
  transcripts/drafts/suggestions, settings and Shadow DOM widget; preserve useful
  desktop/mobile flows, attachment display, collector/privacy controls and errors.
  Native routing and transport use the configured application origin.

  **Acceptance evidence:** Use the native dashboard and separately installed widget at 1440 and 390 pixels with realistic conversations, attachments, drafts, errors and workspace switching; retain the approved desktop/mobile navigation and configured-origin transport.

- **MOVE-IN-001 — Reviewed history import.** Current workspace owner/admin
  reviewers privately upload, inspect per-kind plans, source-located omissions,
  rejections, conflicts and publication changes, then explicitly apply bounded,
  resumable imports of conversations, contacts, tags, saved replies and articles.
  Preserve source identities, timestamps, private notes and publication state;
  reject unsupported meaning rather than inventing it. Recheck current role and
  workspace authority for apply, resume and whole-import undo. Retain immutable
  source custody and conflict-safe reversal journals. Imports and undo send no
  mail, widget messages, model requests, assignment or connection notifications;
  imports are excluded from Reports. Native tag controls enforce workspace scope.
  Owner decision 2026-10-09 requires exact business-state repeat/undo equality,
  including contacts, conversations, messages, private notes, tags, source links
  and every other imported business table. Only platform counters/sequences,
  audit history and import journals are excluded. Synthetic 1,000-conversation
  datasets for Zendesk and Help Scout qualify this local flow.

  **Acceptance evidence:** Through Move in, exercise all five kinds, source custody, per-row omissions/rejections/conflicts, current-role denials, inert apply/resume/repeat/undo and exact business-state equality for synthetic 1,000-conversation Zendesk and Help Scout datasets; counters/sequences, audit and journals are the only named exclusions.

- **OUTCOMES-001 — Resolution feedback and provenance.** Current original visitor
  sessions may rate a closed resolution with thumbs up/down and an optional
  comment up to 1,000 characters. Changes retain history; reopened cycles cannot
  receive the previous resolution's rating. Operators retain access to each past
  resolution's latest feedback after reopening; visitor eligibility and report
  denominators remain tied to the current cycle. Erasure removes rating comments.
  Confirmed operator-sent drafts establish assisted outcomes, otherwise confirmed
  human replies establish human outcomes. AI requires a complete visible answer
  history without a person handoff; missing evidence remains unknown. Status,
  assignment and cancellation transitions recheck current authority atomically.

  **Acceptance evidence:** Close, rate, rerate, reopen and close again via widget/operator routes; prevent previous-session/cycle feedback, retain old-cycle operator visibility, redact erased comments and verify human/assisted/AI/unknown attribution from actual visible answers.

- **REPORTS-001 — Workspace calendar reports.** Native conversations created in
  the workspace IANA calendar range form the cohort; Move in and legacy imports
  are excluded. First visitor-to-visible-answer response and creation-to-first
  known-resolution durations use median and nearest-rank p90. Each conversation
  contributes its latest closed cycle once to outcome and satisfaction rates.
  Reopened conversations leave those denominators. Aggregate queries return
  bounded data; CSV streams every matching conversation with formula-safe cells.

  **Acceptance evidence:** Compare Reports and formula-safe CSV to hand-calculated response/resolution median and p90, latest-cycle outcome and satisfaction cohorts across DST and tenants, including more than 10,000 rows and excluded imports/reopened cycles.

- **CONNECTIONS-001 — Workspace integrations.** Owner/admin tokens have explicit
  scopes, optional expiry, one-time display, hashed storage and durable audit.
  Bearer-only API calls have no CORS, per-token limits and native guarded writes.
  Contact erasure fences API identity restoration and pending event payloads.
  Native events commit tenant-bound webhook and Slack intents; historical import
  apply and undo do not emit them. Slack projects bounded native visitor text
  through Base escaping. Base owns signing, durable attempts and retry policy.
  HTTP 500 stays uncertain and is not replayed; 429 retains bounded retries.
  **Scoped edition override, owner decision 2026-10-09:** this consumer uses
  ordinary platform HTTPS fetch through the unchanged Base wire interface. It
  refuses every 3xx with manual redirect handling, enforces a 10-second timeout,
  a 1 MiB request limit and 64 KiB streamed-response limit. Destination syntax
  and literal IP validation remain enforced. This expressly overrides Base's
  transport DNS-pinning requirement for this edition; it does not claim DNS
  pinning or change copied Base contracts. Local synthetic protocol checks do
  not establish a live Slack connection or hosted installation.

  **Acceptance evidence:** Issue, use, expire and revoke each scoped show-once token; exercise native API operations, erasure fences, signed events and Slack escaping. Refuse redirects/unsafe literal destinations and over-limit traffic; preserve timeout, streamed bounds, uncertain 500 without replay and bounded 429 behavior under the recorded HTTPS override.

- **ACTIVATION-001 — Observed owner setup.** An owner sees the durable,
  project-scoped eight-step list on the Setup page; the genuinely empty inbox
  shows one next action and a link to it, and loads none of it. A
  step is confirmed only by an observation, never by a saved configuration, an
  installer default or a preset, so a workspace with nothing observed yet is zero
  of its applicable steps. The system runs its own checks: while an owner is signed
  in the page asks the server to observe, bounded by freshness windows. These
  checks are non-generative metadata, domain and DNS reads and never send mail.
  They distinguish saved configuration from observed sender DNS, authenticated
  model metadata, an inbound receipt, effective runtime ceilings, allowed origin
  and an authenticated widget ping; whether an article is published is not one of
  them (that step stays among the eight ids but is hidden and never counted). Mail to the owner
  is confirmed by a used emailed sign-in link, or by the provider's reported outcome
  for the welcome or test email; local development mail is suppressed and never
  confirms delivery, and provider acceptance or queueing is pending. `GET` performs no
  provider work and writes nothing. Only an explicit owner action (Create
  workspace, or Send me a test) may send mail, to that owner's mailbox, with
  durable identity; ambiguous work is never replayed. Missing provider permissions
  and unsupported status APIs remain unavailable. Configuration changes invalidate
  observations; model and DNS validation expire after 15 minutes and every
  observation shows its time. The owner can skip an owner-only step (the widget,
  the AI service, the sending domain) for now, and undo it. A skip is stored on the
  server for the workspace, can be made by an owner or admin only, makes no provider
  request, and moves the step out of Needs you and out of the confirmed count and its
  total; a skipped step is never shown as confirmed. An observation always wins: a
  skipped step that is later observed is confirmed and counted, and a rejected
  provider key stays under Needs you whether or not it was skipped. Provider keys and
  their fingerprints never enter API responses or browser storage.

  **Acceptance evidence:** Read Setup without side effects, observe fresh/expired/rejected configuration and explicit provider outcomes, skip/undo owner steps and reload. A skip or preset never counts as confirmation; local suppression never proves delivery; keys/fingerprints remain server-only and uncertain explicit test/welcome mail is never replayed.

- **AI-001 — Configured model execution.** Retain Ensemble model selection,
  context/tools, streamed events, normalization, raw per-round provider usage,
  attribution, bounded suggestions and reply lifecycle. Missing providers fail
  explicitly when AI is asked for, and a default assistant whose provider has no
  key is simply not assigned to new conversations; uncertain provider attempts
  remain uncertain and are not replayed automatically. Usage is diagnostic/provider accounting data, not an active
  payment, balance or debit system. Visitor-caused automatic AI work is capped per
  UTC day per project and installation (`AI_DAILY_CEILINGS`); a skipped reply is
  recorded as terminal and never replayed.

  **Acceptance evidence:** Request configured suggestions/replies through native routes; inspect normalized streaming events, per-round usage, context/tool and budget bounds, explicit missing-provider errors and durable daily-cap skips; crash/ambiguous attempts must not automatically replay.

- **KNOWLEDGE-001 — Published knowledge.** Dataset ingestion/crawl, retained
  corpus, lexical/selected semantic retrieval, citations and article/category
  authoring maintain project scope and publication state. A failed refresh cannot
  replace the last usable published corpus. Public pages exclude drafts/deleted
  projects and preserve original canonical article/search routes.

  **Acceptance evidence:** Publish and search articles/categories through authoring and public help-center doors; deny draft/deleted/cross-project access, verify citations and canonical links and retain the last usable published corpus after a failed refresh.

- **CONTEXT-001 — Attributed customer context.** Profiles, monitoring, insights
  and context packets preserve evidence attribution, source bounds, consent and
  project ownership. Provider output must satisfy the selected schemas before
  becoming usable customer context.

  **Acceptance evidence:** Generate/read profile, monitoring, insight and context packets through native routes; reject ungrounded/schema-invalid or cross-project content, preserve attributed evidence and respect consent/source bounds.

- **DELEGATION-001 — Explicit local authority.** Pairing, devices/grants,
  revocation, tool context and work/result states preserve investigation, resolve
  and advance-authorized resolve-and-reply distinctions. Revocation withdraws
  authority and never asserts that a local process stopped: started work becomes
  terminal with an unconfirmed outcome, and only the device may report cancellation.
  Local processes remain in the optional connector, never an implicit Worker capability.

  **Acceptance evidence:** Pair the packaged connector, investigate, separately authorize a child fix, obtain a distinct read-only observation and use human Send with exact-request replay. Refuse stale/revoked/offline/unverified/uncertain work and distinguish resolve from advance-authorized resolve-and-reply; revocation cannot assert process cancellation.

- **TRAINING-001 — Durable evaluation.** Training and evaluation preserve run/case
  state, model/budget selection, raw provider usage and cancellation/recovery.
  Synthetic data admission is explicitly local/test-only. Historical pending
  attempts require reconciliation; a fixture pass is not live-provider quality
  acceptance.

  **Acceptance evidence:** Create, run, cancel and recover persisted evaluations through training routes with model/budget selection and raw usage; reconcile historical pending/uncertain attempts and keep synthetic admission local/test-only, with live quality qualification separate.

- **INTEGRATION-001 — Honest external effects.** Email/inbound mail, GitHub,
  branding and knowledge imports use configured native adapters, tenant-scoped
  credentials, durable identity and ambiguous-outcome handling. Website previews
  use a separate origin, scoped expiring grants and public-network restrictions.
  Machine-generated inbound mail never triggers autonomous AI replies,
  notifications or outbound email; its classification is recorded before
  admission and survives recovery and redelivery. The `email:` message local-id
  prefix is reserved for inbound claims and refused by the message API.
  Shopify, Stripe and CRM support actions are required by COMMERCE-001, BILLING-001 and CRM-001. HappyToHelp never holds funds or becomes a payment processor; historical imported balances remain custody records, not executable authority.

  **Acceptance evidence:** Use configured email, inbound mail, GitHub and knowledge-import public doors; test idempotency, machine-generated-mail suppression, separate-origin preview grants and network denial. An operator reply emails the visitor even with an online/unverified widget. Test accepted, failed and uncertain outcomes without invented delivery; business-action evidence is also required by COMMERCE-001, BILLING-001 and CRM-001.

- **PUBLIC-001 — Public product source.** The approved
  “Customer Support, Solved.” homepage (owner approval 2026-10-01, clarity pass
  2026-10-02, hero redesign 2026-10-08) is the real public `/` experience, in
  this order: the hero, which shows a problem already solved as three staggered,
  hand-outlined bubbles on a pale aqua blob, joined by ink arrows (a customer,
  Maya, cannot turn on the Spanish version of her store; the untitled agent bubble,
  beside a code glyph, says it is fixed; the reply to Maya, beside a person glyph,
  carries Send inside it, the only step left) beside the subhead “Your Codex or
  Claude fixes the problem and writes the reply. You press Send.”, the line
  “100% free, open source alternative to Zendesk, Intercom, Help Scout and Freshdesk”, an aqua pen-stroke flourish under the calls to
  action that draws itself in once, and the caption steps “The customer asks”,
  “The agent fixes it” and “You press Send” on filled aqua number discs; “Not just better. Free.” (100% free and
  open source, free as in code and free as in cost, MIT licensed, “No seats. No
  plans. No fees.”, each promise after a line icon in a pale aqua circle, with the MIT licence drawn as an ink card
  over a wordless code editor, “free of charge” and the rights highlighted in aqua); “Help before they ask” (the
  checkout page in its window, and the widget's offer floating over it with the speech-bubble mark as its avatar);
  “The rest of your support desk” (chat widget, shared inbox, help centre, suggested
  replies, as frameless ink cards numbered on filled aqua discs); “Try it beside what you have” (install, bring the
  help centre from Zendesk, Intercom or Freshdesk, add the chat widget, on filled aqua discs, beside the finished
  import in its window); “Ready when you are.”, as big as the hero headline with an aqua pen line drawn under it;
  and the footer, signed with the header's lockup. Below the hero the drawings carry the hero's language: each
  floats on a pale aqua blob, the mark's three aqua sparks spring from the corner of four of its cards, a window
  frame stays only for the code editor, the checkout and the import, the text links carry the hero's aqua
  underline, and a full-width aqua pen line with one loop divides Free from Help before they ask and the desk
  from Try it beside what you have. The page carries no price, hosting or provider line and no plug for any other service.
  The drawings mirror the real interface and make no claim the product cannot
  back; conversation, ticket-history and automation import, reporting and
  compliance claims are deliberately absent. It is a warm off-white page in one geometric sans-serif
  (Outfit, self-hosted from `public/fonts/outfit/`, so the page makes no
  third-party request, over a metric-matched local fallback, so no text moves
  when it loads) with near-black ink and black pill buttons; colour
  appears only inside the drawings, which are labelled HTML/SVG rather than raster images,
  and in aqua accents outside them (the hero's and the desk's number discs, the promises' circles, link underlines, the
  hero flourish, the dividers, the closing line) and in the sparks of the speech-bubble mark beside the header and
  footer wordmark. The wordmark is not set in Outfit: it is drawn by hand as round-capped SVG strokes following
  Nunito's letter shapes (SIL OFL), with no font data embedded, and the link it sits in is named HappyToHelp by
  visually hidden text. The page's text
  and real links, derived from `package.json` `repository.url`, are ordinary DOM
  content; the hero flourish draws in once as the page appears, and each moment below the hero (a drawing, the
  promises, the steps, a desk card, a divider, the closing line) plays once, in under 1.8s, as it scrolls into view
  (an IntersectionObserver), moving only opacity, transforms, clipping and strokes, so nothing shifts; reduced-motion
  preferences remove all animation, transitions and smooth scrolling without
  changing layout, leaving every drawing in its final state and every stroke fully drawn. `/docs` renders, at build
  time, the Markdown files listed in `docs/site.json`, in the homepage's paper,
  ink and Outfit, with section navigation, page contents and GitHub links for
  everything unpublished; an unknown page gets the branded 404. Every build
  renders the current files, and an unlisted Markdown file fails verification. Dynamic published
  help centers retain project scope, canonical links, search and draft/deleted denial. The customer widget
  remains available through owner-configured installation; broader marketing
  routes, pricing, legal, referrer, waitlist and public auto-widget behavior
  are outside this edition.

  **Acceptance evidence:** Exercise the approved homepage and /docs requirements retained in this clause and the detailed acceptance specification at desktop/mobile, including keyboard/reduced motion, published Markdown manifest/link validation and draft/deleted help-center denial; target requirements do not authorize changed marketing claims.

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

  **Acceptance evidence:** Import representative legacy IDs, permissions, exact historical financial values and media hashes through local D1/R2; resume safely and refuse conflicts without external work. Erase an imported contact and prove archive redaction plus tombstone/digest fencing prevents restoration of erased personal data.

- **SOURCE-001 — Author-owned capability graph.** The edition selects maintained
  source with inspect/check/lock/release commands. Shared capabilities include
  substantial implementation, migrations and meaningful tests; a second consumer
  preserves its own policy. Release excludes credentials/private fixtures and
  retains asset provenance/licensing obligations. Original work is preserved.

  **Acceptance evidence:** Run inspect/lock/check and offline Base-copy verification on staged intentional source, exercise origin/drift/mode refusals and release only the selected licensed tree without credentials or private fixtures; source custody alone is not product acceptance.


## Complete support operations

- **DESK-001 — The shared support desk.** A visitor starts website live chat, identifies themselves under the workspace policy, sends files and returns to their history. Humans see one durable shared inbox with customer history, scoped retained-history search with words, quoted phrases and literal customer-identity matching, open/closed/mine/unassigned/AI/tag filters and saved replies that insert into the composer without silently sending. Replies, attachment downloads and errors are visible on both sides; privacy/collector controls remain effective.

  **Acceptance evidence:** Through the installed widget and operator inbox, exchange messages and real attachment bytes, search/filter the resulting queue, insert and edit a saved reply, reload both sides and deny another tenant the same records.

- **MAIL-001 — Complete support email.** Connect inbound forwarding, an IMAP/SMTP mailbox, Gmail/Google Workspace or Microsoft 365/Outlook using scoped credentials/OAuth. New mail creates tickets and replies thread by stable Message-ID/In-Reply-To/References with deliberate handling of changed subject, aliases and multiple recipients. Operators manage CC/BCC, attachments, signatures and branded sender/reply addresses. Duplicate/redelivered mail, bounces, spam and auto-responders cannot create loops or send twice; reconnect/backfill has a visible cursor and errors, and removal stops new intake without deleting history.

  **Acceptance evidence:** For each of forwarding, IMAP, Gmail and Microsoft 365, use the connection UI and real provider test accounts to receive a new thread, reply from the inbox, receive its follow-up and attachment, disconnect/reconnect with redelivery and observe bounce/permission failure. Verify no duplicate ticket/reply or machine-mail AI loop; keep provider-protocol tests separate from live acceptance.

- **CHANNELS-001 — Messaging and social support.** Connect US SMS through Twilio and WhatsApp Business, Instagram Direct and Facebook Messenger through authorized Meta business accounts. Inbound messages, supported media, delivery states and channel identity enter the shared inbox; replies return in the original channel. Respect consent, opt-out, A2P 10DLC registration, approved WhatsApp templates and channel reply windows; an expired window becomes an actionable blocker with an approved continuation, never silent loss or unauthorized cross-channel contact.

  **Acceptance evidence:** Using each connected provider account, exchange a customer message/media and operator reply in one mapped conversation, redeliver a signed event, revoke the connection and exercise opt-out and expired-window/template refusal with visible delivery failure and no duplicate send.

- **CHANNELS-002 — B2B shared-channel support.** Slack Connect and Microsoft Teams customer channels become authorized support intake, with thread replies, attachments, requester/account mapping and internal/private separation. The team can acknowledge, assign and hand off from Slack/Teams while the canonical support record retains the thread and current status. Installed-channel permissions, edited/deleted events, duplicates and disconnected channels have explicit behavior; Slack notifications alone do not satisfy this clause.

  **Acceptance evidence:** Install scoped Slack and Teams apps, open support threads from allowed customer channels, reply and assign from both surfaces and observe bidirectional updates/reconnect. A private note, disallowed channel or revoked workspace must never leak into customer channels.

- **VOICE-001 — Telephone service and unified voice agent.** Connect Aircall and Twilio Voice numbers for inbound/outbound customer support, business-hours routing, IVR, queues, transfers, voicemail and missed-call follow-up. Calls, consented recordings/transcripts and summaries attach to the customer conversation. The same governed AI procedures can serve voice, email and chat, with immediate human transfer and visible failed transfers; disclose automated agents and obtain recording consent under the configured US jurisdiction.

  **Acceptance evidence:** Call a connected support number through IVR to an agent, transfer to a human, leave voicemail after hours and call back from the inbox; verify consent, transcript/recording access, linked history, failed-transfer escalation and erasure. Use the provider-approved emergency-calling test procedure to verify number/location routing and disclosed limitations before launch. Repeat an approved procedure across voice/chat/email and inspect one consistent authority policy.

- **QUEUE-001 — Assignment rules and available teams.** Support leads define teams, membership, skills, capacity, availability and routing rules by channel, brand, language, account, tag or priority. Route to a named owner, team, round-robin or capacity-aware queue; explain which rule won, prevent starvation and preserve fair state across restarts. Manual takeover, absent/offline assignees, reassignment and unassigned overflow always leave a visible responsible queue.

  **Acceptance evidence:** Configure two teams and a round-robin rule through settings, admit concurrent tickets through real channel routes, change availability and restart; verify ownership, fairness, overflow, explainable decisions and current-role refusal on manual takeover.

- **QUEUE-002 — Structured and bulk queue work.** Operators manage workspace-scoped tags, typed/validated custom issue fields and priorities; saved views can filter and sort on them. Leads select tickets and bulk assign, tag, change priority/status or apply a permitted macro with a preview, per-record authority checks and a complete partial-failure result. Bulk actions cannot publish replies or reveal another workspace accidentally.

  **Acceptance evidence:** Create a custom field and priority view, bulk-update mixed eligible/stale/forbidden tickets from the inbox and reload; verify each permitted effect, rejected reason, audit and lack of cross-tenant changes.

- **QUEUE-003 — Collaboration without conflicting replies.** Internal notes and @mentions notify only permitted teammates; viewing, typing and unsent-draft indicators warn of collisions before send. Guarded send still refuses stale replies. Operators save personal/shared work views and reusable replies/macros with scoped permissions; private notes and drafts never appear in customer channels, forwarding or public history.

  **Acceptance evidence:** Use two signed-in operators on the same ticket: type, mention, save a view/reply, race sends and reload. Confirm early collision warnings, one admitted final reply, scoped mention delivery and no private content in the visitor transcript.

- **QUEUE-004 — Snooze and scheduled follow-up.** Snooze a ticket until an exact timezone-aware time or a dependency; incoming customer replies wake it immediately. Schedule outbound service replies, see/cancel/edit them before send and prevent stale queued replies after a customer response or reassignment. Each follow-up has a responsible owner, due time, stop condition and visible pending/failed/uncertain outcome; restarts cannot lose it or resend an ambiguous attempt.

  **Acceptance evidence:** From a ticket, snooze, schedule and cancel replies, then inject customer responses before/at the due time and restart the worker/executor. Observe a single wake/send or explicit refusal, overdue ownership and uncertainty without automatic replay.

- **SLA-001 — Business-hour service commitments.** Leads configure first/next response and resolution SLAs by priority, customer plan, channel and brand, using US IANA timezones, weekly hours and holiday calendars. Show due times and pause reasons in the queue; define waiting-on-customer and reopen semantics. Durable approaching-breach, breach and unattended-ticket alerts escalate to named backups through inbox/email/Slack/Teams and persist until acknowledged or resolved.

  **Acceptance evidence:** Configure two calendars and policies through settings; admit/reply/pause/reopen tickets across a holiday and DST boundary, restart and advance the test clock at the network/runtime edge. Compare displayed due times and breach/workload reports to hand calculations and confirm escalation/acknowledgement and no duplicate alerts.

- **AUTOMATION-001 — Explainable durable support workflows.** Leads version condition/action rules for routing, tagging, priority/status, reminders, customer updates and refund-exception escalation. Preview the effect against historical tickets in a workflow sandbox without real sends, then publish explicitly. Ordered/conflicting rules, loop prevention, owner, due time and stop condition are inspectable. Background execution persists decisions and failure/uncertainty across handoffs and restart; operators pause, cancel or reconcile work without blind retries.

  **Acceptance evidence:** Configure and simulate a route/tag/status/reminder rule through workflow settings; prove sandbox sends no external effects. Publish it, create matching/nonmatching tickets, cause a provider failure and process restart, inspect the chosen rule and terminal result and pause it before another side effect.

- **CONVERSATION-002 — Merge and external forwarding.** Merge duplicate tickets with an explicit surviving thread, source links, attribution, attachments, notes, SLA/outcome treatment and reversible history where safe. Forward selected customer-visible content to an external partner and thread their reply back while clearly distinguishing an external participant from a teammate. Customer identity, private notes and channel restrictions are previewed; merges cannot cross tenants or silently erase evidence.

  **Acceptance evidence:** Merge two duplicate tickets via the inbox, inspect both source histories and reports, then forward selected content to a partner and receive their reply. Verify no private note leaks, no duplicate customer send, explicit unsafe-undo refusal and no cross-workspace merge.

- **CUSTOMER-001 — Customer and company support records.** Maintain contacts, verified linked channel identities, companies/accounts, account members, custom attributes, consent/preferences and all interaction history. Link/unlink or merge identities with preview and source provenance; email text alone never grants access. Show current business-system context with last sync time, permission and unavailable/stale state, plus account-level open work and relationship history.

  **Acceptance evidence:** Open one customer arriving over chat/email/social, explicitly link their verified identities and company, inspect account tickets and edit attributes; attempt an unauthorized identity merge, deny another account history and show stale connector context after disconnect.

- **COMMERCE-001 — Shopify order actions.** Connect Shopify stores with merchant-granted scopes; show customer orders, fulfillment, delivery, return and refund state in the conversation. Authorized agents/humans can perform permitted return, cancellation and full/partial refund actions with USD amounts, tax/shipping implications and a reason. Preview the exact order/action, require the configured approval and limit, use provider idempotency and verify provider state before telling the customer it succeeded.

  **Acceptance evidence:** Connect a Shopify test store through settings, find a customer order from a ticket, approve a bounded partial refund/return or cancellation and read back the order/provider ledger. Deny excess/refused/revoked scopes, double clicks and cross-store access; a timeout remains pending/uncertain until reconciliation, with no second refund.

- **BILLING-001 — Stripe billing and subscription resolution.** Connect Stripe for customer/payment/invoice/subscription context and permitted refunds, credits and subscription cancellation, pause or plan changes. Show USD totals, tax/proration/effective-date consequences and linked provider records before approval; separate read, prepare, approve and execute scopes and spending limits. Reconcile actual provider state after timeout and report what changed in the original conversation. No raw card data or customer funds enter HappyToHelp.

  **Acceptance evidence:** From a support ticket linked to a Stripe test customer, inspect an invoice, approve a bounded refund and a subscription change and verify provider readback plus customer-visible results. Exercise duplicate requests, proration preview, denied approval and an uncertain timeout without double money movement.

- **CRM-001 — Live CRM and account context.** Connect Orbit, HubSpot and Salesforce independently; map contacts, companies/accounts, support entitlements, plan and owner to support records with source IDs and sync freshness. Read relevant CRM context and write only explicitly scoped support outcomes/approved field changes. Conflicts, identity mismatch and revoked grants are surfaced; the CRM remains the sales/account system of record.

  **Acceptance evidence:** For each named CRM, connect a test account through settings, map a customer, change source entitlement and refresh the ticket, publish an approved support outcome and disconnect. Verify conflict handling, read-only scope refusal and no cross-account data exposure.

- **ESCALATION-001 — Engineering and team escalations that return.** Create or link GitHub Issues, Linear and Jira issues and Slack/Teams handoffs from a conversation, choosing exactly what context/attachments to share. Persist reciprocal links, assignee, status and dependency; signed provider updates return to the support thread, wake its owner and draft a customer update when a fix ships. Issue closure alone never proves customer recovery; operators approve customer publication or grant an explicit bounded policy.

  **Acceptance evidence:** From a ticket, create/link an issue in each named tracker and a Slack/Teams handoff; receive duplicate/out-of-order provider status updates and close the issue. Verify one linked escalation, refreshed ticket state, private-content exclusion and an approved customer update with recovery still unconfirmed until observed.

- **API-001 — Owned API and managed connectors.** Expose a documented versioned HappyToHelp API and signed outbound webhooks for conversations, contacts, articles and support events with scoped authorization, pagination, stable cursors, idempotency and revocation. Provide Zapier actions/triggers and managed MCP tools with the same tenant/action boundaries. Offer Help Scout Inbox API/webhook read synchronization for staged migration/coexistence, with cursors and deduplication; it is separate from native API authority. Connection health, scopes, event attempts and manual reconciliation are visible.

  **Acceptance evidence:** Use a scoped client to page/export records and perform native guarded writes, validate a signed webhook and revoke the token. Exercise a Zapier trigger/action, MCP read versus denied write and Help Scout incremental ingestion with duplicate events/reconnect; verify no replay of old imports or erased identities.

- **MOVE-IN-002 — Switch from every named incumbent.** Provide guided one-click connection or export upload for Zendesk, Intercom, Help Scout and Freshdesk, covering contacts/companies, conversations/messages/attachments/private notes, tags/custom fields, ownership, timestamps and articles/categories/publication. Preview supported mappings and every unsupported field/rule/brand/permission; no silent truncation. Resume with source IDs, deduplicate a second run, perform an inert final delta cutover and explicitly repoint channels. Preserve links and counts; imports never activate automations or expose formerly private knowledge.

  **Acceptance evidence:** For each of the four vendors, use its documented export/API through Move in with representative realistic records, compare exact source/target counts and attachment bytes, inspect omission reports, resume/repeat/undo and final delta, then receive a new live message after channel cutover. Exercise role revocation and source redaction without accidental sends.

- **PORTAL-001 — Authenticated customer self-service.** A customer securely signs in to a branded portal to search permitted knowledge, create tickets with attachments, review/reply/reopen their own requests and manage notification preferences. Company-wide ticket visibility is an explicit entitlement, never inferred from an email domain. Identity recovery, revoked membership and inaccessible/deleted requests fail safely across web and mobile.

  **Acceptance evidence:** As two customer identities in different companies, sign in, create/reply/reopen a ticket and inspect its history; grant then revoke company visibility, recover identity and verify all unauthorized deep links and attachments are denied.

- **KNOWLEDGE-002 — Governed private and multilingual knowledge.** Support public and authenticated private help centers, multiple languages/locales, version history, editorial review, redirects and brand/domain publishing. Source refreshes and translated drafts preserve permissions and previous published versions; restricted knowledge is never exposed to public search, an unauthorized agent answer or another account. Agents may propose cited changes, while named editors control publication.

  **Acceptance evidence:** Publish an English article and reviewed translation, restrict an account-only collection, update/rollback a version and follow an old URL. Search and ask the agent as public, permitted and forbidden customers and verify permission-aware citations, locale fallback disclosure and failed-refresh preservation.

- **BRANDS-001 — Multi-brand support operations.** A business can manage distinct brands, mailboxes, widget identities, domains, help centers, signatures, channels and policies with deliberate shared teams and reporting. Route and report by brand without mixing customer identities, private knowledge or sender credentials. Cross-brand administration and customer handoffs require explicit access and a visible explanation.

  **Acceptance evidence:** Configure two brands with different domains/senders and a shared permitted team; receive and resolve messages from each, change one policy, inspect per-brand and aggregate reports and deny an unauthorized cross-brand customer/agent read.

- **ACCESS-001 — Enterprise identity and custom permissions.** Retain native owner/password access while optionally connecting Google Workspace, Microsoft Entra ID or Okta using SAML/OIDC SSO and SCIM provisioning. Define custom roles and field/tool/brand/team permissions for operators, admins, reviewers and agents; separate integration installation, refund approval, knowledge publication and destructive access. Deprovisioning/revocation promptly ends sessions, pending tool authority and customer-data access, with tested owner recovery.

  **Acceptance evidence:** Provision an operator through each supported identity protocol, assign a restricted custom role, attempt denied exports/refunds/publication, then deprovision during active work and verify sessions/tools lose access. Native owner recovery remains usable and cannot be replaced by provider configuration.

- **MOBILE-001 — Support from a phone.** Provide responsive operator/customer web flows and native iOS/Android operator apps for shared queues, push notifications, assignment, notes, attachments, knowledge, approval and reply. Show offline state and protect cached customer data; drafts may persist safely, but reconnect must revalidate role/frontier and scheduled effects. Deep links return to the correct permitted workspace and push payloads omit sensitive content by default.

  **Acceptance evidence:** At 1440 and 390 use realistic end-to-end web tickets; on iOS and Android receive a push, deep-link, assign/note/reply with attachment, go offline, lose authority and reconnect. Verify no stale duplicate send, leaked push content or retained cache after sign-out/revocation.

- **OUTCOMES-002 — CSAT across support channels.** Offer configurable post-resolution satisfaction surveys via widget, portal, email and permitted messaging channels with rating scale, optional comment, locale, send timing and opt-out. Associate one latest response with the exact resolution cycle and channel; preserve previous-cycle history and reconcile signed response links without requiring a widget session. Leads inspect low-score follow-up and customer recovery without auto-closing complaints.

  **Acceptance evidence:** Resolve tickets across the channels, receive/answer a survey as the eligible customer, rerate, reopen and revoke/expire a response link; compare cycle-level CSAT and opt-out behavior, ensure no duplicate invitation and verify erased comments disappear everywhere.

- **REPORTS-002 — Workload, service and agent outcomes.** Leads explore team/agent workload, backlog age, incoming volume, response/resolution time, SLA compliance, reopened requests, CSAT and AI containment/handoff/resolution by channel, brand, account, tag and procedure version. Publish inspectable numerators, denominators, timezone and exclusion rules; distinguish bot closure from verified resolution and include failures/unknowns. Export complete formula-safe records and schedule permission-scoped reports; no sampling or silent truncation.

  **Acceptance evidence:** Build a known multichannel cohort containing reassignment, reopen, AI handoff, SLA breach and imported history through public routes. Compare dashboard drill-downs, workload and scheduled CSV delivery to hand-calculated totals; revoke a recipient and verify private data is withheld.

- **AGENT-001 — A production support agent with clean handoff.** The AI agent answers using approved help-center content, permitted past conversations and fresh connected customer/product state, with citations, retrieval permissions and clear AI disclosure across chat/email/voice. Execute only enabled procedures/tools; distinguish advice, prepared action, approved execution and observed success. A customer can request a person; uncertain, low-evidence or disallowed actions transfer promptly with transcript, sources, attempted actions, failures and the next responsible human. The agent stops replying after handoff until explicitly resumed.

  **Acceptance evidence:** On representative real-provider channel journeys, ask grounded and unanswerable questions, attempt restricted retrieval/actions, request a human mid-tool-call and disconnect. Verify cited valid answers, no private leakage, no unauthorized tool call, durable handoff context and no competing post-handoff AI answer; record live evaluation separately from fixtures.

- **PROCEDURE-001 — Natural-language procedures and release simulation.** Support leads author versioned natural-language operating procedures tied to intents, knowledge versions, live data requirements, tools, approval gates, budgets and human escalation. Simulate paths, adversarial cases, provider errors, handoffs and permissions against redacted historical examples in an isolated workflow sandbox with no real actions. Per-procedure evaluations must pass declared outcomes before an authorized staged release; compare versions, stop/rollback a rollout and keep old cases reproducible.

  **Acceptance evidence:** Through procedure settings, draft a refund procedure, simulate allowed/denied/timeout/prompt-injection paths with network-edge fakes, inspect a failing case and prevent release. Approve a passing version into a bounded live cohort, revoke a tool and roll back; verify no sandbox external effect and exact version linkage in conversations.

- **AGENT-002 — Inspectable quality and resolution economics.** Operators inspect a redacted per-conversation/tool-call trace with source/version, requested scope, human approval, timings, provider outcome and verified result. Leads explore procedure-level evaluation coverage, resolution/reopen/handoff rates, failure clusters and provider costs/usage without treating attempted actions as success. Human labels and later customer outcomes can correct attribution; provider usage remains accounting evidence, not a customer balance or invented monetary saving.

  **Acceptance evidence:** Open production-run traces from a conversation and drill from a procedure report to supporting cases; include timeout, denied tool, handoff, negative CSAT and reopened outcomes. Compare rates and USD provider-cost estimates to raw usage and known denominators, redact secrets and show unavailable price data explicitly.

- **FEEDBACK-001 — Source-linked feedback and release follow-up.** Capture product feedback from a support conversation with the customer/account and supporting quote, link or create its request in Penny, and link engineering delivery in Vector or the buyer's issue tracker. Subscribe the affected requester to an approved service update when a linked feature/fix ships, respecting preference, channel policy and unresolved recovery. Penny owns aggregation, prioritization, roadmap/changelog and requester closure; HappyToHelp retains the support history and responsibility for the customer response.

  **Acceptance evidence:** From two related customer tickets, hand off source-linked feedback to Penny, associate an engineering issue and receive a release event; preview and approve requester updates, deduplicate events, honor opt-out and keep a still-failing customer request open.

- **ERASURE-001 — Customer erasure with coherent history.** Owner/admin contact erasure removes personal content from native/imported transcripts, notes, context, feedback, stored files and archive copies while retaining nonpersonal identity/frontier and an opaque erasure tombstone. Erasure fences APIs, pending events, source re-import and stale restore from resurrecting the identity. Provide completion/failed counts for all stores and separately request deletion from connected providers under their capabilities; do not claim already sent messages or offline archive bytes were recalled.

  **Acceptance evidence:** Erase a populated native/imported contact through the authorized owner route, inspect D1/R2 and the resulting export, retry a stale API/import and test role/cross-tenant denial. Verify coherent redacted threads, tombstone fencing and explicit unresolved external/old-archive deletion.

- **AUDIT-001 — Security and accountable actions.** Encrypt configured provider credentials under installation custody, never return secrets in ordinary reads/logs/exports and enforce tenant, role, origin and public rate limits at every door. Keep an inspectable, exportable append-only audit of authentication/permission changes, imports/exports/erasure, assignments, procedure changes, approvals and external actions with actor, purpose, source, time and outcome; redact erased actors without losing the event. Configure retention/legal holds with visible effects and never silently delete evidence to improve reports.

  **Acceptance evidence:** Using owner/security views, rotate/revoke credentials, attempt cross-tenant/CSRF/SSRF access, approve an action, export audit and erase its actor; inspect durable outcomes with no secrets. Apply retention/hold settings and verify protected records and report denominators survive restart and cleanup.

- **PORTABILITY-001 — Complete customer-owned portable support data.** Export versioned machine-readable conversations, attachments, contacts/companies, knowledge/versions, settings, rules/procedures/evaluations, outcomes and audit with a schema, integrity digest and explicit exclusions. Validate a bounded archive before atomic inactive restore to a clean installation; do not transfer sessions, provider secrets or connector authority and do not replay imported actions. Include D1, R2 and Durable Object business state or a lossless reconstruction; retain erasure fences and receiving-owner identity. This target replaces the current documented incomplete-storage boundary without pretending the held Base-data equivalence is done.

  **Acceptance evidence:** Through rer export/import and owner data controls, populate each business store, export, destroy the disposable source and restore to a clean installation. Compare every portable record and attachment byte, preserve erasure fences, refuse corrupt/oversized/nonempty targets and verify all restored work is inert until separately authorized. Include Durable Object history and interrupted actions.

- **ASSURANCE-001 — Qualified regulated support deployments.** US-first support uses USD, US provider contracts, IANA calendars and channel/recording consent controls. A regulated buyer can qualify an isolated deployment with required DPA/BAA, approved subprocessors/model data handling, access controls, audit, retention, incident response and validated deletion/export; health-data support is gated on those agreements and technical acceptance. The work remains a product obligation, with a named partner/provider path, rather than a claim that self-hosting alone supplies compliance.

  **Acceptance evidence:** Before enabling a regulated workspace, an authorized administrator records required executed agreements/provider settings and runs tenant isolation, permission, audit, retention, recovery and erasure journeys with representative sensitive data. Missing agreements/controls block that configuration visibly; verify access only after qualification and withdrawal upon expiry/revocation.


## Push further: accountable agents

- **PUSH-001 — Reproduce, repair and prove customer recovery.** Given the conversation, authorized live product state and an explicitly paired repair workspace, the agent reproduces the customer's failure, records its observation, prepares or performs only the permitted fix, and verifies with a distinct post-change read or user journey. Environment, operations, data, spending and time limits are granted by a named person; production changes and reply publication have separate authority. Reconcile started/uncertain work, gather customer-scoped recovery evidence, report in the original thread and reopen/escalate if recovery fails or the customer reports recurrence. A successful command or closed engineering issue never proves recovery.

  **Acceptance evidence:** Start with a real support request and reproducible product failure; pair the connector, run read-only reproduction, approve a bounded fix, independently observe the affected customer path and approve/send the original-thread report. Inject stale authority, uncertain change, failed verification, restart and later recurrence; verify no unapproved production effect/reply, truthful evidence and reopened ownership.

- **PUSH-002 — Promises survive every handoff.** The agent extracts explicit commitments, quoted evidence and dependencies from messages and linked issues into durable obligations with a responsible person, due time, current evidence and stop condition. Chase missing evidence internally, detect stale dependencies and draft an honest customer update before a promise expires. Humans accept material due-date or promise changes; no fabricated progress, invented commitment or unapproved customer message is allowed.

  **Acceptance evidence:** In a conversation promise a follow-up, link an engineering dependency, hand off twice and restart. Verify the same cited obligation, accepted owner/due-time changes, reminders and a timely draft; mark an evidence-free dependency stale and block any claim of completed progress until readback exists.

- **PUSH-003 — Learn from reopenings under human control.** The agent joins reopened requests, complaints, CSAT, procedure/tool versions and connected business outcomes to identify failed resolution paths. Propose a concrete procedure/policy change with cited cases, replay evaluation and expected effect; a human approves changed permissions/tools, spending limits and bounded rollout. Track actual post-release recovery and regression, stop/rollback on deterioration and preserve original procedure versions and dissenting evidence.

  **Acceptance evidence:** Create matched resolved/reopened cases under two procedure versions, inspect a proposed change and its replay set, reject then approve a limited rollout and inject regression. Verify only approved versions/actions run, before/after outcomes are attributable and rollback preserves all failure evidence.

- **PUSH-004 — Turn verified edge cases into reviewed knowledge.** The agent identifies unanswered or repeatedly reopened topics from permitted conversations, support searches and procedure failures, clusters the gap and drafts a sourced article/update from verified resolutions. Strip personal data, obey private/brand/locale boundaries and include the evidence and proposed scope. A named editor reviews publication/translation and the agent measures whether later customers recover, proposing corrections when they do not.

  **Acceptance evidence:** Resolve a previously undocumented case, trigger gap analysis, inspect a cited redacted draft, reject and then publish an edited version and ask the next customer's question. Verify permission-aware retrieval, no automatic publication, attribution and a corrective proposal when the case reopens.

## Honest boundaries and connected products

HappyToHelp owns customer support, its operational queue, service follow-up and support CSAT. It consumes sales/customer context from [Orbit](https://github.com/just-every/run-orbit), HubSpot and Salesforce; [Buoy](https://github.com/just-every/run-buoy) owns post-sale customer-success programs. [Penny](https://github.com/just-every/run-penny) owns feedback aggregation, prioritization, roadmap/changelog and requester closure; [Vector](https://github.com/just-every/run-vector) owns engineering issues and delivery. HappyToHelp links their records and follows the support request through verified recovery. General marketing campaigns go to [Mango](https://github.com/just-every/run-mango), incident subscriber communication to [Lamp](https://github.com/just-every/run-lamp), general survey research to [Pencil](https://github.com/just-every/run-pencil) and employee IT service management to [Linen](https://github.com/just-every/run-linen). No neighbouring product or unowned LIST gap is absorbed.

Aircall/Twilio and Meta operate the telephone/messaging networks and provider registration; HappyToHelp supplies the connected support experience, routing, consent and failure controls in VOICE-001 and CHANNELS-001. It does not become a carrier or emergency dispatch service: emergency callers are directed to 911 through the provider's supported routing and disclosed number/location limitations, while US emergency-calling obligations for supplied numbers must be qualified before voice launch. Stripe/Shopify execute authorized financial actions; HappyToHelp neither holds funds nor stores raw payment credentials. Commerce, CRM and subscription ledgers remain in their respective systems; complete support actions remain required here.

Arbitrary repair execution runs only in an explicitly paired external workspace, with per-operation authority, never as an implicit Worker capability. Provider apps, native apps, production integration qualification, health-data agreements, consent rules and payments-related support actions are engineering obligations in the named clauses, not reasons to reduce the target. Regulated deployments require ASSURANCE-001 qualification; no current HIPAA, SOC 2 or FedRAMP assurance is claimed. Provider acceptance is not customer receipt, a passing fixture is not a live deployment and a completed tool call is not a verified customer outcome. Existing accessibility and complete-storage holds remain in ACCEPTANCE.md until separately proven.

The platform admission index's `move_in_contact_keys.email_digest` remains lazy derived memoization. Exact business equality preserves its project/contact links and validates each populated digest against the native email; NULL-to-correct-digest does not alter business state. Contacts, native email, identity and all source/business links remain in the equality comparison.

## Current implementation status

Baseline: the 16 October inventory code audit at `c1aca8a2ccb2802411a95732239733f62264b81f`; current source inspected at `9e32211aef8bf9e44dbb6b622d4d35c873a5edc8`. Repeated vendor inventory rows map to the same buyer behavior. Expanded clauses are partial when existing code covers only part of the new obligation. Done requires implementation plus a cited test; missing means no implementation of the named behavior was located. Local, provider-fixture, hosted and regulated qualification remain distinct.

| Clause | Status | Evidence path and remaining scope |
| --- | --- | --- |
| NATIVE-001 | partial | `scripts/installer/local.mjs`; `tests/rer-journey.mjs`. Native command journeys exist; full portable storage remains incomplete. |
| IDENTITY-002 | done | `src/modules/identity/routes.ts`; `tests/identity.mjs`; `tests/identity-setup.mjs`. Native password identity is retained. |
| IDENTITY-001 | done | `src/modules/management/policy.ts`; `tests/identity.mjs`; `tests/abuse-limits-runtime.mjs`. Current tenant/role and public admission limits are implemented. |
| FIRST-RUN-001 | done | `src/modules/management/provisioning/index.ts`; `tests/provisioning.mjs`; `tests/first-release-journey.mjs`; `tests/first-run/profile-trust.mjs`. Provisioning and key-gated first use are implemented; live provider delivery is separate. |
| LOCAL-MAIL-001 | done | `src/modules/integrations/email.ts`; `tests/first-run/mail.mjs`. Local transport suppression has explicit outcomes. |
| CONVERSATION-001 | done | `src/modules/conversations/admission.ts`; `tests/conversation-admission.mjs`; `tests/contact-erasure.mjs`. Guarded transcript admission and erasure are implemented. |
| DELIVERY-001 | done | `src/modules/conversations/socket.ts`; `tests/conversation-socket.mjs`; `tests/first-release-journey.mjs`. Committed replay is distinct from provisional AI output. |
| UI-001 | done | `src/ui/dashboard`; `src/modules/widget`; `tests/mobile-inbox-browser.mjs`; `tests/inbox-conversation-browser.mjs`. Existing responsive experience is retained; broader native mobile and accessibility qualification have separate clauses. |
| MOVE-IN-001 | done | `src/modules/move-in/plan.ts`; `tests/move-in/capacity.mjs`; `tests/move-in/browser.mjs`; `tests/move-in/native-corrections.mjs`. Reviewed Zendesk/Help Scout history import is implemented; broader migration is MOVE-IN-002. |
| OUTCOMES-001 | done | `src/modules/outcomes/rating.ts`; `src/modules/outcomes/operator-feedback.ts`; `tests/reports/ratings.mjs`; `tests/reports/outcomes.mjs`. Resolution cycles and attribution are implemented. |
| REPORTS-001 | done | `src/modules/reports/routes.ts`; `src/modules/reports/metrics.ts`; `tests/reports/figures.mjs`; `tests/reports/calendar.mjs`. Current calendar/cohort reports and streaming CSV are implemented. |
| CONNECTIONS-001 | done | `src/modules/api-integrations`; `tests/connections/api.mjs`; `tests/connections/delivery.mjs`; `tests/connections/slack.mjs`. Native scoped API and Slack notification protocols are exercised with network-edge fixtures. |
| ACTIVATION-001 | done | `src/modules/management/activation`; `tests/activation-routes.mjs`; `tests/activation-provider-probes.mjs`; `tests/activation-migration.mjs`. Observed setup distinguishes configuration, suppression, provider acceptance and delivery. |
| AI-001 | done | `src/modules/ai-support/service.ts`; `tests/activation-spend.mjs`; `tests/first-release-journey.mjs`. Configured generation and daily caps exist; this is not full production-procedure qualification. |
| KNOWLEDGE-001 | done | `src/modules/knowledge/authoring.ts`; `src/modules/public-site/help-center.tsx`; `tests/knowledge-workerd.mjs`; `tests/public-help-center.mjs`. Public article/category authoring and scoped retrieval are implemented. |
| CONTEXT-001 | done | `src/modules/customer-context`; `tests/customer-context-routes.mjs`; `tests/customer-context/worker.test.mjs`. Attributed bounded context is implemented; live CRM/account records are separate targets. |
| DELEGATION-001 | done | `src/modules/local-computer/results.ts`; `src/edition/delegation/routes.ts`; `tests/delegation-journey.mjs`; `tests/delegation-authority-runtime.mjs`. Scoped connector authority is exercised; full recovery follow-through is PUSH-001. |
| TRAINING-001 | done | `src/modules/training-runs/runner.ts`; `src/edition/ai/training.ts`; `tests/training/checks.test.mjs`. Persisted evaluation infrastructure exists; governed procedure simulation is PROCEDURE-001. |
| INTEGRATION-001 | partial | `src/modules/integrations/inbound.ts`; `src/modules/integrations/github.ts`; `tests/email-provider.mjs`; `tests/github-integration.mjs`. Existing mail/GitHub adapters work at test boundaries; the newly required business connectors are missing. |
| PUBLIC-001 | done | `src/ui/homepage`; `tests/homepage-source.mjs`; `tests/public-site-runtime.mjs`; `tests/docs-site.mjs`. The owner-approved marketing and documentation surface is preserved verbatim. |
| MIGRATION-001 | done | `src/modules/legacy-import`; `tests/contact-erasure.mjs`; `tests/move-in/acceptance.mjs`. Legacy custody remains distinct from active financial actions. |
| SOURCE-001 | done | `scripts/edition-authoring/cli.mjs`; `tests/base-origin-verification.mjs`; `tests/base-copy-verification.mjs`. Maintained capability graph and source integrity checks exist. |
| DESK-001 | done | `src/modules/management/dashboard.ts`; `src/modules/management/inbox-search.ts`; `tests/first-release-journey.mjs`; `tests/inbox-search.mjs`; `tests/saved-reply-insertion.mjs`. The existing web desk is exercised. |
| MAIL-001 | partial | `src/modules/integrations/inbound.ts`; `src/modules/integrations/inbound-service.ts`; `src/modules/integrations/email.ts`; `tests/email-provider.mjs`; `tests/management.mjs`. Forwarded inbound and outbound adapters exist; full mailbox synchronization and Gmail/Microsoft connectors do not. |
| CHANNELS-001 | missing | No implementation located.. No SMS/Meta support channel implementation located. |
| CHANNELS-002 | partial | `src/modules/api-integrations/dispatch.ts`; `tests/connections/slack.mjs`. Slack notifications exist; customer intake, bidirectional Slack Connect and Teams are absent. |
| VOICE-001 | missing | No implementation located.. No voice routing/agent or Aircall connector implementation located. |
| QUEUE-001 | partial | `src/modules/management/dashboard-actions.ts`; `tests/management.mjs`. Manual human/AI assignment exists; configured team/round-robin routing does not. |
| QUEUE-002 | partial | `src/modules/management/tags.ts`; `src/modules/management/dashboard.ts`; `tests/management.mjs`. Tags and basic filters exist; custom fields, priority and bulk actions are absent. |
| QUEUE-003 | partial | `src/modules/management/dashboard-actions.ts`; `src/modules/conversations/admission.ts`; `tests/management.mjs`; `tests/first-release-journey.mjs`. Internal notes, saved replies, basic filters and stale-frontier guards exist; mentions, presence warnings and configurable saved views are incomplete. |
| QUEUE-004 | missing | No implementation located.. No durable snooze or scheduled-reply product implementation located. |
| SLA-001 | missing | No implementation located.. No SLA calendars, clocks or breach-alert engine located. |
| AUTOMATION-001 | partial | `src/modules/management/tags.ts`; `src/modules/management/dashboard-actions.ts`; `src/modules/api-integrations/dispatch.ts`; `tests/connections/delivery.mjs`. Manual effects and fixed events exist; configurable rules and workflow sandbox do not. |
| CONVERSATION-002 | partial | `src/modules/management/dashboard-actions.ts`; `tests/management.mjs`. Transcript emailing exists; duplicate merge and continuous external-forward threads are absent. |
| CUSTOMER-001 | partial | `src/modules/management/buckets.ts`; `src/modules/management/tracked-transcript.ts`; `src/modules/customer-context/profiles/prompt.js`; `tests/management.mjs`. Contact interaction history and attributed company hints exist; company/account records and cross-channel identity governance are incomplete. |
| COMMERCE-001 | missing | No implementation located.. No Shopify order/refund connector implementation located. |
| BILLING-001 | missing | No implementation located.. No active Stripe billing/subscription action connector located; legacy financial imports confer no action authority. |
| CRM-001 | missing | No implementation located.. No Orbit, HubSpot or Salesforce connector implementation located. |
| ESCALATION-001 | partial | `src/modules/integrations/github.ts`; `src/modules/integrations/repository.ts`; `src/modules/api-integrations/dispatch.ts`; `tests/github-integration.mjs`; `tests/connections/slack.mjs`. GitHub repository access and Slack notifications exist; live issue creation/status synchronization and Linear/Jira/Teams are absent. |
| API-001 | partial | `src/modules/api-integrations`; `local-agent/lib/mcp.mjs`; `src/modules/move-in/plan.ts`; `tests/connections/api.mjs`; `tests/connections/delivery.mjs`. Native API/webhooks, Help Scout export import and connector MCP transport exist; managed catalog, Zapier and continuous Help Scout synchronization do not. |
| MOVE-IN-002 | partial | `src/modules/move-in/plan.ts`; `tests/move-in/capacity.mjs`; `tests/move-in/helpscout-security.mjs`; `tests/move-in/browser.mjs`. Reviewed Zendesk/Help Scout historical import exists; full four-vendor guided migration, Intercom/Freshdesk history and delta cutover are incomplete. |
| PORTAL-001 | partial | `src/modules/identity/widget.ts`; `src/modules/widget/index.jsx`; `tests/widget-browser-runtime.mjs`. Scoped widget history exists; a standalone authenticated customer portal is absent. |
| KNOWLEDGE-002 | partial | `src/modules/knowledge/authoring.ts`; `src/modules/public-site/help-center.tsx`; `tests/public-help-center.mjs`; `tests/knowledge-workerd.mjs`. Public authoring/publication exists; private, multilingual and governed versioned centers are incomplete. |
| BRANDS-001 | partial | `src/modules/management/projects.ts`; `tests/management.mjs`. Separate workspaces exist; unified multi-brand governance and routing are absent. |
| ACCESS-001 | partial | `src/modules/management/policy.ts`; `src/modules/identity`; `tests/identity.mjs`; `tests/management-invitations.mjs`. Fixed native roles exist; custom roles, SSO and SCIM are absent. |
| MOBILE-001 | partial | `src/ui/dashboard`; `src/modules/widget`; `tests/mobile-inbox-browser.mjs`; `tests/reports/browser.mjs`. Responsive web journeys exist; native apps, mobile push and protected offline work are absent. |
| OUTCOMES-002 | partial | `src/modules/outcomes/rating.ts`; `tests/reports/ratings.mjs`; `tests/reports/widget-races.mjs`. Widget closed-cycle feedback exists; email/social survey distribution and configurable survey controls are incomplete. |
| REPORTS-002 | partial | `src/modules/reports/routes.ts`; `src/modules/reports/metrics.ts`; `tests/reports/figures.mjs`; `tests/reports/calendar.mjs`. Current response/outcome/CSAT reports exist; team workload, SLA and procedure/channel exploration and scheduled reports are incomplete. |
| AGENT-001 | partial | `src/modules/ai-support/service.ts`; `src/modules/knowledge`; `src/edition/delegation/routes.ts`; `tests/first-release-journey.mjs`; `tests/delegation-journey.mjs`. Configured AI and scoped local handoff exist; full multichannel, business-action and production-quality coverage is incomplete. |
| PROCEDURE-001 | partial | `src/modules/training-runs/runner.ts`; `src/edition/ai/training.ts`; `src/modules/management/resources.ts`; `tests/training/checks.test.mjs`. Assistant instructions and durable evaluations exist; versioned procedure simulation, workflow sandbox and controlled rollout do not. |
| AGENT-002 | partial | `src/edition/ai/training-trace.ts`; `src/modules/local-computer/results.ts`; `src/modules/reports/routes.ts`; `tests/reports/figures.mjs`; `tests/activation-spend.mjs`. Provider-round traces, training details and aggregate reports exist; full production tool/procedure exploration is incomplete. |
| FEEDBACK-001 | missing | No implementation located.. No Penny/Vector feedback and shipped-feature support follow-up implementation located. |
| ERASURE-001 | partial | `src/modules/management/contact-erasure`; `tests/contact-erasure.mjs`; `tests/contact-erasure-browser.mjs`. Local contact erasure/redaction and API fences exist; full future connector/native-app stores and provider erasure orchestration are incomplete. |
| AUDIT-001 | partial | `src/modules/api-integrations`; `src/modules/management/policy.ts`; `tests/connections/native-boundary.mjs`; `tests/security-headers.mjs`; `tests/contact-erasure.mjs`. Native authorization, scoped grants and integration audit exist; comprehensive security audit/retention/holds across all target channels are incomplete. |
| PORTABILITY-001 | partial | `scripts/installer/local.mjs`; `tests/rer-journey.mjs`; `tests/delegation-backup.py`; `tests/contact-erasure.mjs`. D1/R2/native transfer exists; ACCEPTANCE.md retains the explicit Durable Object/full-storage fidelity hold. |
| ASSURANCE-001 | missing | No implementation located.. No regulated-deployment agreement/control qualification flow or compliance acceptance located. |
| PUSH-001 | partial | `src/modules/local-computer/results.ts`; `src/edition/delegation/routes.ts`; `tests/delegation-journey.mjs`; `tests/helpers/delegation-journey/case.mjs`. Approved local repair, independent readback and human Send exist with an edge fixture; sustained customer recovery verification/reopening is incomplete. |
| PUSH-002 | partial | `src/modules/conversations/admission.ts`; `src/modules/management/dashboard-actions.ts`; `tests/management.mjs`. Durable messages/notes exist; extracted obligation records and autonomous owner chasing do not. |
| PUSH-003 | partial | `src/modules/training-runs/runner.ts`; `src/modules/reports/routes.ts`; `tests/reports/outcomes.mjs`; `tests/training/checks.test.mjs`. Evaluation and outcome feedback exist; joined version diagnosis, proposals and controlled rollout do not. |
| PUSH-004 | partial | `src/modules/knowledge/authoring.ts`; `src/modules/training-runs/runner.ts`; `tests/knowledge-workerd.mjs`. Authoring and evaluations exist; automatic gap detection and sourced resolved-case proposals do not. |
