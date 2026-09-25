# Public request limits and daily AI ceilings

The widget key and allowed origin are public. A client outside a browser can send
any `Origin`, so the customer-facing API is bounded by counters stored in D1
(`abuse_counters`, migration `0102_public_abuse_limits.sql`). No Cloudflare rate-limit
binding is required. Counters use fixed UTC-aligned windows (daily windows reset at
00:00 UTC). They are keyed by a SHA-256 of the limited subject, so raw client
addresses are never stored. The scheduled handler deletes expired counters.

## Request limits (`RATE_LIMITS`)

A request over a limit gets HTTP 429 with a `Retry-After` header (exposed to the
widget cross-origin) and a JSON body
`{"error": "<visitor-readable message>", "code": "rate_limited", "limit": "<name>", "retryAfter": <seconds>}`.
A refused request consumes nothing. When a request is checked against several
limits, either all of them take capacity or none does. The widget shows the message
and marks the unsent message as failed. It never resends a refused message later on
its own. Refused background telemetry is dropped quietly.

| Name | Default | Scope |
| --- | --- | --- |
| `widgetSessionsPerIpHour` | 30 | widget sessions per project widget key and client address |
| `widgetSessionsPerProjectHour` | 5000 | widget sessions (and the visitor contacts they create) per project, across all addresses |
| `conversationsPerContactHour` | 10 | new conversations per visitor |
| `conversationsPerIpHour` | 30 | new visitor conversations per project and client address |
| `conversationsPerProjectHour` | 5000 | new visitor conversations per project, across all visitors and addresses |
| `messagesPerConversationMinute` | 15 | visitor messages per conversation |
| `messagesPerContactHour` | 120 | visitor messages per visitor |
| `widgetEventsPerContactMinute` | 120 | widget commands and telemetry per visitor |
| `uploadsPerContactDay` | 30 | visitor attachments per day (each is still at most 20 MB) |
| `uploadBytesPerContactDay` | 100000000 | visitor attachment bytes per day |
| `uploadsPerProjectDay` | 5000 | visitor attachments per project per day, across all visitors |
| `uploadBytesPerProjectDay` | 5000000000 | visitor attachment bytes per project per day, across all visitors |
| `registrationsPerIpDay` | 5 | self-registrations per client address (`REGISTRATION_ENABLED=true`) |
| `projectsPerIpDay` | 10 | project creation and registration verification per client address |
| `projectsPerAccountDay` | 10 | projects one account can create per day |

To override any subset, set the variable to a JSON object, for example
`RATE_LIMITS={"messagesPerConversationMinute":30}`. Values must be positive integers.
Unknown names and invalid values are rejected at deployment. At runtime they fail
requests visibly and never remove a limit silently.

The client address is Cloudflare's `CF-Connecting-IP`. IPv6 addresses are grouped by
/64. When that header is missing (local tooling), every caller shares one `unknown`
bucket. Visitors behind one shared address (an office NAT, a mobile carrier) share
that address's session and conversation limits. Raise those limits for audiences
like that.

The per-address and per-visitor limits stop one client. A client that rotates
addresses gets a new visitor for each session, so those limits alone would let it
create unbounded sessions, contacts, conversations and attachments. The
`…PerProject…` ceilings bound that per project; they are checked together with the
per-address and per-visitor limits, and a refusal by any of them returns the
capacity the others took. The widget opens a session and a conversation for each
new visitor, so the hourly project ceilings are the number of new visitors a project
can take per UTC hour. The defaults sit well above a busy site's real traffic; raise
them if yours has more. Past a project ceiling, new visitors of that project see a
"very busy" message (or that attachments are unavailable) until the window resets.
Returning visitors keep their sessions and conversations, and other projects are
unaffected.

Signed-in project members (owners, admins, operators) are not limited on
conversation, message or upload routes.

## Daily AI ceilings (`AI_DAILY_CEILINGS`)

These ceilings cover every AI generation a visitor causes: automatic replies to
widget messages and inbound email, replies to insight answers, and explicit widget
reply requests. They also cover the customer-context monitoring runs that visitor
activity starts. Operator-requested drafts and suggestions are not covered.

| Name | Default | Meaning |
| --- | --- | --- |
| `repliesPerProject` | 200 | automatic replies admitted per project per UTC day |
| `spendUsdPerProject` | 10 | estimated USD spend on a project's automatic replies per UTC day |
| `repliesPerInstallation` | 2000 | automatic replies across all projects per UTC day |
| `contextRunsPerProject` | 500 | visitor-triggered context monitoring runs per project per UTC day |

`spendUsdPerProject` may be fractional. The spend estimate adds up the cost the
provider reports for each round of each automatic reply. It covers only rounds that
have already reported, so replies still in flight can overshoot the ceiling by their
own cost. Once a ceiling is reached, the visitor's message is still saved and
delivered to operators. The automatic reply is recorded as a terminal `failed`
generation whose error starts with `AI_REPLY_CEILING:` and states which ceiling was
reached. It is never queued and never replayed, including by scheduled outbox
recovery. A visitor's explicit reply request from the widget
(the `request` widget command) past a ceiling is refused with HTTP 429, a
`Retry-After` equal to the seconds until 00:00 UTC, and
`{"error": "The assistant is not available right now. …", "code": "rate_limited", "limit": "aiReplies", "retryAfter": <seconds>}`.
The refusal is recorded like a skipped reply for operators. The visitor never sees
which ceiling was reached, the `AI_REPLY_CEILING:` reason or the project's spend: not
in widget responses, socket events or transcripts. Generation state and requests
(`/api/ai-support/…/generations`) and usage are operator routes that refuse visitor
sessions. Operators see an "Automatic AI reply skipped" event in that conversation's
transcript. `GET /api/dashboard/projects/:projectId/ai-usage` returns today's
replies, spend, skipped replies, context runs, the ceilings, whether a ceiling is
reached, and when the counters reset. That endpoint reports only whether the
installation ceiling is reached, never other projects' usage.

## Registration

With `REGISTRATION_ENABLED=true`, every self-registered project uses the
installation's provider keys (`OPENAI_API_KEY` and the others). Total automatic AI
spend can therefore reach the per-project ceiling times the number of projects.
`repliesPerInstallation` caps the total. `registrationsPerIpDay`, `projectsPerIpDay`
and `projectsPerAccountDay` bound how quickly new projects appear. None of these
stops a distributed sign-up campaign. Set `TURNSTILE_SECRET`, keep
`repliesPerInstallation` at a level you are willing to pay for every day, and set
spending limits with the AI provider as well.
