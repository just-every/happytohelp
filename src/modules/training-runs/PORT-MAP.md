# Training and local-computer migration map

| Original source | Native source and verification |
| --- | --- |
| HappyToHelp PHP LocalAgentPairing/DeviceAuthorization/TaskSession services | local-computer/devices.ts and authorization.ts; real workerd tests single-use pairing and redemption, pending approval, no ready marker on creation, active task rotation refusal and grant revocation |
| DelegationClaim/Heartbeat/ContextSnapshot | jobs.ts, devices.ts, edition.ts; scoped immutable claimed context, fresh context, live membership, capacity SQL, claim identity, notes and configured folders |
| DelegationResult/ResultOptions/Attachment services | results.ts, presentation.ts; persisted effect recovery, exact-ID conditional reply admission, explicit proposals/children, attachment ownership and private R2 screenshot routes |
| Original local-agent Node connector | local-agent source retained, original 35 isolated-fixture tests; actual Codex/Claude/MCP adapters and durable local receipts |
| Original connector packaging | scripts/build-local-agent.cjs retained whitelist; generated public/downloads archive; setup.ts origin-derived guide/download API |
| Chat scripts/eval/checks.js and fixture.js | training-runs/checks/index.mjs; original16-case fixture and original4 checks tests |
| Chat scripts/eval/run.js and blind-review.js | scripts/eval retained planning and blind review; native-client persists each real attempt through training-runs routes |
| Human-voice fixture/context/semantic evaluator | scripts/eval/assist-human-voice.js, tests/eval-harness/fixtures, pure Worker checker human-voice.mjs; original semantics tests preserved |
| Human-voice live entry | native durable adapter with actual selected assist runtime; opt-in provider test remains explicit |
| Eval instrumentation/image observer/tool-summary audit | retained original source and tests; original frozen fixture bytes remain comparison evidence |
| System monitoring cases and adapters | retained cases + native serialized context transport; AI training-system uses retained analysis/insight prompt/schema/evidence builders |
| System profile fixtures and adapter | profile-execution.v2.json retained; actual native profile prompt/schema/validation runtime |
| System customer replies | original selected six cases retained; native reply packet and prompt executor |
| Frozen baseline and legacy UI comparison | original fixtures retained; baseline.js helper extracts frozen baseline instruction/schema with explicitly identified native context adapter; no claim of identical old runtime |
| PHP synthetic suggestions seeder | seed.ts owner/loopback/explicit-namespace guarded native D1/R2 fixture writer; no PHP, provider usage, or overwrite of unrelated data; actual16-conversation local test |
| MySQL reply lifecycle verification tool | replaced by actual native admission/effect/recovery runtime tests; obsolete executable removed |

Training request matrices persist their complete planning input and case IDs,
write bounded pages, and dispatch durable batches of ten. Recovery reconstructs
interrupted planning, resends missed queue dispatch, and classifies expired paid
attempts as uncertain without replay. Reservations remain held when exact cost is
missing. The selected real executor enforces a conservative preflight budget.

This map establishes source/runtime-test coverage, not model quality. Existing
expected checks can fail when selected models/tool contexts do not meet them;
the evaluator retains those failures. Only explicit provider runs can establish
provider results. Exact old context assembly and historical baseline runtime are
comparison provenance, not a claim that the old MySQL application still runs.

Current local checks: original connector 35/35; retained suggestion evaluator4/4;
expanded evaluation harness15 passed and1 intentionally skipped live-provider test;
workerd/D1/R2 lifecycle/recovery/seeder integration passed. The final edition build
and real selected-provider branch checks are owned by the integrating lead/AI worker.
