# Native HappyToHelp evaluation

These are the retained HappyToHelp Chat suggestion, human-voice, blind-review,
monitoring, reply and profile evaluation harnesses. Original baseline fixtures
remain byte-for-byte in fixtures/baseline. They are comparison evidence; runtime
comparators use the frozen prompt/schema with an explicit native context adapter.
No PHP, Docker, Bookshelf or MySQL is required or invoked.

Start the native edition locally and set ENABLE_SYNTHETIC_EVALUATION=true in its
local Worker variables. In the host shell set H2H_EVAL_SERVER to a loopback origin,
H2H_EVAL_TOKEN to a local owner session and H2H_EVAL_PROJECT_ID to that session's
workspace. `node scripts/eval/seed-local.js` posts the explicit synthetic fixture
and namespace confirmation. Select the returned synthetic project in the native
UI and use its owner session for subsequent evaluations. The seeder refuses to
replace an existing non-fixture project, preserves changed/incomplete prior
fixtures, seeds no paid usage, and provides the 16 conversations, long history,
ready/draft/restricted knowledge and explicit fixture screenshot.

`node scripts/eval/run.js --limit-cases=1` validates and prints the original
case/model/variant plan without provider calls. `--live` uses the native durable
training route, not an in-process legacy model adapter. Set H2H_EVAL_MAX_CASE_COST
and H2H_EVAL_MAX_TOKENS explicitly before a paid run. The Worker also requires a
real provider key and conservative TRAINING_PRICE_CEILINGS. Every provider attempt
is persisted, bounded and never automatically replayed after an ambiguous result.
A timed-out host poll reports its durable nativeRunId; inspect it before another
run. Native request/session secrets are never printed or placed in query URLs.

The original system entry commands remain under system/{run,replies,profiles}.js.
Human-voice checks and context fixtures remain in assist-human-voice.js; its live
entry uses the native executor. Blind review, image metadata observation and
unmetered tool-summary detection retain the original independent classifications.

Offline verification: the training case of
`node --test tests/journeys/ai.mjs`. The original opt-in live human-voice
test remains explicitly skipped without its provider opt-in. Local workerd/D1
state transitions, recovery and seeding are tested separately by
`node tests/journeys/delegation-computers.mjs`. No live-provider quality follows from
these fixture checks.
