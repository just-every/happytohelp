# Independent installations, hosted delivery and recovery

Every HappyToHelp installation is independent. It needs no HappyToHelp company
account, shared database or original source checkout, and the company service at
happytohelp.com is separate. Never copy another installation's secrets, resource
names or customer data.

## Local installation

Use Node 26.8.1 or newer and pnpm 10.12.4. The guided path is
`node scripts/install.mjs` ([INSTALLER.md](INSTALLER.md)). The manual path is:

```sh
node scripts/operations.mjs describe
pnpm install --frozen-lockfile
pnpm run setup -- --local
pnpm run dev --port 12401 --strictPort
```

Then open `http://localhost:12401/setup` to create an owner and workspace. No
email or AI account is needed for owner setup, conversations, widget admission or
supplied-content knowledge. Configure optional providers explicitly (see
[OPERATIONS.md](../OPERATIONS.md)) before using their features; missing providers
return errors, and their tests do not establish real provider behavior. Delegated
local work uses the local agent's own pairing workflow
([local-agent/README.md](../local-agent/README.md)).

## Self-hosting on Cloudflare

Deploy to your own Cloudflare account with the installer's Cloudflare option, or
by hand with `pnpm run setup -- --plan`, `pnpm run setup -- --remote` and
`pnpm run deploy -- --remote` using your own `CLOUDFLARE_ACCOUNT_ID`,
`H2H_RESOURCE_PREFIX`, `H2H_PUBLIC_ORIGIN`, optional `PREVIEW_ORIGIN` and a fresh
`H2H_SETUP_TOKEN`. [OPERATIONS.md](../OPERATIONS.md#remote-setup-and-publication)
lists the prerequisites, origin rules and token permissions.

Website preview needs its own custom-domain origin mapped to the same Worker,
separate from the application's owner-session origin. Keep both `APP_ORIGIN` and
`PREVIEW_ORIGIN` and the existing scoped grant checks; never serve previews on the
owner origin.

## Hosted Assisted and Managed delivery

[Run Edit Run](https://runeditrun.com) offers hosted **Assisted** and **Managed**
installations of HappyToHelp. These files describe the project to that service:

- `rer-project.json` is the project descriptor: source repository, licence,
  deployment target and the setup, build, verify and artifact commands. It
  deliberately contains no revision; the service registers an exact 40-character
  source commit separately.
- `.github/workflows/rer-managed.yml` calls the service's trusted build workflow
  at a pinned commit. Candidate commands receive no deployment credentials; the
  delivery service owns publication.
- `node scripts/independent/setup-build.mjs` installs pnpm into `.rer-tools`,
  the frozen application dependencies and Chromium for that build. The trusted
  build provides Node but no global pnpm, so the build and verify commands put
  `.rer-tools/node_modules/.bin` first on `PATH` before running the package
  scripts.
- `management/` holds the integration profile the service adopts
  ([management/README.md](../management/README.md)).

To produce the deployable artifact yourself, run `pnpm run build`,
`pnpm run verify` and `node scripts/build-delivery-artifact.mjs`. The producer
writes `delivery-artifact/happytohelp-worker-artifact.json` and refuses to
overwrite an existing artifact. The artifact carries the exact SQL migrations and
their digests, Worker modules, public assets, D1/R2/queue bindings, the
`ConversationSocket` class and its migration, the minute schedule, secret
declarations and the health contract. Private credential files are excluded and
symlinks are rejected. Building an artifact does not deploy it. The artifact is
byte-reproducible with the Node and pnpm versions declared in `package.json`, so
an independent builder can compare its SHA-256 with a published artifact for the
same commit.
`node tests/independent-runtime.mjs` runs that artifact locally and checks backup
and restore (see `tests/helpers/INDEPENDENT-RECOVERY.md`).

Hosted delivery requires a fresh private `H2H_SETUP_TOKEN`, which the owner
enters at `/setup`. Creating the first owner closes setup permanently.

## Updates, backup and recovery

Keep your fork, the exact accepted commit and artifact, your customizations and
migration receipts. Update through ordinary source integration; never overwrite
applied SQL or silently change bound resource identities. To back up, stop
application writes and jobs, then export D1 and every R2 object with its
metadata and bytes. Keep the state of any uncertain external attempt and
reconcile it before allowing a new attempt; restoring an old database must not
replay external effects.

`ConversationSocket` keeps no application data in Durable Object storage:
transcripts and the replay outbox live in D1, and socket attachments are
transient cursors, so fresh sockets reauthorize and replay from D1. A D1/R2
backup is therefore sufficient for HappyToHelp data, but it is not a complete
Cloudflare account export.

Restore into fresh resources you control, preserving migration history, D1 IDs,
roles and history, all object bytes and the `INTEGRATION_ENCRYPTION_KEY` needed
for stored integrations. Re-export and compare records and object hashes before
opening traffic. Test revoked and foreign access, owner sign-in, conversation
reload, knowledge publication, widget origin and preview denial. Keep the old
resources until you accept the restore.

## Clean source snapshots

To distribute the source without Git history, commit the reviewed tree and run
`node scripts/independent/source-snapshot.mjs /new/output-directory`. It writes a
tar of the committed tree and a SHA-256 receipt, without `.git`. Unpack it into a
new directory, initialize a new repository and commit the snapshot. The
authoring command `pnpm run source:release` keeps history and is meant for
trusted source custody, not for a clean public snapshot.

## Licence

The root [`LICENSE`](../LICENSE) (MIT) covers the whole repository, including
the homepage drawings and setup artwork. Keep `docs/licenses/` and third-party package
notices with any redistribution; see [SOURCE-PROVENANCE.md](SOURCE-PROVENANCE.md).

## Dedicated edition delegation and restored data

Before distributing a D1 export **or importing any backup**, run
`python3 scripts/independent/delegation-backup.py private-backup.sql restore.sql`.
Use only the resulting `restore.sql` for import. It preserves domain records,
migration history and content-free receipts, but removes dedicated delegation
grants, code hashes and consent replay material. Every connected Slate member
must consent again after restore. Native session behavior is otherwise unchanged.
Raw provider D1 exports contain credentials and must remain private; they are not
safe interchange exports. Stop writes during export as described above.
