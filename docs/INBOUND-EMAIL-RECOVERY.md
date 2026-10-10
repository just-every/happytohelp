# Inbound email recovery

Use this page when an email sent to your HappyToHelp mailbox did not end up in a
conversation, for example because processing failed or was cut off partway. In
most cases the fix is to deliver the same email again. If the email is stuck
part-way through processing, an owner or admin first releases it through the
management API, then delivers it again.

This page is for workspace owners and admins, and for whoever runs the mail
relay that delivers email to HappyToHelp. Setting up incoming email in the first
place is covered in
[Email and integrations](../src/modules/integrations/README.md#receive-email).

## How HappyToHelp tracks each incoming email

HappyToHelp keeps a record, called a **receipt**, for every incoming email. The
receipt is identified by the email's `Message-ID` and has a `state`:

- `processing`: HappyToHelp has claimed the email and is working on it.
- `failed`: processing stopped with an error and can be retried.
- `delivered`: the message is in the conversation's transcript.

Adding the message to a conversation (called **admission**) also queues its
follow-up work, such as an AI reply and notifications, in an **outbox** record.
The message and its outbox record are written together, so you never get one
without the other.

## Deliver a failed email again

If processing failed, deliver the **identical** email again. A repeated
`Message-ID` must match the original exactly: the same workspace, recipient,
sender, body, conversation and attachment bytes. If anything differs,
HappyToHelp rejects the delivery as a conflict before any recovery starts.

What happens to the repeated delivery depends on how far the first attempt got:

- **The message was never added to the conversation** (the receipt is
  `failed`). HappyToHelp claims the email for one retry. The retry reuses the
  same conversation and the same attachment records, and adds exactly one
  message to the transcript and one outbox record.
- **The message was already added** (only the final "delivered" update was
  lost). The repeat only corrects the receipt to `delivered`. It does not start
  the AI reply or any email-provider work again.

Some external work may have an uncertain outcome, such as an AI reply or an
outgoing email that may or may not have gone through. Redelivering the inbound
email does not settle that; it needs its own separate reconciliation.

## Release an email stuck in processing

A receipt can stay in `processing` with no message in the conversation. That
can mean the run that was handling it (a Cloudflare Worker invocation) is still
going, so HappyToHelp never releases it automatically, however old it is.
Redelivering the email while it is still `processing` does not retry it.

Once you have confirmed that the earlier run has ended, an owner or admin of
the workspace can release the receipt:

1. Read the receipt. URL-encode the `Message-ID` wherever it appears in a path
   (for example, `<abc@example.com>` becomes `%3Cabc%40example.com%3E`):

   ```
   GET /api/management/projects/:projectId/inbound-emails/:messageId
   ```

2. From the response, note these four fields exactly as returned:
   `intent_hash`, `created_at`, `conversation_id` and `claim_token`.

3. Send them back, renamed to `intentHash`, `createdAt`, `conversationId` and
   `claimToken`, together with `"priorExecutionEnded": true`:

   ```
   POST /api/management/projects/:projectId/inbound-emails/:messageId/reconcile
   ```

   ```json
   {
     "intentHash": "<intent_hash from step 2>",
     "createdAt": <created_at number from step 2>,
     "conversationId": "<conversation_id from step 2, or null>",
     "claimToken": "<claim_token from step 2, or null>",
     "priorExecutionEnded": true
   }
   ```

   Copy `createdAt` as a number, and keep `null` values as `null`.

4. Deliver the identical email again.

The release marks only the attempt you observed as `failed`, and only if no
message from it is in the transcript. It is a single atomic update. It does not
deliver mail or call any provider itself; step 4 does the actual retry.

The request is refused with HTTP 409 when:

- your observation is stale (the receipt changed after you read it),
- the email belongs to a different workspace,
- the message has already been added to the conversation,
- another release of the same receipt got there first, or
- `priorExecutionEnded` is not `true`.

Only workspace owners and admins can use these two endpoints. Other roles, and
anyone who is not a member of the workspace in the path, get HTTP 403.

## Receipts from before claim tokens

Claim tokens were added by an additive migration
(`0100_inbound_email_claims.sql`). Receipts written before it have a `null`
`claim_token`; send `"claimToken": null` for those.

## Automatic mail during recovery

HappyToHelp labels machine-generated mail (out-of-office replies, bounces,
mailing-list mail and similar) as **automatic** and never answers it
automatically; see
[How automatic email is handled](../OPERATIONS.md#how-automatic-email-is-handled). Recovery
keeps that label stable:

- The classification is supporting evidence, not part of the email's identity,
  so it is not included in the `intent_hash`.
- It is recorded when the email is claimed, before the message is added to the
  conversation. If the final "delivered" update is lost, the scheduler (which
  replays pending follow-up work) can still find the classification through the
  claim's local ID and conversation.
- A redelivery keeps the first classification, even if the relay that
  redelivered it stripped the headers.
- A failed receipt written before `0104_inbound_email_classification.sql` is
  classified the next time it is claimed.
