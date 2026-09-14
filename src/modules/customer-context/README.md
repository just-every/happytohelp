# Customer context

Native D1 collector admission, durable monitoring/profile jobs, bounded evidence,
correction/retraction, summary compaction and optional public personalization.
The edition mounts authenticated routes and dispatches `context.run` jobs to
`consumeContextJob`; scheduled recovery requeues only durable queued jobs.

The `profiles/` and `monitoring/` implementations are ported from
`happytohelp-chat` bce98c897ec5743dcf243311b6c1886b1057f5e3, with ESM imports for
Workers. They retain the original evidence limits, prompt/schema rules,
provenance, privacy, no-op and correction logic. The collector adapter replaces
MySQL row locks with guarded D1 batches, stable local event identities, the
6/8/14/20 action thresholds, four-second completion interval and six-minute
uncertain-attempt boundary. Dismissal cooldowns retain 1/7/30/182 days.

`enqueueContextJob` requires an explicit model and persisted subject settings.
Contact monitoring/profiling needs consent and an enabled bot; public copy sees
only approved broad categories and approved content, never private history.
The provider adapter executes the shared Ensemble engine without mutation tools,
records attempt events and usage, and fails if the configured provider is absent.
Interrupted started attempts become uncertain and are not retried. An operator
can explicitly abandon an uncertain job; this does not replay or prove its
provider outcome.

`collectActions` and `trackEvents` accept replay-safe local IDs. The widget
adapter checks the durable contact/conversation/project relationship and does
not infer consent. New insights and profiles publish only if their captured
source revision remains current. Summary compaction removes only IDs included
in that exact bounded request. Raw evidence and jobs are private operational data.

Tests under `tests/customer-context` retain original pure regressions and execute
native Worker/D1 admission, compaction, retraction, consent races and interrupted
jobs. Model responses in these tests are explicit fixtures; they do not establish
configured provider quality, cost or deployment acceptance.
