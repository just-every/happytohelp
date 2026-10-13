# Updates, backups and recovery

This page is for whoever looks after a HappyToHelp installation. It shows how to
keep a running installation safe: update it, back up and restore its data, build
its release package yourself and share its source.

It also sums up where an installation can run and how HappyToHelp is licensed.

## Each installation stands alone

Every HappyToHelp installation is independent. It does not need:

- a HappyToHelp company account
- a shared database
- a checkout of the original HappyToHelp application's source (this open-source
  project is a new edition of that application)

The company's own service at happytohelp.com is separate from your
installation, and you don't need an account there.

Never copy another installation's secrets, resource names or customer data into
yours.

## Update your installation

Keep these, so you can always rebuild or roll back:

- your fork of the source
- the exact commit and release package (the build **artifact**) you accepted
- your own customizations
- your migration receipts (the record of which database migrations you applied)

Update the way you would take in any upstream change: merge the new source into
your fork with Git.
[Upgrade an existing installation](../OPERATIONS.md#upgrade-an-existing-installation)
in the Operations guide lists the steps. The worked example below gives the
exact Git commands for one release and shows how to roll back.

> [!IMPORTANT]
> Never overwrite SQL migrations that have already been applied, and never
> silently change the identities of the Cloudflare resources your installation
> is bound to (its D1 database, R2 bucket and queues).

## Back up your data

Your data lives in two places: the D1 database (named `<prefix>-db`, where
`<prefix>` is your resource name) and the R2 file bucket (`<prefix>-files`). To
take a consistent backup:

1. Stop application writes and background jobs. HappyToHelp has no built-in
   pause switch, so choose a quiet time and make sure nothing is writing to the
   installation while you export.
2. Export the D1 database. Wrangler, Cloudflare's command-line tool, can do
   this from your checkout:

   ```sh
   pnpm exec wrangler d1 export <prefix>-db --remote --output private-backup.sql
   ```

3. Export every R2 object, with both its metadata and its bytes. HappyToHelp
   doesn't include a command for this, so use a tool that copies each object's
   metadata as well as its contents.
4. Write down any call to an outside service whose outcome you're unsure of,
   such as an email or AI reply that may or may not have gone out (HappyToHelp
   marks these as *uncertain*). Before you let HappyToHelp try one again, check
   with the provider what actually happened: restoring an old database must not
   repeat effects that already happened outside HappyToHelp.

> [!WARNING]
> A raw D1 export contains credentials. Keep it private: it is not safe to pass
> around as is. Before you give a D1 export to anyone, run the cleaning script in
> [Restore from a backup](#restore-from-a-backup) on it first.

### What a D1 and R2 backup covers

Live conversations use a Cloudflare Durable Object called `ConversationSocket`.
It keeps no application data in Durable Object storage:

- transcripts and the queue of messages waiting to be replayed (the replay
  outbox) live in D1
- each open connection holds only a temporary position marker, so a new
  connection re-checks its access and replays what it missed from D1

A backup of D1 and R2 therefore holds all of your HappyToHelp data. It is not a
complete export of your Cloudflare account.

## Restore from a backup

1. Clean the export. Before importing **any** backup, run this script (it needs
   Python 3):

   ```sh
   python3 scripts/independent/delegation-backup.py private-backup.sql restore.sql
   ```

   Import only the resulting `restore.sql`. It keeps your application records,
   migration history and content-free receipts. It removes the dedicated
   delegation grants, code hashes and consent replay material that let a
   connected application act for a member.

2. Restore into fresh resources that you control. Preserve:
   - the migration history
   - the IDs in D1
   - roles and history
   - the bytes of every object
   - the `INTEGRATION_ENCRYPTION_KEY`, which stored integrations need

3. Export the restored data again and compare its records and object hashes with
   your backup before you let traffic in.

4. Test that:
   - revoked access, and access from another workspace (foreign access), are
     still refused
   - the owner can sign in
   - conversations reload
   - knowledge articles can be published
   - the widget's website origin check still works
   - website preview refuses access it should refuse

5. Keep the old resources until you have accepted the restore.

After a restore, every member who had connected Slate (an outside application
that members can connect under **Settings → Connected applications**) must
give consent again. Otherwise, normal sign-in sessions work as before.

## Where an installation can run

### On your computer

Use Node **22.20.0** and pnpm **10.12.4**. Prepare private manifest answers
as described in [Install](INSTALLER.md), then run:

```sh
node scripts/rer.mjs install
node scripts/rer.mjs setup --owner-email you@example.com --answers .seed/local-answers.json --port 12401
node scripts/rer.mjs dev
```

Setup prepares the native owner and stops its temporary app. Dev prints the
app address and development outbox; choose its newest message, follow the link
and press Sign in. No email is sent. Port 12401 is an explicit example; the
saved loopback origin is reused. Stop dev with Ctrl+C.

You do not need an email or AI account to set up the owner, hold conversations,
let visitors in through the widget, or answer from knowledge content you supply
yourself. Before you use any feature that needs an outside provider, configure
that provider explicitly (see [Operations](../OPERATIONS.md)). A feature
whose provider is missing returns an error, and the repository's provider tests
do not prove that a real provider works.

To hand support work to your own computer, use the local agent's pairing steps
([Local agent](../local-agent/README.md)).

### On your own Cloudflare account

Use `node scripts/rer.mjs deploy --environment production` with the real
`deploy.json` declaration and private owner-account credentials.
[Deploy to your Cloudflare account](../OPERATIONS.md#deploy-to-your-cloudflare-account)
covers prerequisites, secret custody and health boundaries. Local
`node scripts/rer.mjs deploy --dry-run` builds/validates without provider requests.

**Website preview** lets owners and admins see their website with the chat
widget on it. It needs its own custom-domain origin (`PREVIEW_ORIGIN`), pointed
at the same Worker but separate from the origin where owners sign in
(`APP_ORIGIN`). Keep the two origins separate, keep the existing access checks
on each preview link (its scoped grant), and never serve previews on the owner
origin.

### Hosted by Run Edit Run

[Run Edit Run](https://runeditrun.com), a separate service, offers hosted
**Assisted** and **Managed** installations of HappyToHelp. If you host
HappyToHelp yourself, you can skip this section. These files describe
HappyToHelp to that service:

- `rer-project.json` is the project descriptor: the source repository, licence,
  deployment target, and the setup, build, verify and artifact commands. It
  deliberately records no revision; the service registers an exact 40-character
  source commit separately.
- `.github/workflows/rer-managed.yml` calls the service's trusted build workflow
  at a pinned commit. HappyToHelp's own commands that this build runs receive
  no deployment credentials; the delivery service does the publishing itself.
- `node scripts/independent/setup-build.mjs` prepares that build: it installs
  pnpm into `.rer-tools`, then the frozen application dependencies and Chromium.
  The trusted build provides Node but no global pnpm, so the build and verify
  commands put `.rer-tools/node_modules/.bin` first on `PATH` before running the
  package scripts.
- `management/` holds the integration profile the service adopts
  ([management/README.md](../management/README.md)).

A hosted installation needs a fresh, private `H2H_SETUP_TOKEN`. The owner enters
it at `/setup`. Creating the first owner closes setup permanently.

## Build the release package yourself

The **artifact** is the deployable package of your installation. You only need
it if you deliver builds yourself or want to check a published build. To build
it, run `node scripts/rer.mjs build` or `node scripts/rer.mjs verify`. Both run the pinned Base producer
(the packaging step, fixed to an exact upstream version) after Vite.

- The producer writes `delivery-artifact/happytohelp-worker-artifact.json`.
- A normal build first cleans only its own generated `delivery-artifact/`
  output. Run directly (`node scripts/delivery/build.mjs`), the producer
  refuses to overwrite an existing artifact.
- The manifest (schema 2) points to raw sidecar files in `payload/`, each with
  its SHA-256 and byte size. Keep and upload the **whole** directory.
- Private credential files and symlinks make packaging fail.
- Building an artifact does not deploy it.

The artifact carries:

- the exact SQL migrations and their digests
- the Worker modules
- the public assets
- the D1, R2 and queue bindings
- the `ConversationSocket` class and its migration
- the once-a-minute schedule
- the secret declarations
- the health contract

The artifact is byte-reproducible with the Node and pnpm versions declared in
`package.json`. Anyone can build the same commit and compare their SHA-256 with
a published artifact.

To run the artifact locally and check backup and restore, run
`node tests/independent-runtime.mjs` (see
[tests/helpers/INDEPENDENT-RECOVERY.md](../tests/helpers/INDEPENDENT-RECOVERY.md)).

## Share the source without Git history

To give someone a clean copy of the source:

1. Commit the reviewed tree.
2. Run:

   ```sh
   node scripts/independent/source-snapshot.mjs /new/output-directory
   ```

   It writes a tar of the committed tree and a SHA-256 receipt, without `.git`.
3. Unpack the tar into a new directory, initialize a new repository there and
   commit the snapshot.

The maintainer command `pnpm run source:release` keeps history. It is meant for
the maintainers' own trusted release records, not for a clean public snapshot.

## Licence

The root [`LICENSE`](../LICENSE) (MIT) covers the whole repository, including
the homepage drawings and setup artwork. Keep `docs/licenses/` and third-party
package notices with any copy you redistribute; see
[SOURCE-PROVENANCE.md](SOURCE-PROVENANCE.md).
