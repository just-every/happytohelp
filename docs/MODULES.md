# Reusable source capabilities

Modules are selected source, with ordinary edition integration. The paths remain
where the product authors edit them. Every capability has module.json metadata;
edition.json records this application's actual selection. The table identifies
portable entry points and the integration work they require. Full application
routes additionally use `src/platform` identity, environment and D1 contracts.

| Component | Useful source / integration contract | Storage and verification inputs |
| --- | --- | --- |
| `runeditrun/conversation` | `conversations/admission.ts` conditional writer; `socket.ts` persisted replay and delivery; edition chooses participants, permission and reply policy | 0002, 0004, 0007 migrations; conversation admission/socket tests |
| `runeditrun/widget` | `widget/index.jsx` mountWidget with API origin, public widget key and target; independent browser source, Shadow DOM and native transport | build-widget script, transport/browser/lost-response tests; compatible conversation/identity API required |
| `runeditrun/ai-support` | `assist/` evidence packet, history, two-pass suggestions; selected `llm/` and Ensemble text/tool runtime; `service.ts` native generation lifecycle | 020 migration and ai-support tests; generation policy binds to conversation; training adapter is an optional integration entry |
| `runeditrun/knowledge` | ingestion/publication, search, citations and refresh; project identity plus D1/R2 and configured crawler/embedding/vector adapters | 0050–0053 migrations and knowledge tests; published corpus survives failed refresh |
| `runeditrun/customer-context` | monitoring and attributed profile builders/validation, durable contextual work and personalization; consumer chooses identities/consent | both 0060 migration files and customer-context tests; configured neutral AI execution |
| `runeditrun/local-computer` | explicit Integration interface for authorization/context/reply admission; paired real Node connector and existing-session MCP | 030 migration, local-agent tests, native lifecycle test; actual process execution stays on paired host |
| `runeditrun/training-runs` | durable bounded matrix, artifacts/checks, recovery, explicit TrainingExecutor; original evaluation harnesses | 040–041 migrations, training/eval-harness tests; uncertain provider attempts are retained |
| `runeditrun/plugin-sdk` | plugin UI message contract, host bridge and policy; consumer owns allowed plugin origins | standalone SDK tests; no provider or conversation database dependency |
| `runeditrun/site-preview` | isolated preview proxy, project-scoped temporary grant, asset handling and request bounds; consumer supplies auth/origin policy | 0096 migration and preview tests; separate preview origin required |

The remaining identity, management, email/integration, public-site,
legacy-import, dashboard and bootstrapping paths are edition integration. They
remain editable source and can be extracted later when a real second use
establishes a useful boundary. The public-site integration is limited to the
simple local-owner landing page and dynamic published help centers; its former
marketing, pricing, waitlist, referrer and homepage-widget paths are retired.
The customer widget module remains an independently installable support surface.
An implementation's directory name alone is not an independent component
contract.

`requires` in this edition's recipe describes the complete selected integration.
AI assistance, customer context and training reference each other's optional entry
points, so the integrated graph includes them together. Consumers need not import
those entry points. The context-only selection in ai-support/module.json is five
self-contained ESM files: packet, packetBounds, passEvidence, historyCursor and
historyOutput. It has no provider/storage import and preserves evidence IDs,
omission metadata, bounded newest-first context and recoverable history cursors.
The Beacon exercise adopts this source in an existing preparation path while
keeping mandatory human review and its original provider interface.

Migration filenames are current identities, not a proposed reorder. Each module's
sourcePaths lists the actual files to carry. Aggregate tests such as the delegation
runtime include its real edition dependencies; their passing result does not imply
that an isolated folder with missing adapters will run. Package dependencies and
third-party notices are covered by the root locked package and provenance notes.

The recipe cycles describe optional HappyToHelp adapter imports, not a portable
engine dependency cycle. For example, AI `training.ts` is the edition executor
for the training runner; it is unnecessary for standalone packet construction.
The local-computer `contracts.ts` Integration interface separates delivery from
its `edition.ts` conversation adapter. Training `contracts.ts` defines the
TrainingExecutor; this edition retains raw observed provider rounds and bounded
run budgets without an active payment, balance or Stripe ledger. Selecting full
routes carries these edition dependencies; selecting neutral builders does not
silently include them.
