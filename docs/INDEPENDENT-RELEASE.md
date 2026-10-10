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

### Upgrade from v0.2.0 to v0.2.1

This procedure covers only the exact public tags `v0.2.0`
(`3b34df590cff61358afc07ab56ea886461ca74fd`) and `v0.2.1`
(`59c6e2e1beb321e9f1cb5493efd05e20fc068638`). `v0.2.1` descends from `v0.2.0`.
It is kept here as a worked example of the Git steps.

**What changes.** The tag diff changes seven files: `CHANGELOG.md`,
`docs/INDEPENDENT-RELEASE.md`, `package.json`, `rer-project.json`, `seed.json`,
`sources.lock.json` and `tests/independent-runtime.mjs`. It updates release and
hosted-build metadata and changes the independent-runtime table-count assertion
from 94 to 97. It contains no application-runtime source change and no `.sql`
migration change. Migrations `0102_public_abuse_limits.sql`,
`0103_contact_erasure.sql` and `0104_inbound_email_classification.sql` are
already present in both tags, so the 97-table assertion in v0.2.1 recognizes
schema that v0.2.0 already ships; it is not a new migration.

#### 1. Prepare a rollback

Before you deploy, record the source SHA you are replacing, and make an
independent backup under your existing data-retention procedure (see
[Back up your data](#back-up-your-data) below).

#### 2. Fetch and check the tags

- If this checkout has the official repository as `origin`, run
  `git fetch origin --tags`.
- If `origin` is your fork, fetch the public repository through a remote named
  `upstream`. Add it if needed, then fetch:

  ```sh
  git remote add upstream https://github.com/just-every/happytohelp.git
  git fetch upstream --tags
  ```

Confirm the tag commits and ancestry:

```sh
git rev-parse 'v0.2.0^{commit}'
git rev-parse 'v0.2.1^{commit}'
git merge-base --is-ancestor v0.2.0 v0.2.1
```

The first two commands must print the SHAs above, and the ancestry check must
exit successfully.

#### 3. Merge the release

From a clean source branch based on the deployed v0.2.0 code, create an upgrade
branch and merge the public tag:

```sh
git switch -c upgrade/happytohelp-v0.2.1
git merge --no-ff v0.2.1
git rev-parse HEAD
```

Resolve any merge conflicts while keeping your own source changes. Do not
replace a checkout you have edited with generated output. Record the final
`HEAD` SHA that you deploy.

#### 4. Deploy

For an installation whose existing remote target configuration is still present,
run:

```sh
pnpm install --frozen-lockfile
pnpm run deploy -- --remote
```

`deploy -- --remote` collects the migration files from the checked-out source,
builds, asks Wrangler to apply remote D1 migrations, and only then uploads the
Worker. There are no new SQL migrations between these exact tags, so a database
already migrated by v0.2.0 has no v0.2.1 migration to apply.

If this is a fresh checkout without `.seed/deployment/<prefix>/wrangler.json`,
first restore the same account, prefix, origin and runtime variables, then run
`pnpm run setup -- --plan` and `pnpm run setup -- --remote` before deploying.
Setup reuses resources it finds by their declared names.

Confirm the resulting `/health`. It verifies the runtime plus D1/R2
reachability, not the rest of the service.

#### Roll back

To roll back this exact code-only update, check out the pre-upgrade SHA you
recorded (for an unmodified v0.2.0 installation, `v0.2.0`), install that
revision's frozen dependencies, and run `pnpm run deploy -- --remote` with the
same target and runtime configuration:

```sh
read -r -p 'Pre-upgrade commit SHA: ' PRE_UPGRADE_SHA
git switch --detach "$PRE_UPGRADE_SHA"
pnpm install --frozen-lockfile
pnpm run deploy -- --remote
```

Do not delete data, undo or edit applied migration records, or reverse SQL by
hand. The two public tags have no schema difference, so this code rollback
leaves the v0.2.0 D1 schema and all D1/R2 data in place. This does not cover a
later v0.2.x source revision that added migrations or changed stored data; older
code may not be compatible with such a database.

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
that members can connect under **More settings → Connected applications**) must
give consent again. Otherwise, normal sign-in sessions work as before.

## Where an installation can run

### On your computer

Use Node 26.8.1 or newer and pnpm 10.12.4. The guided way is the installer,
`node scripts/install.mjs` (see [Install](INSTALLER.md)). To do it by hand,
run:

```sh
node scripts/operations.mjs describe
pnpm install --frozen-lockfile
pnpm run setup -- --local
pnpm run dev --port 12401 --strictPort
```

Then open `http://localhost:12401/setup` to create your owner account and
workspace. Port 12401 is only an example; without `--port`, the app uses the
address it prints (normally `http://localhost:5173`).

You do not need an email or AI account to set up the owner, hold conversations,
let visitors in through the widget, or answer from knowledge content you supply
yourself. Before you use any feature that needs an outside provider, configure
that provider explicitly (see [Operations](../OPERATIONS.md)). A feature
whose provider is missing returns an error, and the repository's provider tests
do not prove that a real provider works.

To hand support work to your own computer, use the local agent's pairing steps
([Local agent](../local-agent/README.md)).

### On your own Cloudflare account

Choose the installer's **Publish online with Cloudflare** option, or deploy by
hand with your own `CLOUDFLARE_ACCOUNT_ID`, `H2H_RESOURCE_PREFIX`,
`H2H_PUBLIC_ORIGIN`, optional `PREVIEW_ORIGIN` and a fresh `H2H_SETUP_TOKEN`.
[Deploy to your Cloudflare account](../OPERATIONS.md#deploy-to-your-cloudflare-account)
in the Operations guide has the full steps, the prerequisites, the rules for
origins and the API token permissions.

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
it, run `pnpm run build` or `pnpm run verify`. Both run the pinned Base producer
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
