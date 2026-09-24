# Independent HappyToHelp

This repository is an independently installable native HappyToHelp application.
It needs no HappyToHelp company SaaS account, shared production database or
original source checkout. The company service at happytohelp.com and
app.happytohelp.com remains separate. Historic hosted receipts in HANDOVER.md
identify earlier installations; they are not instructions to reuse those
resources, accounts, hostnames or customer data.

## Local installation

Use Node 26.8.1 and pnpm 10.12.4. First run
`node scripts/operations.mjs describe`, then `pnpm install --frozen-lockfile`,
`pnpm run setup -- --local`, and `pnpm run dev -- --port 12401 --strictPort`.
Visit `/setup` to create an owner and workspace. No email or AI account is needed
for owner setup, conversations, widget admission or supplied-content knowledge.
Configure optional providers explicitly before using their features. Missing
providers return errors; their tests do not establish real provider acceptance.
Use OPERATIONS.md for capability configuration and the local connector's own
pairing workflow for delegated work. Never copy another installation's secrets.

## Independent RER delivery

`rer-project.json` is the generic independent project descriptor. Register its
exact committed bytes and supply the external 40-character source commit as
`sourceRevision`. The descriptor deliberately contains no self-referential
revision. The `rer-managed.yml` caller uses the project profile and a full delivery
commit pin. Its project-owned setup installs pnpm in `.rer-tools`, frozen
application dependencies and Chromium. Candidate commands receive no deployment
credentials. The separate attestation/delivery service owns publication authority.

Build with `pnpm run build`, run `pnpm run verify`, and emit the artifact with
`node scripts/build-delivery-artifact.mjs`. The producer refuses to overwrite an
existing artifact; retain it as evidence or choose a new output via its API.
RER delivery requires a fresh private H2H_SETUP_TOKEN supplied by the owner; enter it at native /setup. The first-owner transaction closes setup permanently. Local standalone development may omit it on loopback.
The artifact carries exact SQL bytes and identities, Worker modules, public
assets, D1/R2/queue bindings, the ConversationSocket class and v1 migration,
minute schedule, secret declarations and health contract. Private credential
files are excluded and symlinks rejected. Emission is not deployment.

Website preview requires an independently routed origin mapped to the same
Worker, separate from the application's owner-session origin. Preserve both
APP_ORIGIN and PREVIEW_ORIGIN and the existing scoped grant checks. Do not enable
preview on the owner origin to fit a one-host deployment adapter. A descriptor
registration or health response alone does not qualify this requirement.

## Custody, update and recovery

Keep the owner fork, exact accepted commit/artifact, owner customizations and
migration receipts. Update through ordinary source integration; never overwrite
applied SQL or silently change bound resource identities. Back up D1 and every
R2 object with metadata and bytes after quiescing application writes and jobs.
Retain uncertain external-attempt state and reconcile it before permitting a
new attempt. Restoring an old database must not replay external effects.

ConversationSocket has no application SQL/KV storage writes: its durable
transcripts and replay outbox live in D1. WebSocket attachments are transient
connection/session cursors; fresh sockets reauthorize and replay from D1. This
is a product recovery property, not permission for RER to label unsupported
Durable Object exports complete. RER must either verify a declared reconstruction
contract or refuse a complete export; never omit a binding silently.

Restore into fresh owner-controlled resources, preserving migration history,
D1 IDs, roles and history, all object bytes and encryption keys required for
stored integrations. Re-export and compare records/object hashes before opening
traffic. Test revoked and foreign authority, owner sign-in, conversation reload,
knowledge publication, widget origin and preview denial. Retain the previous
resources until the owner accepts the restore. D1/R2 backup alone is not a
universal Cloudflare account export.

## Publication and provider steps

After reviewing the exact local candidate and evidence, publish its source commit
and verify the trusted delivery pin is published and accepted by the chosen RER
service. Register the descriptor with that commit. The owner must supply their
own Cloudflare account and separately selected application/preview hostnames,
approve the generated resource plan, then run the trusted workflow and inspect
hosted behavioral evidence before directing traffic. Direct installation may use
`pnpm run setup -- --plan`, `--remote` and `pnpm run deploy -- --remote` with new
owner-selected H2H_RESOURCE_PREFIX/H2H_PUBLIC_ORIGIN and PREVIEW_ORIGIN.
No command in local qualification provisions accounts or changes live domains.

The root LICENSE covers source; preserve docs/licenses and third-party package
notices. Generated village/setup art and HappyToHelp branding have separate
provenance and are not relicensed as MIT code. Public redistribution still needs
an explicit asset grant recorded by the rights holder; preserve the approved UX
while that decision is pending. See docs/PUBLIC-SOURCE-PROVENANCE.md.

For distribution without historical deleted assets, commit the reviewed tree and
run `node scripts/independent/source-snapshot.mjs /new/output-directory`. This
writes a Git-tree tar and SHA-256 receipt without any `.git` history. Unpack it
into a new directory, initialize a new repository, and commit the reviewed
snapshot before independently publishing. Record the new external commit for
RER registration. The authoring `source:release` command retains history and is
for trusted owner source custody; it is not the clean public snapshot command.
Original history remains untouched. The new snapshot still needs its present
assets' distribution rights; history exclusion does not supply those rights.

The interactive entry is `rer-setup happytohelp`, which opens this application's
local browser installer before application dependencies or deployment. Within
an already selected checkout use `node scripts/install.mjs`; `--resume` reopens
saved nonsecret answers, and `--no-prefill` starts an empty session. Passwords
and provider credentials stay private and are not answer-file content. The
owner explicitly starts installation from the local review. This interactive
setup is separate from descriptor `operations.setup`, which installs CI tools.
