Run `node --test tests/live/cited-answer.mjs` with BASE_URL, WIDGET_KEY,
OPERATOR_EMAIL and OPERATOR_PASSWORD. The configured project must allow BASE_URL
as its widget origin, have an enabled customer AI as its default responder, and
have a published native refund policy. LIVE_QUESTION and ARTICLE_URL can select
a different policy and expected canonical URL. The suite uses headless Chromium,
the real widget, API, model, D1 and sockets. Missing core environment skips the
journey explicitly; it never installs provider fixtures or retries a failed
model generation. It asks two customer questions; with the engine's four tool-round
ceiling plus final response per generation this permits at most ten model requests. Run in a private
disposable project, with a transport counter/cap when live provider keys are used.

TEST_MAIL_TO and MAILBOX_RECEIPT_URL additionally enable sending the transcript
and polling a test mailbox receipt for the exact operator reply. Without both,
mail is explicitly skipped (Q-3-0001). A provider acceptance alone is not a
mailbox delivery receipt. Hosted revision/tag qualification is separately blocked
by Q-0-0007 and Q-3-0001; this spec does not deploy or release anything.

T-022 can call `isArticleEligibleForAI(env, projectId, articleId)` exported by
`src/modules/knowledge/index.ts` for "Used by AI answers". Retrieval calls this
same function. Eligibility means published in an active project, not a count of
past answers. `GET /api/management/projects/:projectId/email-settings/check-domain`
checks the saved sender's domain (owner/admin only). Optional `selector` chooses
the provider's DKIM selector (default `resend`). `checkSenderDomain` exports an
injectable TXT resolver; each SPF, DKIM and DMARC result is present, missing or
unknown. These are DNS record-presence checks, not provider domain qualification.
