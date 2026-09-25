# Personal data in HappyToHelp

This note is for the operator of a HappyToHelp installation: the person or team
that deploys it and answers customers with it. It describes what the code stores
and sends. It is not a privacy policy for your customers and is not legal advice.

## Where the data lives

Everything below is stored in the installation's own Cloudflare account:

- **D1** (`DB` binding): accounts, projects, contacts, conversations, messages,
  customer context, AI and email records.
- **R2** (`FILES` binding): uploaded files: conversation attachments, inbound email
  attachments, screenshots from paired computers, brand images and knowledge
  import staging files.

HappyToHelp has no central service that receives your customers' data. Data leaves
your account only through the providers you configure (see below).

## What is stored about a customer ("contact")

| Data | Where | Collected when |
| --- | --- | --- |
| Name, email, verified identifier (`external_id`) | `contacts` | The widget or your site supplies them, a contact edits them in the widget, an inbound email arrives, or an operator enters them. |
| Provided name/email, phone, blocked flag, last seen, widget open state, and any metadata your site signs with the verification secret (for example country, IP address, browser) | `contacts.metadata_json` | Widget session and presence events; operator edits. |
| Widget sessions | `sessions` (token hash, 30-day expiry) | Each widget session. |
| Messages | `messages` | Every message in a conversation, including operator and AI replies. |
| Attachments | `media` rows plus R2 objects | Widget, dashboard and inbound email uploads. |
| Page visits | `context_tracked_events` (`PAGE_VIEW` URLs) | The widget sends them when contact tracking is on for the project; they are stored only when the contact's customer-context consent is recorded (`context_subjects.consent`, set through the customer-context API or a legacy import). |
| Widget activity | `context_actions` | Same consent rule, and the bot must be enabled for the contact. Summarised and then deleted once a context model has analysed it. |
| Customer context: evidence, profiles, insights, activity summaries, context jobs | `context_*` tables | Built from the messages and activity above, by the configured context model. |
| Internal notes, participants, read state | `conversation_notes`, `conversation_participants`, `conversation_reads` | Operator actions and widget read receipts. |
| AI generations | `ai_generations` (instructions, the operator's draft and assist instructions in `options_json`, generated text), `ai_attempt_events` (provider event logs), `ai_round_usage` (token usage only) | AI replies, suggestions and draft assist. |
| Delegated work | `local_jobs`, `local_events`, `local_attachments` | When an operator sends a conversation to a paired computer. |
| Email delivery log | `email_deliveries` (recipient, subject, state; no message body) | Notification and transcript emails. |
| Inbound email evidence | `inbound_emails.evidence_json` (envelope sender, header From, subject and a fixed set of headers; the body becomes a message) | Each inbound email, to classify automatic mail. |
| Request counters | `abuse_counters` (limit name, a SHA-256 of the limited subject such as a visitor ID, conversation ID, client address or account ID, and a count; no raw address) | Visitor, registration and project-creation requests. Removed by the scheduled job once the window ends (at most one day). |
| Imported conversation buckets | `conversation_buckets.metadata_json` (the original bucket record, including any conversation summary) | Only if you imported data from the original HappyToHelp service. |
| Legacy import archive | `legacy_import_rows` (verbatim source rows) | Only if you imported data from the original HappyToHelp service. |

Operator accounts (name, email, password hash, sessions and settings) are stored in
the same database.

## What goes to providers you configure

Nothing is sent to a provider unless you set its credentials.

- **AI models** (OpenAI, Anthropic, Google, DeepSeek, xAI or OpenRouter, chosen per
  AI profile): to draft replies and suggestions, HappyToHelp sends the conversation
  transcript, the contact's name and email, internal notes, customer-context
  evidence (when consent is recorded) and the knowledge or conversation history its
  tools look up.
- **Context model** (`CONTEXT_MODEL`): contact messages, widget activity, evidence
  and existing profiles, to build profiles, summaries and insights.
- **Semantic knowledge search** (OpenAI embeddings and `QDRANT_URL`): search queries,
  which may contain text from a conversation. Indexed content is your published
  knowledge, not customer data.
- **GitHub** (when repositories are connected): repository searches made by the AI,
  which may contain text from a conversation.
- **Email** (`EMAIL_PROVIDER`: Resend, Cloudflare Email or SendGrid): reply
  notifications to contacts include the message text; operator notifications
  include the customer's message; transcript emails include the whole transcript.
  Inbound email is received through your configured mailbox.
- **Paired computers**: delegated work sends the conversation transcript, contact
  name and email, and internal notes to the operator's own paired computer. The
  agent running there may pass it to its own model provider.

Each provider keeps what it receives under its own terms. Erasure in HappyToHelp
does not reach copies already held by a provider or sent by email.

## Retention

HappyToHelp does not delete customer data on a schedule. Records stay until an
operator erases them. Exceptions: raw widget activity is replaced by summaries
once a context model has analysed it, and widget sessions stop working after
30 days (the row remains until erasure).

Deleting a project keeps its history ("retained history"), blocks its contacts and
removes all memberships, so nobody can sign in to erase contacts afterwards.
**Erase contacts before deleting a project**, or remove the data directly from your
D1 database and R2 bucket.

The existing **Delete** button on a contact only hides and blocks it. It does not
remove personal data.

## Erasing a contact

Owners and admins of the contact's project can erase it. Operators cannot.

- **Dashboard:** Contacts → select the contact → **Erase personal data…**, type
  `ERASE`, then **Permanently erase**.
- **API:** `POST /api/management/projects/{projectId}/contacts/{contactId}/erase`
  with an owner or admin session. The response is the erasure record.

Erasure works only inside the contact's own project and removes:

- the contact's name, email, identifier, verified flag and all metadata
- its widget sessions
- the content of every message in its conversations (customer, operator and AI
  messages) and any message it wrote elsewhere in the project, and each such
  message's client-supplied local ID, which becomes `erased:<message ID>` (the
  hashed `email:` ID of an inbound email, and the `generation:` ID linking an AI
  reply to its kept generation record, stay; a reply request's ID must be a UUID,
  so neither holds text a visitor or operator chose)
- their attachments, including the R2 objects, and screenshots from delegated work
  on those conversations
- page visits, widget activity, evidence, profiles, insights, summaries, context
  jobs and their provider logs
- internal notes on its conversations, its participant and read records
- AI instructions, the operator drafts and assist instructions sent with them,
  generated text and provider event logs for its conversations (token usage and
  the editing tool and request IDs are kept); queued or running AI replies are
  cancelled
- imported bucket summaries for its conversations (bucket IDs and times are kept)
- delegated-work instructions, context, results and progress for its conversations;
  active delegated work is cancelled
- its address in the email delivery log
- inbound email evidence on its conversations and messages or sent from its
  addresses (sender, subject and headers; only the automatic-mail classifier's
  reason names are kept)
- the verbatim legacy import copy of those records (the row digest is kept, so a
  repeated import of the same bundle does not restore them)

What remains: the contact row with only an ID and an "erased" flag, the
conversations (IDs, timestamps, assignment, status) and each message's ID, author
role, revision and time, with the content removed and marked erased. This keeps
conversation counts and transcript order intact for operators. A
`contact_erasures` row records who erased the contact, when, how many times, and
how many conversations, messages, attachments, tracked events, context records and
sessions were removed.

Request counters are not erased: they hold only a count under a SHA-256 key,
no name, email, address or content, and they expire within a day. Daily AI
ceiling counters are keyed by project or installation, not by contact.

Erasing the same contact again is safe. It removes anything added since, for
example an operator reply sent after the erasure, and adds to the counts. If an
erasure stops partway through, run it again to finish it. Objects to delete are
recorded in `contact_erasure_objects` until the database changes are committed.

Erasure cannot reach Cloudflare's own backups (D1 Time Travel keeps up to 30 days
of history) or anything already sent to a provider, an email inbox or a paired
computer.

## Exporting a contact's data

There is no single-click export. To answer an access request, a member of the project can:

- read the contact record: `GET /api/management/projects/{projectId}/contacts/{contactId}`
- find the contact's conversations (search matches name or email):
  `GET /api/dashboard/projects/{projectId}/conversations?view=all&q={email}`, then read
  each transcript with attachment metadata: `GET /api/conversations/{conversationId}/messages`
- download attachments: `GET /api/conversations/{conversationId}/media/{mediaId}`
- email a transcript from the conversation's contact menu (**Email conversation**)
- query D1 directly (`wrangler d1 execute`, filtering on the contact's
  `project_id` and `id`/`subject_id` in the tables above), or take a full copy with
  `wrangler d1 export`.
