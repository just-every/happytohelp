# Inbound email recovery

A repeated Message-ID must match the original project, recipient, sender, body,
conversation and attachment bytes. Conflicts are rejected before recovery.

Failed local processing can be retried by redelivering the identical email.
The service claims one retry, retains the conversation and attachment identities,
and admits one transcript message and outbox row. If admission already committed,
a repeat only repairs the receipt to `delivered`; it does not restart AI or email
provider work. Uncertain external outcomes require their separate reconciliation.

A `processing` receipt with no committed message may still have an active Worker.
It is never automatically released based on age. After confirming that invocation
has ended, an authenticated project owner/admin can read
`GET /api/management/projects/:projectId/inbound-emails/:messageId`, then POST the observed
`intent_hash`, `created_at`, `conversation_id` and `claim_token` as `intentHash`,
`createdAt`, `conversationId` and `claimToken`, with `priorExecutionEnded: true`, to
`/api/management/projects/:projectId/inbound-emails/:messageId/reconcile`. URL-encode the
Message-ID. The endpoint atomically marks only that observed processing attempt
failed if no transcript exists. A stale observation, wrong project, already
admitted message or competing reconciliation returns 409. Redeliver the identical
email afterward. The endpoint does not itself deliver mail or call providers.

The claim-token migration is additive; pre-migration receipts use a null token.

Automatic-mail classification is evidence, not identity: it is not part of the
intent hash. It is recorded on the claim before admission, so a lost completion
write still leaves the scheduler able to find it by the claim's local id and
conversation, and a redelivery (even one whose relay stripped the headers) keeps
the first classification. A failed receipt written before
`0104_inbound_email_classification.sql` is classified when it is next claimed.
