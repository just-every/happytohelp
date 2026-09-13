# HappyToHelp handover

Read [first-release acceptance](ACCEPTANCE.md) for purpose, unmet release obligations, preserved requirements and the evidence decision rule.

Updated 12 September 2026. Canonical Support edition source for the new
HappyToHelp product. The bounded owner pilot is deployed and verified. Source publication completed
from Support `7dbf0801c2bea000099e2c0222e57d67dc44de45` as generated
HappyToHelp `72588bc59780f9c2e0a7a1e3d5cb567f9ddc65d6`; the deployed pilot
revision below is a separate receipt.

## Implemented core journey

TanStack Start documents, Hono APIs and real D1 state support first-owner
bootstrap, password sign-in/sign-out, workspace records, one-time scoped agent
credentials, revocation, manual customer requests, explicit delegation modes,
resumable claims, progress, operator questions and input, cancellation, verified
results, screenshot evidence, operator review and resolution.

The independent Python helper checks real local folders and retains private
claims, run IDs and pending receipts before transport. It runs no agent itself
and never executes customer text. A connected Codex or other capable agent uses
its real tools and the operator's instruction to do the work. Browser account
OAuth from the original hosted HappyToHelp is not required by this edition;
the owner issues a workspace-scoped token and can revoke it in Connections.

`investigate` is read-only. `resolve` permits the bounded changes and leaves
reply proposals. `resolve_reply` grants advance authority for one verified reply
through the durable outbox; provider acceptance resolves that completed request.
No second mandatory approval is inserted. Other proposals are editable before
explicit operator approval. Missing transport leaves approved mail pending;
uncertain sends require provider evidence before reconciliation, never a blind
retry. Provider acceptance is displayed separately from inbox delivery.

Attachments accept PNG/JPEG/GIF up to 4 MiB, stored in bounded D1 chunks and bound
to the uploading job/run/agent. Operators can retrieve evidence with their
session. No remote image fetch or untrusted executable attachment occurs.

## Verification

`pnpm verify` runs typechecking, Hono/real SQLite contract tests, isolated Python
transport tests, a fresh real Worker/D1/Chromium journey and a production build.
The browser test copies the self-contained source to a temporary directory,
uses a fresh database and private first-owner token, creates actual records,
exercises question/resume and verified local-file evidence, uploads/downloads a
real screenshot byte-for-byte, resolves, checks mobile overflow and signs out.
No production fixtures or fake agents are shipped.

The [JustEvery pilot](https://support-happytohelp-pilot-20260912.james-d16.workers.dev)
runs Support `4fdbba1dbe50292ba473438ba4f5f37504650071` and Base
`1d3ce621240460baa029370b7ef001c4ec67930a`, Worker version
`c3207877-68a9-46c5-819b-f5203e498bfe`. Full verification passed on that source:
19 product/setup/helper tests, five selected component tests, manifest validation,
TypeScript, a real Worker/D1 browser journey and production build.

The live installation started with zero requests, workspaces and agent records.
The native Python helper completed claim recovery, progress, operator input and
resume, unchanged local-file SHA256 evidence, screenshot upload, verified result
and operator resolution. A separate advance-authorized `resolve_reply` sent
exactly one message to james@justevery.com; the provider accepted it and the
request resolved automatically. Inbox delivery was not verified. Credential
revocation rejected the helper, sign-out rejected operator data access, and actual
desktop/mobile captures passed inspection. A second deployment reused the same
D1 database and signed in the existing owner. See the retained
[pilot receipts and images](verification/pilot-20260912/README.md).

## Composition and source ownership

Base `1d3ce621240460baa029370b7ef001c4ec67930a` supplies the runtime recipe,
SendGrid sender and deployment helpers. Support core supplies delivery-fact
semantics. No optional inbound Support email module is selected. The composition
copies those sources into the exported edition; development copies are removed
from author source before commit to avoid destination collisions.

The original owner HappyToHelp checkouts and Relay remain unchanged. The edition
preserves their relevant protocol and human-authority semantics, and does not
claim Relay's wider historical operations, reporting or knowledge contract.
See PROVENANCE.md and DESIGN.md for exact source and design accounting.

## Remaining external evidence and scope

The live pilot exercised the owner
account and configured SendGrid transport; workspace verification used only an
isolated temporary folder. Business workspace mutations, inbox delivery, full
accessibility and capacity audits remain unverified.
The desk intentionally contains no inbound email ingestion, knowledge base,
analytics, autonomous hosted execution, or generic workflow builder. Existing
agent tools supply workspace capabilities; their actual effects must be verified
and submitted as evidence, not inferred from a connected credential.
