# Request limits and daily AI ceilings

Your chat widget is open to the whole internet, so HappyToHelp protects it for you
out of the box. It does two things:

- **Request limits** slow down anyone, person or script, who opens too many chats,
  sends too many messages, uploads too many files or signs up too often.
- **Daily AI ceilings** cap how many automatic AI replies visitors can trigger each
  day, and roughly how much they can cost you.

Both are on by default and need no setup. Read on if
you expect heavy traffic, if many of your visitors share one network (an office or a
mobile carrier), if you want a different daily AI budget, or if you plan to let
other people sign up and create their own workspaces.

A few words used on this page:

- **Visitor**: someone using the chat widget on your website.
- **Your team**: people signed in to the dashboard for a workspace (owners, admins and
  operators).
- **Workspace**: one support space with its own widget. Setting names and API
  paths call a workspace a *project*, which is why many limit names below say
  `Project`.
- **Installation**: your whole HappyToHelp deployment, with all of its workspaces.
- **Client address**: the IP address a request comes from.

## Why the limits are needed

The widget key and the allowed origin (the website address the widget accepts) are
public: anyone can read them from your web page. A program running outside a browser
can also claim to come from any `Origin`. So the browser alone cannot keep strangers
out of the visitor-facing API, and HappyToHelp counts requests itself instead.

You do not need a Cloudflare rate-limiting product for this. The counters live in your
own D1 database, and all limits reset on fixed UTC boundaries: per minute, per hour,
or per day (daily limits reset at 00:00 UTC). How the counters are stored is
described in [How the counting works](#how-the-counting-works) at the end of this
page.

## What a visitor sees when they hit a limit

The visitor gets a short, readable message in the widget, for example "You are
sending messages too quickly. Please wait a moment and try again." Their unsent
message is marked as failed. The widget never resends it later on its own, so
nothing is posted without the visitor knowing. Background activity data the widget
sends (telemetry) is simply dropped when it hits a limit; the visitor sees nothing.

A refused request uses up none of the visitor's allowance.

Your team is not held back by these limits: signed-in workspace members are not
limited on conversation, message or upload routes.

## Request limits

These are the defaults. Each limit counts within its own window; the window is the
last word of its name (`Minute`, `Hour` or `Day`).

### Chat sessions and conversations

| Name | Default | What it counts |
| --- | --- | --- |
| `widgetSessionsPerIpHour` | 30 | widget sessions per workspace widget key and client address |
| `widgetSessionsPerProjectHour` | 5000 | widget sessions (and the visitor contacts they create) per workspace, across all addresses |
| `conversationsPerContactHour` | 10 | new conversations per visitor |
| `conversationsPerIpHour` | 30 | new visitor conversations per workspace and client address |
| `conversationsPerProjectHour` | 5000 | new visitor conversations per workspace, across all visitors and addresses |

### Messages and widget activity

| Name | Default | What it counts |
| --- | --- | --- |
| `messagesPerConversationMinute` | 15 | visitor messages per conversation |
| `messagesPerContactHour` | 120 | visitor messages per visitor |
| `widgetEventsPerContactMinute` | 120 | widget commands and telemetry per visitor |

### Attachments

Each attachment can be at most 20 MB, whatever these limits say.

| Name | Default | What it counts |
| --- | --- | --- |
| `uploadsPerContactDay` | 30 | visitor attachments per visitor per day |
| `uploadBytesPerContactDay` | 100000000 | visitor attachment bytes per visitor per day |
| `uploadsPerProjectDay` | 5000 | visitor attachments per workspace per day, across all visitors |
| `uploadBytesPerProjectDay` | 5000000000 | visitor attachment bytes per workspace per day, across all visitors |

### Sign-ups and new workspaces

| Name | Default | What it counts |
| --- | --- | --- |
| `registrationsPerIpDay` | 5 | self-registrations per client address (only applies with `REGISTRATION_ENABLED=true`) |
| `projectsPerIpDay` | 10 | workspace creation and registration verification per client address |
| `projectsPerAccountDay` | 10 | workspaces one account can create per day |

### Visitors who share a network

The client address is the one Cloudflare reports in the `CF-Connecting-IP` header.
IPv6 addresses are grouped by /64 (the smallest block one subscriber controls), so
one subscriber's network counts as one address. Visitors behind one shared address, such as an office network or a mobile
carrier, share that address's session and conversation limits. If many of your
visitors arrive that way, raise `widgetSessionsPerIpHour` and
`conversationsPerIpHour`.

When the header is missing, which happens with local tools, every caller shares one
`unknown` bucket. The limits still apply.

### Busy sites and the per-workspace ceilings

The per-address and per-visitor limits stop a single client. On their own, though,
they would not stop a client that keeps changing its address: each new session counts
as a new visitor, so it could create unlimited sessions, contacts, conversations and
attachments. The limits with `PerProject` in their name cap that for each workspace.

The widget opens one session and one conversation for every new visitor. So
`widgetSessionsPerProjectHour` and `conversationsPerProjectHour` are, in practice,
the number of new visitors a workspace can take per UTC hour. The defaults are well
above a busy site's real traffic; raise them if yours gets more.

When a workspace passes one of these ceilings:

- New visitors to that workspace see "This chat is very busy right now. Please try
  again later." (or, for attachments, that attachments are unavailable for the rest
  of the day) until the window resets.
- Returning visitors keep their existing sessions and conversations.
- Other workspaces are not affected.

### The 429 response, for developers

A request over a limit gets HTTP 429 with a `Retry-After` header (the widget can read
it cross-origin) and this JSON body:

```
{"error": "<visitor-readable message>", "code": "rate_limited", "limit": "<name>", "retryAfter": <seconds>}
```

When one request is checked against several limits at once, either all of them count
it or none does: if any one refuses, the capacity already taken from the others is
given back.

## Daily AI ceilings

AI providers bill you for every reply. These ceilings stop visitors, or a script
posing as many visitors, from running up that bill.

### What counts

The ceilings cover every AI generation a visitor causes:

- automatic replies to widget messages and to inbound email
- replies when a visitor answers an insight (a suggested prompt with answer buttons
  that the widget shows)
- replies a visitor explicitly asks for from the widget

They also cover the customer-context monitoring runs that visitor activity starts.

They do **not** cover drafts and suggestions your team asks for in the dashboard.

### Defaults

All four reset every day at 00:00 UTC.

| Name | Default | Meaning |
| --- | --- | --- |
| `repliesPerProject` | 200 | automatic replies admitted per workspace per UTC day |
| `spendUsdPerProject` | 10 | estimated USD spend on a workspace's automatic replies per UTC day |
| `repliesPerInstallation` | 2000 | automatic replies across all workspaces per UTC day |
| `contextRunsPerProject` | 500 | visitor-triggered context monitoring runs per workspace per UTC day |

The spend figure is an estimate. It adds up the cost the AI provider reports for each
round of each automatic reply, and only counts rounds that have already reported. A
reply still in progress when the ceiling is reached can therefore push the total over
it by that reply's own cost. To be safe, also set a spending limit in your AI
provider's account.

### What happens when a ceiling is reached

- **The visitor's message still gets through.** It is saved and delivered to your
  team as usual; only the automatic reply is skipped.
- **Your team is told.** The conversation's transcript shows an **Automatic AI reply
  skipped** event, with the reason.
- **Skipped replies stay skipped.** The automatic reply is recorded as a `failed`
  generation whose error starts with `AI_REPLY_CEILING:` and names the ceiling that
  was reached. It is never queued or replayed later, including by outbox
  recovery (the scheduled job that picks up undelivered or interrupted work).
- **Explicit requests are refused.** If a visitor asks for a reply from the widget
  (the `request` widget command) after a ceiling is reached, they get HTTP 429 with a
  `Retry-After` equal to the seconds until 00:00 UTC, and this body:

  ```
  {"error": "The assistant is not available right now. …", "code": "rate_limited", "limit": "aiReplies", "retryAfter": <seconds>}
  ```

  Your team sees this refusal in the same way as a skipped reply.

Visitors never learn which ceiling was reached, the `AI_REPLY_CEILING:` reason or the
workspace's spend. None of it appears in widget responses, live updates (socket
events) or transcripts. The generation routes (`/api/ai-support/…/generations`) and
the usage report are team-only and refuse visitor sessions.

### Check today's AI usage

Signed-in workspace members can call:

```
GET /api/dashboard/projects/:projectId/ai-usage
```

It returns today's replies, spend, skipped replies and context runs, the ceilings,
whether a ceiling is reached, and when the counters reset. For the installation-wide
ceiling it reports only whether it has been reached; it never shows other workspaces'
usage.

## Change a limit or ceiling

You only need to set the values you want to change. Everything else keeps its
default.

1. Pick the names you want to change from the tables above.
2. Write them as a JSON object in the matching variable: `RATE_LIMITS` for request
   limits, `AI_DAILY_CEILINGS` for AI ceilings. For example:

   ```sh
   export RATE_LIMITS='{"messagesPerConversationMinute":30}'
   export AI_DAILY_CEILINGS='{"spendUsdPerProject":2.5}'
   ```

3. Apply them the same way as the other optional settings in
   [Operations](../OPERATIONS.md): set them in the environment when you run
   the real `deploy.json` declaration, then run `pnpm exec rer deploy --environment production`. If you
   change them later, run setup again before you deploy. For local runs, put the same
   names in `.dev.vars`.

Rules for the values:

- Every `RATE_LIMITS` value must be a positive integer.
- Every `AI_DAILY_CEILINGS` value must be a positive integer, except
  `spendUsdPerProject`, which may be fractional (such as `2.5`).
- Unknown names and invalid values are rejected when you deploy. If a bad value
  reaches a running installation anyway, requests fail with a visible error. A
  mistake never quietly removes a limit.

## Before you turn on public sign-up

Public sign-up is off unless you set `REGISTRATION_ENABLED=true`, and an
installation for your own team doesn't need it: invite teammates from
**Settings → Agents** instead.

With `REGISTRATION_ENABLED=true`, anyone can sign up and create workspaces, and every
self-registered workspace uses the installation's AI provider keys (`OPENAI_API_KEY`
and the others). Total automatic AI spend can therefore reach the per-workspace
ceiling times the number of workspaces.

- `repliesPerInstallation` caps the total.
- `registrationsPerIpDay`, `projectsPerIpDay` and `projectsPerAccountDay` slow down
  how quickly new workspaces appear.

None of these stops a sign-up campaign spread across many addresses. Before you
enable registration:

1. Set `TURNSTILE_SECRET`.
2. Set `repliesPerInstallation` to a level you are willing to pay for every day.
3. Set spending limits with your AI provider as well.

## How the counting works

For maintainers and the curious:

- Counters are stored in the D1 table `abuse_counters`, created by migration
  `0102_public_abuse_limits.sql`. No Cloudflare rate-limit binding is required.
- Windows are fixed and aligned to UTC; daily windows reset at 00:00 UTC.
- Each counter is keyed by a SHA-256 hash of what it limits, so raw client addresses
  are never stored.
- The scheduled handler deletes expired counters.
