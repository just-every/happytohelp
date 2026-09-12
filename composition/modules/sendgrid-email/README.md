# SendGrid email transport

Explicit optional cross-family transport for native sign-in and outbound mail.
Support Lily and Beacon select it for operator sign-in and outbound replies;
Sales Ferry and Orbit select it for native authentication mail. The family
composition descriptors select this Base module and copy its editable source;
no family depends on another family at runtime. Each edition owns its auth and
durable mail workflow, including the treatment of ambiguous submission results.
The installer copies `src/` to `src/modules/sendgrid-email/`. Edition adapters
select SendGrid through configuration and map results into their durable send
workflow; missing credentials fail visibly. No provider fallback is performed.

`sendSendGrid` submits one authenticated request to the global SendGrid v3 Mail
Send endpoint. It retains the `X-Message-Id` receipt from a 202 response and
reports `accepted`, never `delivered`. `custom_args.rer_delivery_id` carries the
local durable command identity for correlation; it is not an idempotency key.
The declared API does not offer a duplicate-suppression key, so a lost response,
server error, or missing receipt is ambiguous and must be reconciled before
another submission. The module performs no retries. Rate limiting and definite
client rejection are separate errors. Provider response bodies and API keys are
never included in errors.

Callers provide a verified sender, recipient snapshots, body, optional reply
address/thread headers and base64 attachments. Open and click tracking are off so
authentication and message links are not rewritten by the transport.

This module does not implement SendGrid inbound parsing or delivery webhooks.
Support uses Lily's public intake and Beacon's widget for incoming messages.
Resend inbound email remains separately configurable where selected. Verified
SendGrid delivery evidence would require an explicitly configured signed Event
Webhook, its public key, raw-payload signature verification, durable event
deduplication and recipient-scoped reconciliation. An accepted receipt alone is
not evidence of delivery.

Official provider references checked 12 September 2026:

- [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send)
- [X-Message-ID receipt](https://www.twilio.com/docs/sendgrid/glossary/x-message-id)
- [Event Webhook signature verification](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features)

Run `pnpm verify:modules` from the Base repository. The source and protocol tests
were promoted unchanged from the Support transport; family assembly copies the
module tests into each selected edition for its composition verification.
Tests inject a provider HTTP response only within the test suite; production uses
the actual fetch transport. Live sending requires the owner's intended recipient.
