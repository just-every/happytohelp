# Training and evaluation runs

Select this directory and migrations/040_training_runs.sql. Mount trainingRoutes
at /api/training and dispatch persisted `training` queue jobs through
`executeTrainingRun(env,id,executor)`. The executor contract is independent of a
conversation schema and receives the selected model, case, output-token limit,
cost reservation and stable attempt identity. The edition supplies real AI execution.

The checker is the existing HappyToHelp Chat scripts/eval/checks.js, converted to ESM without
changing its evidence IDs, per-card checks, private-note leakage, language, tool,
image-input, completion-claim and quality-versus-harness failure classification.
The synthetic 16-case fixture and original evalChecks suite are under tests/training.
No synthetic data is installed in the application.

Native runs persist a bounded case/model matrix, reserve each case's share of a
run budget before invocation, store exact outputs in private R2 artifacts, and
retain usage and checks separately. Started calls never replay on queue redelivery.
Exceptions or missing exact cost become uncertain and retain the reservation.
Cancellation stops queued work; it cannot assert an already-started paid call did
not happen. A later queue continuation processes at most ten cases per dispatch.
Native execution supports prototype, baseline and legacy-ui comparator variants,
and monitoring, profile, human-voice and customer-reply case families. Historical
comparator prompts/schemas use an explicitly identified native context adapter;
they are not represented as identical historical runtime execution.

Dataset refresh/ingestion remains the knowledge capability's responsibility.
Evaluation checks passing does not establish provider quality or live-provider
acceptance. Tests may inject providers; application execution never fabricates one.

The edition executor requires TRAINING_PRICE_CEILINGS with explicit model input/output upper rates. It rejects insufficient reservations before provider execution. Unknown costs stay reserved and block automatic continuation.

Scheduled integration calls recoverTrainingRuns(env) to repair interrupted planning/queue dispatch and expire abandoned attempts as uncertain. Full port inventory is PORT-MAP.md.
