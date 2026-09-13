# HappyToHelp

See [OPERATIONS.md](OPERATIONS.md) for command effects and prerequisites; run
`node scripts/operations.mjs describe` from an exported edition to inspect them.

Read [first-release acceptance](ACCEPTANCE.md) for purpose, unmet release obligations, preserved requirements and the evidence decision rule.

An owner-operated support desk for resolving requests with agents that have real
access to your workspaces. Delegate a bounded instruction, follow progress,
answer questions, and review the evidence of what happened.

## Local setup

Use Node 26.8.1 and pnpm 10.12.4.

```sh
pnpm install --frozen-lockfile
node scripts/setup-local.mjs
pnpm db:migrate:local
pnpm dev
```

Open the printed local URL. Create the first owner with the bootstrap token from
private `.dev.vars`. The token only authorizes first-owner creation; it is not an
agent credential. Choose a strong owner password. Create a workspace, then issue
an agent credential scoped to that workspace from Connections. The credential is
shown once. Keep it in a private local file; never place it in a request message.

Create a support request and select one explicit mode:

- **Investigate:** read-only evidence and recommendations.
- **Resolve:** carry out the scoped changes; propose customer replies for review.
- **Resolve and reply:** carry out the scoped changes and authorize the app to
  send one verified reply. This is advance send authority.

The attached agent works using its actual tools and workspace permissions. This
application does not invent an agent or execute customer text as shell commands.
Use the included standalone helper to claim work, report progress, ask for input,
and submit durable evidence. Its command reference describes private state and
interruption recovery.

## Deployment

Follow [deployment setup](scripts/setup-deployment.md) to supply the owner account,
explicit workers.dev or custom-domain origin and private owner/bootstrap credentials, then run `pnpm run deploy -- --remote`.
The command finds or creates the named D1 database, writes an ignored resource
configuration, builds the selected environment, validates the emitted Worker,
applies migrations, deploys with private secrets and verifies health and owner
sign-in. Committed Wrangler defaults never receive real account resource IDs.
`pnpm run deploy -- --local` verifies local migrations and packaging without cloud actions.

Optional outbound mail uses `SENDGRID_API_KEY` and `MAIL_FROM`. The sender must be
verified with SendGrid. The outbox distinguishes approval, submission, provider
acceptance, rejection and uncertainty. Provider acceptance is not inbox delivery.
Without mail configuration, authorized replies remain pending and visible.

Your deployment holds requests, credentials' hashes, assignments and receipts in
D1. Back it up using Cloudflare D1 exports. Delete or revoke connections in the UI
when workspace access should end. Keep agent-private state outside repositories.

`CONTRACT.md` defines guarantees; `HANDOVER.md` records what has actually been
verified. `PROVENANCE.md` records the retained HappyToHelp and Relay lineage.

## Verified owner pilot

The [JustEvery pilot](https://support-happytohelp-pilot-20260912.james-d16.workers.dev)
completed the native helper investigation, operator input, evidence review and
resolution journey. One explicitly authorized reply to James was provider-accepted;
inbox delivery remains unverified. Repeat deployment reused the same D1 database.
The full verification gate passed on the deployed source; exact revisions, Worker
version and desktop/mobile evidence are recorded in
[the handover](HANDOVER.md) and [pilot receipts](verification/pilot-20260912/README.md).
