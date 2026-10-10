# Manual HappyToHelp validation workflows

Both workflows are `workflow_dispatch` only, from `main` in
`just-every/happytohelp`. Dispatch with an exact lowercase 40-character
`sha`. `live-proof` also takes `proof: secrets-present`. Controller files come
from immutable `github.workflow_sha`, never the candidate. Source ancestry is
checked against fresh integration and semantic `vX.Y.Z[-prerelease]` release
tags (a subset of an Environment's `v*` policy); feature-only SHAs are refused.

Four fresh Ubuntu jobs enforce the boundary:

1. Validate dispatch and source with a read-only GitHub token, without an Environment.
2. Prepare without secrets or Environment. Stage runs frozen pnpm install,
   `pnpm run verify`, whose build calls the pinned Base producer. The whole
   schema-2 `delivery-artifact/` directory is uploaded, including raw payloads; the
   credentialed controller verifies their sizes and SHA-256 hashes before materialization.
   Failed verification prevents packaging and prevents the provider job.
3. The Environment provider job loads only the trusted controller. Stage
   downloads candidate JSON as untrusted data, verifies its approved digest,
  validates paths/topology, discards build-supplied asset ignore rules, and reconstructs a fixed Wrangler JSON config in
   a fresh private directory. The separately locked Wrangler 4.147.0 toolchain
   is installed with lifecycle scripts disabled before credentials are supplied.
   It applies D1 migrations and runs `wrangler deploy --no-bundle --secrets-file`,
   then checks the native `/health` response for reachable D1 and R2. No selected
   package, config, module, hook or build code executes in this credential process.
4. A fresh Environment writer gets only `EVIDENCE_WRITE_TOKEN` and constrained
   job metadata. It constructs the receipt itself and appends to the owner-selected receipt repository main branch using bare Git object
   operations, without
   checking out evidence. It receives no candidate artifact or provider output.

Receipts are stored under
`happytohelp-validation/just-every--happytohelp/<workflow>/<runId>-<attempt>.json`.
They contain source/controller SHA, UTC timestamps, job results, fixed failure
status and, after successful stage publication/health, the approved artifact
SHA-256. The required `command` is writer-owned: `live-proof` with
`proof: secrets-present` and `deploy-stage` with `proof: null` both record
`node control/live-proofs/run.mjs`, the exact execute-job invocation. The mode
and proof select its native names-only proof or trusted stage adapter. This
records the controller entrypoint, not a claim that each internal migration,
publication or health step ran. If preparation fails or execution cannot start,
it is the planned command; job results, failure status and nullable execution
timestamps retain that failure. The writer ignores free-form command inputs and
validation requires the exact mapped command, rejecting missing or altered
values. No provider response body, free text, secret, arbitrary path or command
is accepted. Failed prepare, proof, migration, deploy and health outcomes still
reach this writer. Failure to persist fails the workflow; it is never silently
replaced by an Actions artifact. Invalid dispatch/source requests stop before
Environment access. Cancellation before a job can start cannot guarantee a receipt.

## Environment inputs

The owner maintains `stage` and `live-proof` Environments with branch policies
for `main` and approved release tags. Workflow dispatch remains on the
integration branch. No production Environment or credentials are used.

`secrets-present` needs `CLOUDFLARE_API_TOKEN` and `H2H_SETUP_TOKEN` Environment
secrets and prints only the names that are present. The independent writer
checks `EVIDENCE_WRITE_TOKEN` and prints its name after persistence. This proves
presence and receipt access, not Cloudflare permissions or runtime health.

For both workflows, configure the receipt destination and writer token below.
For `stage`, also supply the provider secrets and target variables:

- Secrets: `CLOUDFLARE_API_TOKEN`, `H2H_SETUP_TOKEN` (at least 32 characters),
  `EVIDENCE_WRITE_TOKEN` (contents write to the owner-selected receipt repository).
- Protected Environment variable `H2H_EVIDENCE_REPOSITORY`: a credential-free
  `https://github.com/<owner>/<repository>.git` URL for an existing receipt
  repository with a `main` branch. Missing or malformed policy fails closed.
  Keep receipts private if they contain installation metadata. This value is
  never accepted from dispatch fields or candidate artifacts.
- Variables: the documented `CLOUDFLARE_ACCOUNT_ID`, `H2H_RESOURCE_PREFIX`,
  `H2H_PUBLIC_ORIGIN`, plus `H2H_STAGE_POLICY_JSON` below. The three documented
  variables must equal the policy; mismatches fail before provider calls.

`H2H_STAGE_POLICY_JSON` is a JSON object with exactly these fields:

| Field | Required value |
| --- | --- |
| `schema` | number `1` |
| `isolation` | string `dedicated-stage` |
| `accountId` | real 32-character lowercase Cloudflare account ID |
| `prefix` | real lowercase resource prefix ending `-stage`, 9–40 characters total |
| `databaseId` | real lowercase UUID for the preprovisioned D1 database |
| `origin` | `https://<prefix>.<actual-account-subdomain>.workers.dev` |
| `sourceSha` | exact approved candidate commit, matching dispatch |
| `artifactSha256` | actual SHA-256 of that candidate's delivery JSON, approved by the owner |

The owner must provision the dedicated stage Worker target and named resources
first through the documented setup process: `<prefix>-db`, `<prefix>-files`,
`<prefix>-jobs`, `<prefix>-jobs-dead`. The adapter does not create accounts,
resources, routes or custom DNS. It supports the documented DB/FILES/JOBS/
JOBS_DEAD_LETTER/CONVERSATIONS topology, compatibility date `2026-09-08`, and
minute recovery schedule. The owner must ensure these resources are isolated
from production and that the token is scoped to the selected test account.
No account ID, resource UUID, target hostname or approved digest is guessed.

Obtain a candidate artifact and its digest from the credential-free preparation
job; without policy the provider job fails closed. Review the exact artifact,
set the policy, then dispatch that SHA again. A changed artifact must be reviewed
again; runtime identity is not inferred from a source commit alone. The policy
must come from an Environment variable, never a dispatch field or build file.

This is a constrained CI adaptation of `OPERATIONS.md`'s remote deploy sequence.
It requires a setup token even for existing-owner stage installs, fixes
registration to false, and supplies no optional mail or AI credentials. It does
not call OpenAI, send email, touch `app.happytohelp.com` or `help.justevery.com`,
or establish outside-customer acceptance. Optional mail work must reuse the
existing `SENDGRID_API_KEY` secret name if later enabled in a reviewed
controller. `/health` does not prove queues, sockets or live providers. A failed
publish/health after migration may leave applied migrations or published code;
there is no automatic rollback or replay of uncertain provider effects.

## Local checks and integration

```sh
node --test live-proofs/tests/*.test.mjs
npm ci --prefix live-proofs/toolchain --ignore-scripts --no-audit --no-fund
node --test live-proofs/tests/wrangler-dry-run.mjs
actionlint .github/workflows/live-proof.yml .github/workflows/deploy-stage.yml
```

The tests exercise hostile source inputs/paths/config, separate credentials,
the real Wrangler dry-run with an inert malicious module, failed verification
gating, and durable failure receipts in a temporary bare Git store. Fixture
accounts and resources exist only in tests. Hosted permission, resource, Linux
build and receipt-store checks require their own CI evidence. After editing
controller files, refresh the source lock and rerun these checks. Never weaken
`pnpm run verify` to unblock a deploy.
