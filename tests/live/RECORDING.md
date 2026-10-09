# Activation fresh-install recording

The recorder prepares an auditable real installation run; its source and local
tests do not constitute a successful live recording. The timed activation
recording is still missing. Complete these dependencies before a real run:

1. Qualify the exact integrated source locally, including the published-article
   retrieval and cited-answer path.
2. Supply the accepted real installer or controller command, actual parameters,
   workflow identity and fresh-state receipt path. The `secrets-present` proof
   checks credential presence only; it does not install an application or execute
   this journey.
3. Use an authorized disposable Cloudflare account with actual Workers, D1, R2,
   Queues and API permissions; test domain/DNS; verified sending provider/domain;
   SendGrid Inbound Parse; a test mailbox and authoritative delivery-event access.
   Supply selected model access, project cap and an explicit spend allowance.
4. Coordinate the protected workflow Environment, owner-operated first-account
   creation and private password/setup-credential entry, approved screen capture
   and masking, and an available local execution slot. The recorder does not
   create owners, supply passwords, inspect secrets or launch a headed browser.

Accounts and verified domains may exist beforehand and must be disclosed. The
Worker, D1, R2, queues, owner, articles, conversations and activation receipts must
be genuinely fresh. Never clone a populated installation or add a hidden dataset
as a substitute for published-article retrieval. A failed/slow attempt is retained;
a new attempt gets a new unique installation and output name.

## What the recorder does

`tests/live/activation-recording.mjs` has three commands:

- `preflight /absolute/config.json`: read-only file/config/source checks. It does
  not assert provider permissions or that prerequisites are true.
- `record /absolute/config.json`: **only after the owner authorizes the real run**.
  Starts a fsynced, hash-chained UTC + monotonic journal, starts the supplied live
  screen capture, waits for encoded video frames, then starts the explicit actual
  installer/controller command once. The time before capture readiness is also
  counted. Stdin accepts evidence references and annotations during owner work.
- `verify /absolute/attempt-directory`: reconstructs custody, milestones, clocks,
  receipt identities, actual video timing and JPG widths. This is a structural
  check, not independent live acceptance. Exit failure includes over-time runs.

Recorder has no pause, resume, restart, account bootstrap, provider client,
Playwright launch, fixture server, workflow dispatch implementation or implicit
setup command. It launches exactly the capture/installer commands in the owner's
reviewed config plus the video encoder/probe. Commands use executable/args, never
shell interpolation. Descendant process groups are stopped on finish/failure.
An installer failure aborts the attempt, with no automatic retry. Milestone input
errors stay in the transcript and time continues while they are corrected.

The journal ticks every second. Clock divergence of 2 seconds, a journal gap of
5 seconds or a capture progress stall invalidates qualification. Sleep, password
entry, waits, errors and recovery never reduce elapsed time. `first-cited-answer`
is stamped when its evidence is admitted, never backdated from a supplied time.
Stop the stopwatch at that observation; keep capture running through citation
verification, both transcript views, reload and responsive JPG evidence. The
manifest reports elapsed time from *before* installation and requires strictly
less than 900 seconds. A later evidence import overstates, never shortens, time.

Video is continuously transcoded from the supplied live screen stream into
ordered 30-second MPEG-TS segments (<50,000,000 bytes each), without audio, at
25 fps and a bounded bitrate. No segment is deleted or spliced. The checker
requires segment numbering and timestamp continuity, total media duration
consistent with the clock, and actual video streams. Native `ffmpeg` and
`ffprobe` executables are required; no dependency installer is run.

## Owner-supplied nonsecret config

The JSON contains the following fields; there is deliberately no runnable config
with placeholder identities or a guessed workflow selector in this repository.

| Field | Required actual value |
| --- | --- |
| `version` | `1` |
| `attempt` | Unique lowercase identifier, 6–71 characters; no existing directory |
| `sourceSha` | Exact 40-character accepted clean checkout SHA |
| `repository` | Absolute path to that clean checkout |
| `authorization` | `root-authorized-real-run`, set only with real owner authorization |
| `origin` | Approved test installation HTTPS origin, no path |
| `maxSeconds` | `900`; cannot be weakened |
| `capture` | `{executable,args,cwd}`: approved actual live screen capture command; video bytes only on stdout, nonsecret diagnostics on stderr |
| `installer` | `{executable,args,cwd}`: accepted actual fresh installation/controller command; stdout/stderr must be nonsecret |
| `ffmpeg`, `ffprobe` | Absolute executable paths |
| `captureDescription` | Actual screen/window source and owner-operated browser plan |
| `prerequisiteDisclosure` | Existing accounts/domains/tools and work already performed |
| `redactionPolicy` | Actual upstream privacy masks and owner password-entry handling |
| `prerequisites` | Map from names below to absolute sanitized receipt files |

Prerequisite keys: `localGate`, `acceptedCitedAnswers`, `workflowController`,
`environmentPolicy`, `throwawayAccount`, `testDomain`, `verifiedSender`,
`inboundParse`, `testMailbox`, `deliveryEventAccess`, `modelAccessAndCap`,
`spendApproval`, `ownerInteraction`, `captureApproval`.

These receipts document actual readiness, provenance and owner decisions. A string
in a config cannot grant authority. The owner reviews the commands before execution:
the installer/controller must not create the owner, must not seed any product
state, must use the accepted workflow, and must expose actual workflow run and
fresh resource identities. All automatic browser work, if used by a reviewed
controller, must be headless. A screen recorder can passively capture an existing
owner-operated browser. The recorder never launches a headed browser.

Capture source is intentionally injected instead of guessing a display device
or requesting private desktop access. It must be a real continuous live capture,
not a file/replay/test generator. The owner supplies its reviewed executable and
arguments. Video begins before installation; a source showing only a stopwatch
fails independent review. Required workflow/terminal, setup, Knowledge and both
visitor/operator views must actually be visible. The owner must arrange owner screen
consent/masking before the run; this tool does not acquire OS permission or
invent a desktop stream.

## Live evidence input

Send one JSON object per stdin line. For a milestone use
`{"kind":"deployment","file":"/absolute/sanitized-receipt.json"}` (with an actual
file). A receipt is copied once under `receipts/`, hashed and bound to its live
journal timestamp. JSON receipts require `origin` matching the installation and
`observedAt` during this attempt, plus the fields listed in
[recorder/evidence.mjs](recorder/evidence.mjs). No receipt can be overwritten.

Required milestones, in the journey's natural order:

1. `deployment`: workflow run/attempt/URL, SHA, emitted build digest, deployment
   version and actual Worker/D1/R2/queue identities.
2. `fresh-storage`: same identities, independent read-only inspection method,
   zero `owners`, `articles`, `conversations`, `activationReceipts`,
   `setupSuccesses` counts before signup. Resource names alone prove nothing.
3. `owner-setup`: actual owner-operated creation and project identity.
4. `empty-checklist`: empty real inbox, 0/8, eight `not_checked` states.
5. `sender-dns`, `owner-mail-delivered`, `inbound-receipt`, `model-key`,
   `spend-ceilings`: actual provider/check receipts. Mail accepted/queued is not
   delivered. Inbound challenge and delivery IDs must join to this installation.
6. `published-article`, `default-assistant`, `widget-origin`, `widget-installed`,
   `widget-ping`: real content/settings/host and accepted ping. `widgetOrigin`
   must match `allowedOrigin` from the saved-origin observation.
7. `visitor-question`, `first-cited-answer`: same conversation, real provider
   request/generation IDs and the newly published article's citation URL.
8. `operator-transcript`, `citation-target`, `reload-survival`: same answer and
   citation in operator transcript, actual public target content hash, same answer
   persisting after reload. Independently compare visible text/content for valid
   support, not merely matching hashes.
9. `capture-1440`, `capture-390`: actual `.jpg` evidence at those widths, collected
   through the reviewed headless capture path or owner browser. This recorder
   probes image dimensions; it does not pretend that imported images are live.
10. `model-usage`, `final-checklist`: raw provider usage tied to generation,
    `costStatus` (`known`, `unknown`, `partial`), actual numeric `costUsd` when
    known or literal `"unknown"` otherwise; the owner's post-batch spend receipt; all
    eight current checklist steps observed done. Unknown cost is never zero.

`{"kind":"note","text":"..."}` records sanitized observations/failures.
`{"kind":"redaction-begin"}` and `{"kind":"redaction-end"}` annotate the actual
upstream screen mask interval. **They do not apply a mask.** Never submit or
record secret values. Include the entire owner password-entry interval even if
visually masked; no citation milestone during full-screen redaction.
`{"kind":"finish"}` finalizes only after every receipt, installer success and
closed redaction interval. `{"kind":"abort"}`, stdin EOF or SIGINT retains a
failed attempt. The recorder never automatically repeats live work.

The command logs reject recognizable credential patterns before writing a line;
this is a secondary guard, not a promise to identify arbitrary secrets or hide
passwords in video. The owner must provide sanitized command output, approved test
content and actual upstream visual masking. Do not feed secrets in arguments,
config, notes, receipt JSON, URLs or screenshots. No customer data.

## Custody and acceptance

Outputs go to `.local-evidence/activation/attempts/<unique-attempt>/`. The final manifest
hashes retained receipts, source config, prerequisite disclosures, command output,
transcript and every actual media segment. Fsync and chain hashes detect ordinary
mutation/truncation; they are not an external trusted timestamp or cryptographic
proof that an author could not forge an entire run. Preserve the full directory
and publish its manifest hash through the owner's authorized evidence process.

Successful structural validation says `recorded-awaiting-independent-review`,
never `PASS`/`DONE`. A fresh gate must replay the entire uncut recording, verify
workflow/provider IDs against real systems, inspect initial blank state, confirm
all setup steps were inside the timer, and confirm the visible answer cites the
new article in both transcripts and after reload. The owner controls source integration, spend records, acceptance and publication.

Local recorder tests use only temporary synthetic *evidence structures*, never a
mock application, fake video, provider call or claimed live receipt. Run after a
local execution slot: `node --test tests/live/recorder/*.test.mjs`.
