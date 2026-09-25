# AI assistance and execution source

This source carries HappyToHelp's retained assistance packet/evidence machinery,
two-pass suggestion protocol, model orchestration and selected Ensemble Worker
provider graph. The edition-specific service binds those capabilities to durable
conversation generation/admission. Vendor notices and exact source provenance are
under vendor/ensemble; keep them with the execution graph.

For a neutral consumer, select the five context paths in module.json: packet.js,
packetBounds.js, passEvidence.js, historyCursor.js and historyOutput.js. They need
no D1 schema, provider or inbox. They bound context while preserving source identity,
record omissions, validate cited IDs and retain useful tool/history evidence.
Provider execution and autonomous message sending are distinct
integrations and are not enabled by importing context helpers.

The generation service selects conversation and knowledge/customer-context.
Training is optional edition integration in `src/edition/ai/training.ts`; importing
AI assistance does not select the training runner. The service also uses edition
platform and notification/repository adapters; it is not an isolated deployable
folder. The root package lock supplies runtime dependencies.
Apply migration020 for durable generation state; per-round provider usage and
execution metadata remain raw diagnostic records. No payment, balance, debit or
Stripe behavior is part of this capability. Tests/ai-support exercises the
retained behavior and real Worker provider boundaries with test-only fixtures.

Generation work requires the edition's `GenerationEffects` adapter before it can
claim an attempt. `generation-provider.ts` owns context/provider execution,
`generation-currentness.ts` checks the captured source frontier, and
`generation-finalization.ts` retains conditional suggestion publication and atomic
reply admission. `service.ts` owns the claim and uncertain-outcome lifecycle;
`generation-queue.ts` recovers persisted work. Socket and notification effects live
in `src/edition/ai/generation-effects.ts` and never authorize provider replay.
Automatic replies with missing provider credentials persist an actionable failed
generation in AI logs without rejecting the already-saved customer message.
Visitor-caused generations are reserved against the daily ceilings in
`reply-ceiling.ts` (`AI_DAILY_CEILINGS`, see docs/PUBLIC-LIMITS.md); a ceiling hit is
recorded the same way, with an `AI_REPLY_CEILING:` reason, and is never queued or replayed.
That reason is operator-only: a visitor's explicit widget reply request past a ceiling
gets `AiReplyCeilingReached` (429, `Retry-After` until 00:00 UTC, a generic message).
