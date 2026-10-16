# Configured cited-answer journey

Run `node --test tests/journeys/ai-live.mjs` with BASE_URL, WIDGET_KEY,
OPERATOR_EMAIL and OPERATOR_PASSWORD loaded privately into the environment.
The configured project must allow BASE_URL as its widget origin, have an enabled
customer AI as its default responder, and have a published native refund policy.
LIVE_QUESTION and ARTICLE_URL can select a different policy and its actual
published canonical URL. The suite uses headless Chromium, the real widget,
API, model, D1 and sockets. Missing core environment skips the journey
explicitly; it never installs provider fixtures or retries a failed generation.

The journey asks two customer questions, checks the cited answer in the widget
and inbox, requests human handoff, and checks the persisted operator reply's
WebSocket identity/content and its exact single occurrence after widget reload.
Run once in a fresh disposable installation/project under an authorized provider
budget. A failed journey is evidence to inspect, not permission to rerun paid work.

## Bound and record real model requests

Use the native pre-dispatch counter procedure below before starting the journey.
A fresh installation avoids cumulative daily allowance and unrelated work. Do not
raise a used allowance or use another project to replay a failed generation.

1. In the private deployment environment, set the one-run automatic reply cap:

   ```sh
   export AI_DAILY_CEILINGS='{"repliesPerProject":2,"repliesPerInstallation":2,"spendUsdPerProject":1}'
   unset CONTEXT_MODEL LEAD_MODEL BRAND_IMAGE_MODEL KNOWLEDGE_EMBEDDING_MODEL
   ```

   Apply this configuration through the authorized rer deployment, preserving
   existing private credentials. Verify the effective deployed configuration;
   unsetting a local variable alone does not prove a saved remote value is absent.
   Disable workspace page-view tracking. The test explicitly sets the widget's
   `collector.enabled=false`. Do not run operator Generate/assist, provider probes,
   crawls, semantic embedding, training/evaluation, lead or brand actions during
   this proof. Leave ancillary provider configuration unset.

2. Set `LIVE_D1_NAME` to the exact owned DB name from the deployment receipt and
   `LIVE_EVIDENCE_DIR` to a private directory outside source. With the pinned
   account ID and account token loaded privately, define this read-only snapshot:

   ```sh
   umask 077
   mkdir -p "$LIVE_EVIDENCE_DIR"
   chmod 700 "$LIVE_EVIDENCE_DIR"
   snapshot_model_counts() {
     pnpm exec wrangler d1 execute "$LIVE_D1_NAME" --remote --json --command "SELECT json_extract(event_json, '$.request_id') AS request_id, attempt_id, COUNT(*) AS agent_start_events FROM ai_attempt_events WHERE type='agent_start' GROUP BY request_id, attempt_id ORDER BY attempt_id, request_id; SELECT request_id, attempt_id, model, observed, usage_json FROM ai_round_usage GROUP BY request_id, attempt_id ORDER BY attempt_id, request_id; SELECT COUNT(*) AS context_jobs FROM context_jobs; SELECT id, project_id, kind, state FROM ai_generations ORDER BY created_at;" > "$LIVE_EVIDENCE_DIR/model-count-$1.json"
   }
   snapshot_model_counts before
   ```

   Inspect the JSON before starting: a fresh run has no `agent_start` or
   `ai_round_usage` rows, no prior generations and **zero `context_jobs`**.
   Keep only request identities, event counts, model and usage in evidence; do not
   export event payloads, prompts, credentials or private session state.

3. Check `sysctl -n vm.loadavg` before starting Chromium; defer heavy work while
   the one-minute load exceeds 36. Execute exactly one journey and always capture
   the after snapshot, even on failure. The subshell returns its exit status:

   ```sh
   (
     if nice -n 15 node --test --test-concurrency=2 tests/journeys/ai-live.mjs; then
       journey_status=0
     else
       journey_status=$?
     fi
     if snapshot_model_counts after; then
       snapshot_status=0
     else
       snapshot_status=$?
     fi
     if [ "$snapshot_status" -ne 0 ]; then exit "$snapshot_status"; fi
     exit "$journey_status"
   )
   ```

   Compare before/after rows grouped by `request_id` and `attempt_id`: at most
   two admitted automatic generations, at most four unique request IDs per
   attempt, at most eight new request IDs in total, and still zero `context_jobs`.
   Retain both snapshots and the test result. An unexpected row, missing snapshot
   or ancillary call leaves the cap proof incomplete; investigate without replay.

The selected engine awaits persistence of each `agent_start` before advancing
into provider dispatch. Its maximum is **four tool rounds per generation**,
including the final response within that loop, and **zero provider retries**;
there is no extra fifth final request. Two generations therefore admit at most
**eight** requests in this isolated procedure. `AI_DAILY_CEILINGS` caps automatic
generations and accounted spend; it is not a provider transport request counter
or a guarantee that the final in-flight request costs less than the spend cap.
The round limit and persisted dispatch accounting establish the request bound.

Every `agent_start` is conservative **pre-dispatch** evidence: a local failure
can persist a row without reaching the provider. `ai_round_usage` starts with
`observed=0`; `observed=1` with `usage_json` records provider-observed usage. Report
both counts separately; missing usage is unknown, never zero. No request can
reach the selected transport without its pre-dispatch row. This procedure uses
the native transport and does not replace it with fixtures, a proxy or retries.

## Mailbox delivery and authentication

TEST_MAIL_TO and MAILBOX_RECEIPT_URL additionally enable sending the transcript
and polling a QA mailbox. Without both, mail is explicitly skipped. The receipt
endpoint must return JSON shaped as `{ "receipts": [{ "excerpt": "…", "auth":
{ "dmarc": "pass" } }] }`: the same receipt must contain the exact operator reply
and receiver authentication `auth.dmarc=pass`. A provider acceptance alone is not
mailbox delivery or receiver authentication. Keep mailbox URLs with credentials
private. Hosted revision and live-provider qualification require separate
evidence; this spec does not deploy or release anything.

Activation can call `isArticleEligibleForAI(env, projectId, articleId)` exported by
`src/modules/knowledge/index.ts` for "Used by AI answers". Retrieval calls this
same function. Eligibility means published in an active project, not a count of
past answers. `GET /api/management/projects/:projectId/email-settings/check-domain`
checks the saved sender's domain (owner/admin only). Optional `selector` chooses
the provider's DKIM selector (default `resend`). `checkSenderDomain` exports an
injectable TXT resolver; each SPF, DKIM and DMARC result is present, missing or
unknown. These are DNS record-presence checks, not provider domain qualification.
