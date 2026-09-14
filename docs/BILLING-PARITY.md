# Native billing parity

The native integration preserves the original BillingController and Charge model's checkout/setup, automatic credit, invoice and receipt links. Currency is explicit per account; currently supported currencies use two decimal settlement units. Provider operations retain durable idempotency identities and ambiguous calls are never replayed automatically.

Actual recorded provider request costs debit balances at six decimal places, matching the original balance precision. Generation and training terminal hooks account for persisted request rounds, including spent failed work. Missing usage is a durable unresolved receipt, never a zero-cost assumption. Non-USD accounts require an explicit USD conversion rate; settled conversions are immutable. The conversion endpoint can resolve pending conversions and set the policy for future usage.

Daily usage and exhaustion estimates derive from the most recent seven UTC calendar days of recorded ledger usage. This replaces the original metadata estimate with observed native usage; missing usage or conversion suppresses exhaustion estimates. It does not claim a price forecast for an unobserved AI tier.

`node tests/billing.mjs` and `node tests/billing-workerd.mjs` exercise real local D1, precise debits, duplicate/conflicting identities, missing-to-known settlement, currency conversion, signed payment receipts and real Stripe HTTP adapter document retrieval against test-only responses. No external provider call or deployment is part of this proof.

Context monitoring/profile/summary requests settle from persisted request events after terminal completion, including uncertain work. Aggregate usage is excluded whenever request rounds exist. Brand-image dispatches likewise settle observed costs; token-only usage remains unresolved. Scheduled recovery processes at most 100 changed terminal jobs per source, checkpointing durable evidence versions and explicit conversion policy so old unknown costs cannot starve new work. Platform-global lead operations have no invented project charge.

Automatic top-ups require an existing, non-deleted project in both candidate selection and the atomic claim. Tests cover deletion before selection and between selection and claim, with zero Stripe dispatches. Accounting tests additionally cover running-job exclusion, per-request totals, missing-to-known recovery, ledger-write/checkpoint crashes, and unchanged-checkpoint no-op recovery.
