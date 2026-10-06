# Activation observations

The management router mounts `GET /projects/:projectId/activation`, `POST
/projects/:projectId/activation/check` and `POST /projects/:projectId/activation/test-mail`.
All require current owner/admin membership; sending test mail additionally requires
owner role and always targets that authenticated owner's current email address.
The public HTTP prefix is `/api/management`.

GET performs no provider requests. It compares stored fingerprints with current
configuration and invalidates changed observations. Model and DNS observations
expire after 15 minutes. Status checks are explicit, non-generative requests;
unsupported providers or insufficient metadata permissions stay unavailable.
Provider responses and credential fingerprints are never returned to the client.

Resend status adapters use its documented domain list/detail and sent-email
retrieval APIs. Domain completion requires matching domain identity plus verified
SPF/DKIM records plus T-021’s shared SPF, DKIM and DMARC TXT checks. Email send acceptance alone remains pending. Delivery completion
requires a matching message ID, current sender, exact owner recipient and
`last_event=delivered`; later bounce/failure invalidates it on explicit check.
A durable sendEmail command fences repeated clicks and uncertain sends. Neither
GET nor `/check` sends email.

Inbound observations capture the enabled mailbox and its settings version at
native inbound admission, using the migration trigger, then join the actual
delivered receipt and reconstruct its immutable recipient intent from a plain-text message without attachments. This rejects configuration races that could otherwise misattribute an old-address message. Old receipts are not backfilled. Checking sends nothing and
cannot trigger an AI/email loop. Widget observations are recorded only for
accepted authenticated contact `pingActive`/`pingAction` commands carrying the
current allowed origin, excluding owner preview. Changing origin removes them.

Article completion means the current project has a published article. It does
not establish retrieval eligibility or a real cited answer; those have separate
knowledge/runtime proof. Spend ceilings describe validated automatic-work
limits and their UTC reset, never a provider account hard billing cap.

Provider API references:
- https://resend.com/docs/api-reference/emails/retrieve-email
- https://resend.com/docs/api-reference/domains/get-domain
- https://resend.com/docs/api-reference/domains/list-domains
- https://platform.openai.com/docs/api-reference/models/retrieve
- https://platform.claude.com/docs/en/api/models/retrieve
- https://ai.google.dev/api/models
- https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key
- https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails

OpenRouter completion requires authenticated key metadata and the selected model
(using the generation registry’s provider ID) in the account-filtered model list.
It does not prove a paid generation.

Local tests intercept these HTTP boundaries only. They never establish real
provider permission, DNS propagation, delivery, generation or timed installation.
