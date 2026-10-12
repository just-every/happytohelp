# Email and integrations

This page is for whoever sets up HappyToHelp for a team. It explains how to
connect three kinds of outside service, all of them optional:

- **Email**, to send sign-in links, invitations and conversation notifications, and
  to receive customer emails as support conversations.
- **GitHub**, so your team and the AI can read and search repositories you choose.
- **OpenAI for lead outreach**, which drafts outreach emails for platform
  administrators to review and send. Most teams don't need this.

You switch each one on with environment variables and secrets. The full list, and how
setup and deploy copy them to your installation (or to `.dev.vars` when you run it
locally), is in
[Optional features and their settings](../../../OPERATIONS.md#optional-features-and-their-settings).
AI providers are set up there too.

Nothing is faked. If a feature needs a provider you haven't configured, it says the
feature is unavailable. HappyToHelp never pretends to send mail or invents a
provider's answer. Stand-in providers exist only in the automated tests.

A few words used on this page: a **contact** is a customer who writes to you; an
**operator** is a member of your team who answers customers (the dashboard calls
this role **Agent**); a **workspace** is one support space with its own inbox,
settings and members. Setting names and API paths call a workspace a *project*.

## Send email

### Choose a provider

Set `EMAIL_PROVIDER` to pick a provider, then give it a key and a sender address.
[Optional features and their settings](../../../OPERATIONS.md#optional-features-and-their-settings) explains where
these go. If you already use one of these providers, pick that one. Cloudflare
Email Sending needs the Workers Paid plan.

| Provider | `EMAIL_PROVIDER` | Also set |
| --- | --- | --- |
| Resend | `resend` (the default when `EMAIL_PROVIDER` is not set) | `EMAIL_API_KEY`, `EMAIL_FROM` |
| SendGrid | `sendgrid` | `EMAIL_API_KEY`, `EMAIL_FROM` |
| Cloudflare Email Sending | `cloudflare` | `EMAIL_API_KEY`, `EMAIL_FROM` and `EMAIL_ACCOUNT_ID` (your 32-character Cloudflare account ID) |

`EMAIL_FROM` is the default sender. Each workspace can set its own sender on its
**Email** settings page (**Support Email From Address** and **Support Email From
Name**); mail sent for that workspace uses those instead.

### Extra steps for Cloudflare Email Sending

1. Create a dedicated Cloudflare API token with the **Email Sending: Edit**
   permission and use it as `EMAIL_API_KEY`. Never reuse the token the installer
   uses to provision your Cloudflare resources. HappyToHelp sends through
   Cloudflare's REST API.
2. Make sure your account is on the Workers Paid plan, and onboard your sender
   domain to Email Sending, with the domain using Cloudflare DNS. Both are required
   to send mail to customers in general.

Cloudflare's inbound Email Routing and its free sending to verified destination
addresses are separate capabilities from this.

### What HappyToHelp sends

Once a provider is configured, all of these go through it:

- email sign-in links, password recovery, email verification and invitations;
- conversation notifications: an email to the assigned operator when a contact
  writes, and an email to the contact when someone replies (skipped while the
  contact has been active in the chat widget in the last 90 seconds). These are
  sent only when the workspace's email settings are enabled (**Enable receiving
  email** on the **Email** page);
- conversation transcripts that an operator chooses to email;
- reviewed lead emails (see [Lead outreach](#lead-outreach)).

### What "sent" means

- Finishing email setup in the installer does not verify your domain and does not
  prove that mail arrives.
- A message marked `sent` means the provider accepted it (queued mail counts). It
  does not mean the message reached an inbox.
- Cloudflare's REST API reports an outcome for each recipient but no message ID, so
  for Cloudflare the stored provider ID is empty (null).

### How HappyToHelp avoids duplicate emails

Every email has a delivery identity made from its recipient, content and sender.
HappyToHelp keeps a record of each delivery in the `sending`, `sent`, `failed` or
`uncertain` state.

A delivery is `uncertain` when HappyToHelp can't tell whether the provider accepted
it, for example after a provider server error or a lost response. Uncertain
deliveries are never repeated automatically, to avoid sending the same email
twice; check with your provider before you try again.

## Receive email

Customers can email your support address, and their replies to HappyToHelp's emails
land back in the same conversation.

### Set up an inbound address

1. On the workspace's **Email** settings page, enter a **Receive Email Address** and
   tick **Enable receiving email**. Any email sent to that address creates a
   support conversation. Use a plain address without a `+`; each address can belong
   to only one active workspace.
2. Route mail for that address to HappyToHelp in one of the three ways below. Your
   email routing must deliver that mailbox, or a catch-all, to the Worker.
3. Keep inbound mail on a dedicated subdomain, so your main domain's existing MX
   records stay unchanged.

Notification emails use a reply address of the form
`mailbox+conversationId@domain`. When a contact replies to one, HappyToHelp adds the
reply to that conversation, but only if the sender is that conversation's contact in
that workspace.

The Email Worker and the SendGrid route read the MIME message and its HTML, store
attachments in R2 and add the email to the conversation as a message from the
contact. However it arrives, one email can carry up to 20 attachments of up to
20 MB each, and up to 100,000 characters of text.

### Option 1: Cloudflare Email Worker

Point Cloudflare Email Routing for your inbound address (or a catch-all) at the
HappyToHelp Worker. The Worker handles the email directly. It rejects messages
larger than 25 MB.

### Option 2: SendGrid Inbound Parse

1. Choose a long random value and set it as the `INBOUND_EMAIL_TOKEN` secret.
2. In SendGrid, set the Inbound Parse destination to
   `https://<your HappyToHelp address>/api/integrations/email/sendgrid/inbound`
   (the route is `POST /api/integrations/email/sendgrid/inbound`).
3. Send the token in an `Authorization` header, either as `Bearer <token>` or with
   Basic authentication, where the token is the password and the username is not
   checked. Use a `?token=` query parameter only if your gateway cannot set an
   authorization header.

The route accepts requests up to 30 MB.

### Option 3: Your own JSON gateway

If another service receives your mail, it can post each email as JSON to
`POST /api/integrations/email/inbound` with the header
`Authorization: Bearer <INBOUND_EMAIL_TOKEN>`.

- Required fields: `messageId`, `to`, `from` and `text`.
- Also forward the optional `envelopeFrom`, `subject` and `headers` (an object of
  header names to values). Without them, HappyToHelp can't tell when mail is
  automatic, and an out-of-office reply may be treated as a customer message (see
  the next section).

A new email gets HTTP 201; a repeat of one already received gets HTTP 200.

If processing an inbound email is interrupted, see
[Inbound email recovery](../../../docs/INBOUND-EMAIL-RECOVERY.md).

## Out-of-office replies, bounces and other automatic mail

HappyToHelp answers customers on its own, so it must never answer a machine: that
could start an endless loop of auto-replies.

Mail that a machine generated is still added to the conversation and shown to your
team like any other message, labelled **automatic** in the dashboard (hover over the
label to see why). But it never gets an AI reply and never triggers a notification,
either when it first arrives or when the scheduler later replays pending work.

### What counts as automatic mail

A message is automatic if any of these are true:

- it has one of these headers marking it as automatic: `Auto-Submitted`,
  `Precedence`, `X-Auto-Response-Suppress`, `List-Id`, `List-Unsubscribe`,
  `X-Autoreply` or `X-Autorespond`;
- the sender is `mailer-daemon` or `postmaster`, or a `no-reply` or `do-not-reply`
  address;
- the return path is empty (a null sender);
- the subject *starts* with an autoresponder prefix such as `Automatic reply:`,
  `Out of Office:`, `Undeliverable:` or `Delivery Status Notification`.

A customer who merely uses those words in a sentence is still treated as a customer.

### Other rules for incoming mail

- **A null envelope sender is refused, not added.** The Email Worker rejects it
  with `Envelope sender required`, and the SendGrid route returns HTTP 400. Bounces
  sent to a null return path are therefore refused.
- **Who the contact is.** For the Email Worker and the SendGrid route, only the
  envelope sender decides who the contact is; the `From` header never selects a
  contact. For your own JSON gateway, the `from` field (the sender your gateway
  authenticated) picks the contact; `envelopeFrom` is only used to classify the
  email.
- **The first classification sticks.** HappyToHelp decides whether a message is
  automatic, and saves that answer with its reasons and evidence, before it adds the
  message to the conversation. If the same email is delivered again, the first
  answer is kept.

### Emails HappyToHelp sends are marked as automatic too

Conversation notifications sent through Resend or SendGrid carry
`Auto-Submitted` (`auto-replied` for an AI reply, otherwise `auto-generated`) and
`X-Auto-Response-Suppress: All`, so the recipient's autoresponder stays quiet.
Notifications sent through Cloudflare Email Sending carry no custom headers until
Cloudflare's list of allowed headers has been verified.

### Details for developers

- The rules live in [`email-classification.ts`](email-classification.ts). The
  saved evidence is bounded: the envelope sender, the header From, the subject and
  the `Auto-Submitted`, `Precedence`, `X-Auto-Response-Suppress`, `List-Id`,
  `List-Unsubscribe`, `X-Autoreply`/`X-Autorespond`, `Return-Path` and threading
  headers. All three ways in (the Email Worker, the SendGrid route and the JSON
  gateway) keep it.
- The classification, its reasons and the evidence are written to the inbound
  claim before admission
  ([`0104_inbound_email_classification.sql`](../../../migrations/0104_inbound_email_classification.sql)).
  For an automatic message, `applyMessageEffects` and `scheduleInboundEffects`
  request no AI reply and send no notification.
- The transcript API and the dashboard buckets expose `message.origin`
  (`{channel:'email',automatic,reasons}`). Owners and admins can read the stored
  evidence with `GET /api/management/projects/:projectId/inbound-emails/:messageId`.
- Message local IDs starting with `email:` are reserved for inbound emails, and
  `POST /api/conversations/:id/messages` refuses them. It also refuses `erased:`
  IDs, which contact erasure writes.

## Check your sender domain's DNS records

Email providers expect SPF, DKIM and DMARC records on your sending domain. Workspace
owners and admins can check that they exist with:

```
GET /api/management/projects/:projectId/email-settings/check-domain?selector=resend
```

- The check uses the domain of the workspace's saved sender address, so save one on
  the **Email** page first.
- `selector` is your DKIM selector. It depends on your provider; when you leave it
  out, `resend` is used.
- Each missing record is named. If a lookup fails, the result is "unknown", never a
  pass.
- This only checks that the records exist. It is not your provider's domain
  verification and does not prove that mail is delivered.

For developers: the check is
`checkSenderDomain(domain, resolver, dkimSelector)`, which looks up SPF, DKIM and
DMARC TXT records with an injectable resolver.

## Connect GitHub

Connecting GitHub lets your team and the AI read and search repositories you
choose, to answer questions about your code.

### Give HappyToHelp access

There are three ways. If a workspace has more than one, HappyToHelp uses the first
that applies, in this order.

1. **Connect with OAuth (from the dashboard).**
   1. Create a GitHub OAuth app and set its callback URL to
      `https://<your HappyToHelp address>/api/management/github/callback`.
   2. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and
      `INTEGRATION_ENCRYPTION_KEY`. The key is a base64-encoded 32-byte AES key
      (`openssl rand -base64 32` makes one). Don't change it later without migrating
      the stored connections.
   3. As a workspace owner or admin, open the workspace's **GitHub** settings and click
      **Connect GitHub**. HappyToHelp asks GitHub for the `repo` and `read:org`
      scopes.

   Each connection request works once, expires after 10 minutes and is tied to you
   and the workspace. HappyToHelp stores the resulting token encrypted with AES-GCM, bound
   to the workspace.
2. **A token per workspace:** set `GITHUB_TOKENS` to a JSON map of project IDs to
   tokens.
3. **One token for one workspace:** set `GITHUB_TOKEN`, and set `GITHUB_PROJECT_ID`
   to the ID of the workspace it belongs to.

Tokens set with `GITHUB_TOKENS` or `GITHUB_TOKEN` can be any kind of token scoped to
the workspace, including GitHub App installation tokens; HappyToHelp doesn't assume
which kind it is.

### Choose repositories and who can use them

- **With OAuth**, click **Load repositories** to list the connected GitHub user's
  repositories (the 100 most recently updated), then tick the ones to use.
- **With a token**, HappyToHelp doesn't list your account's repositories (GitHub App
  installation tokens can't use `/user/repos`). Instead it checks each repository
  in the workspace's saved list by reading it.

A workspace can select up to 50 repositories. Enter each repository’s owner and
name separated by a slash. Under
**Access**, choose separately whether operators (**Allow agents**) and customers
(**Allow contacts**) may use them.

### What the AI can and can't read

- Only the exact repositories you selected.
- Only bounded text files; binary and oversized files are refused.
- Never secret paths such as `.env` files, `.git`, SSH and cloud credential folders
  or private key files.
- Credentials found in file content (private keys, API tokens, passwords) are
  redacted.

For developers: a large file is read in chunks. Every chunk keeps the ref that was
selected, and each later chunk passes the previous blob `sha` as `expected_sha` (a
blob SHA is not a Git ref). If the file changes between chunks, the read fails and
the caller starts again at offset zero.

### Disconnect

Click **Disconnect** on the **GitHub** settings page. This removes the OAuth
credentials and clears the workspace's repository selection and access settings.

## Lead outreach

Platform administrators (users listed in the installation's `platform_admins`
table) can have HappyToHelp draft outreach emails to potential customers. It
needs `OPENAI_API_KEY` and an explicitly set `LEAD_MODEL`.

1. A queued job reads a bounded amount of text from the lead's public website and
   drafts an email grounded in that text.
2. You review the draft. A draft must be reviewed before it can be emailed.
3. You send it through your configured email provider.

Queued jobs pick up again after an interruption. If an attempt was interrupted
after the call to OpenAI had started, it is marked `uncertain` and needs a person
to check it. The usage reported for each attempt is recorded.

## No payments or billing

HappyToHelp has no payments, checkout, Stripe integration, account balance or
billing. For AI and training runs it keeps the raw usage your providers report and
the budgets you set for each run, to help you diagnose problems and keep runs within
bounds. Those records never create a charge or debit anyone's balance.

## For developers: what the automated tests cover

`tests/email-provider.mjs`, `tests/cloudflare-email.mjs`, `tests/email-worker.mjs`,
`tests/email-classification.mjs`, `tests/email-recovery.mjs`,
`tests/sendgrid-inbound.mjs`, `tests/sendgrid-email.mjs`,
`tests/github-integration.mjs` and `tests/lead-operations.mjs` exercise local
storage and test-only stand-ins for the outside services. They don't prove live
delivery by a provider, acceptance of a GitHub OAuth sign-in, provider costs or a
working deployment.

## Provider documentation this page follows

- Cloudflare, checked 17 September 2026:
  [sending guide](https://developers.cloudflare.com/email-service/get-started/send-emails/),
  [REST response and errors](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
- SendGrid, checked 20 September 2026:
  [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send),
  [Inbound Parse setup](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook),
  [parse webhook security](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/securing-your-parse-webhooks).
