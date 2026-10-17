# Export legacy HappyToHelp

This operator tool reads one explicitly chosen legacy MySQL project and its media. It makes no source writes, discovers no credentials and never loads dotenv files. It belongs beside the native importer; it does not use a web endpoint or change an installation. Run Node 22.20.0, `pnpm install --frozen-lockfile`, and AWS CLI v2 for direct S3 reads.

## Access and extraction

Supply `LEGACY_MYSQL_HOST`, `LEGACY_MYSQL_PORT` (default 3306), `LEGACY_MYSQL_DATABASE`, `LEGACY_MYSQL_USER`, `LEGACY_MYSQL_PASSWORD` in the process environment. Use a local SSH tunnel to a private database or `LEGACY_MYSQL_SSL_CA` for verified MySQL TLS. Use a SELECT-only database account. The tool sets UTC and repeatable-read, opens a consistent read-only transaction, reads every SELECT on that connection, then commits. Tables keyed by `id` are read in id-ordered pages of 10,000 rows inside that transaction, so a slow tunnel never has to buffer a whole table; other tables stream in one result. It requires InnoDB for every table it reads. No lock, write, schema change, dump privilege, superuser, SSH key or AWS discovery permission is needed.

```sh
node scripts/export-legacy.mjs snapshot \
  --project PROJECT_UUID --revision LEGACY_GIT_SHA --ai-model gpt-5.6-luna \
  --mail-from-domain LEGACY_MAIL_FROM_DOMAIN \
  --output exports/company.snapshot.json
```

Supply the legacy installation’s `MAIL_FROM_DOMAIN` as `--mail-from-domain`; project inbound addresses are `slug@mail.<domain>`. It is separate from the project website and sender address. The wrapper takes it from `LEGACY_MAIL_FROM_DOMAIN`. Choose the native AI model explicitly. The legacy `ais` table has no model field; the example is the native edition's configured OpenAI default, not a recovered historical model. No provider work runs during import.

The snapshot retains UUIDs, all selected noncredential columns, SQL decimals/BIGINTs as strings, JSON as JSON, and UTC timestamps. It includes direct project tables, conversation children, article/category pivots, dataset files, referenced human/AI authors, matching global AI defaults, scoped polymorphic media and image variants. It fails for unclassified tables instead of silently claiming to export them. The current scope and credential omissions are in `scripts/legacy-export/scope.mjs`. Secret-like column names and content require explicit classification in `secrets.mjs`: nested JSON (including JSON in TEXT), credential assignments, provider tokens, hashes and encrypted-looking payloads fail closed before publication. Widget cache checksums and numeric provider token counts have narrow export classifications. A new unknown secret-like field stops the export; errors name the source column without printing its value. The attachments step also refuses old or edited snapshots containing omitted fields. The integration schema includes the 53-table live shape captured on 16 October 2026, including the newer local-computer/delegation and refresh fields.

Passwords, remember/invitation/contact-key tokens, verification/shared keys, their crypto-only references and GitHub access tokens are omitted. `collector_actions.action` is dropped: it is encrypted visitor telemetry whose key is deliberately omitted, and retaining it has no support-history use. Nothing decrypts or archives that payload. Raw crawler HTML, crawler exception text, encrypted actions, captured page HTML, collected browsing payloads/summaries and raw MIME transport are omitted: these duplicate rendered content/verified attachments or repeat visitor URL credentials. Their non-payload metadata remains archived. The known `contacts.metadata.admin` capability URL and `conversations.metadata.customer_reply` and `.suggestions` runtime trigger/composer caches are removed explicitly and counted in the manifest; unknown nested secret fields still stop export. Browser user-agent headers are omitted as visitor telemetry. Reviewed credential assignments, authentication signatures, HTTP cookies, hidden authentication form values, HAR headers and URL capability values in rendered support text are replaced by `<redacted>` and counted. These include prefix-typed `sk_`/`rk_` keys (also with Markdown's escaped underscore), `curl -u user:secret` and `-u key:` Basic credentials, URL userinfo with or without a user (`redis://:password@host`), unquoted credential values up to the next space, 2FA setup keys written in 4-character groups and `pwd` meeting links. A value removed in one place is removed wherever the project's text repeats it, and so is every 16+ character token inside it. Opaque runs of 32 or more characters are judged against the entropy a random string of that length would show, which removes about 99% of random mixed-case secrets while word, number and date slugs stay readable. Unverified opaque URLs are omitted as potential access capabilities; documented public avatar, video, document and integration-invitation identifiers remain references. Unclassified opaque diagnostic values are omitted as potential credentials too; their omission counts are explicit. Unknown assignments, JSON fields and encrypted envelopes still fail closed. Braintree authentication/payment nonce fields are omitted; its [public client configuration IDs](https://developer.paypal.com/braintree/graphql/reference/) remain identifiers. [Gravatar hashes](https://docs.gravatar.com/rest/hash/) are public avatar identifiers; [Google Drive resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys) remain omitted access capabilities. Code variable references and explicit documentation placeholders remain readable. Reviewed public asset identifiers, Gravatar email digests, AI evidence checksums and numeric cache token counters have narrow noncredential classifications. Opaque provider continuation IDs/signatures in `message_thinkings.thinking_id` and `message_thinkings.signature` are also omitted; they are unnecessary to read the retained conversation. Asymmetric/contact shared-key tables, auth resets, queues, Telescope and the unrelated waitlist are excluded. The snapshot records names of excluded tables and omitted columns. Other original business fields remain in the importer's archive, including unsupported fields and soft-deleted records.

## Attachments

```sh
# Directory must contain the original bucket's key tree (not renamed files).
node scripts/export-legacy.mjs attachments \
  --input exports/company.snapshot.json --objects-dir /private/copied-bucket \
  --output exports/company.import.json

# Or read only the exact S3 keys from the snapshot.
node scripts/export-legacy.mjs attachments \
  --input exports/company.snapshot.json --bucket CONFIRMED_BUCKET --region us-east-1 \
  --output exports/company.import.json
```

S3 uses only `s3:GetObject` through AWS CLI `s3api get-object`, with explicit `LEGACY_AWS_ACCESS_KEY_ID`, `LEGACY_AWS_SECRET_ACCESS_KEY` and optional `LEGACY_AWS_SESSION_TOKEN`. It ignores existing AWS profiles/config and never lists or writes the bucket. Add `kms:Decrypt` for the specific KMS key only if these objects use SSE-KMS. Local `public` media must be supplied from its filesystem root; other disks fail explicitly. Missing objects and wrong sizes fail. Bytes are base64 encoded with SHA-256 and copied into native local R2 by the importer. Original S3 keys, filenames and media joins stay in the artifact. Non-message media is retained in R2/archive; inline article images and logos still need the separate URL-rewrite work described below.

For production-sized projects use directory output:

```sh
node scripts/export-legacy.mjs snapshot --project PROJECT_UUID --revision LEGACY_REVISION \
  --ai-model gpt-5.6-luna --mail-from-domain LEGACY_MAIL_FROM_DOMAIN \
  --chunk-bytes 4194304 --output /private/company/snapshot
node scripts/export-legacy.mjs attachments --input /private/company/snapshot \
  --bucket CONFIRMED_BUCKET --region us-east-1 --output /private/company/import
node scripts/import-legacy.mjs --file /private/company/import --apply --persist-to .wrangler/state
```

The wrapper uses this format. Rows stream into bounded JSON chunks (4 MiB by default; a larger individual row fails explicitly). Media streams into separate binary files with exact byte counts and SHA-256; aggregate media has no JSON/base64 or heap-size limit. Import verifies every chunk, count and object before writing, then imports rows in dependency order and writes objects to R2 in bounded multipart chunks. Local apply holds an exclusive persistence lock because R2 multipart completion has no conditional-write option. A compact relationship context preserves transcript revisions, deleted-parent handling and attachment associations across chunk boundaries. Imported credentials remain revoked and running work is held. Replaying the same package resumes the exact chunk runs; unchanged exports retain canonical identity.

The manifest records exported counts and independent SQL counts from the same read-only snapshot. Both must match. `LEGACY_MYSQL_EXPECTED_SERVER_PREFIX` optionally checks Aurora identity before starting; the clone run requires `hh-export-clone-`. `--defer-mail-domain` explicitly records missing mailbox configuration without inventing an address. Such a package still imports: the legacy sender name and address are kept, no inbound address is created, email stays disabled, and a `legacy_import_holds` row asks the operator to set and verify the domain before enabling email. Imported mail settings are always disabled, because nothing here can verify them. Default snapshot behavior still requires the domain.

The original single-file format retains its bounds: 256 MiB of row JSON, 256 MiB of raw attachments and 512 MiB of final JSON. Increase only with an explicit `--max-row-bytes`, `--max-object-bytes`, or `--max-json-bytes` byte count and adequate local memory. These single-file memory bounds do not apply to the directory format; use chunks for large projects. There is no silent truncation.

Outputs are private (0600), exclusively created and published after success. Existing files are never replaced. Snapshot extraction must restart after interruption; the consistent transaction cannot resume on a later connection. The completed snapshot is immutable. Retry only the attachments step from it with a new output path. Attachment copying is read-only and may safely repeat; it has no durable byte cache. Import resumes per row from the exact final artifact.

For an owner-run export in a checkout already on `hh/legacy-export`, with the environment above plus `LEGACY_S3_BUCKET`, `LEGACY_AWS_REGION` and `LEGACY_MAIL_FROM_DOMAIN`:

```sh
bash scripts/legacy-export/export-project.sh PROJECT_UUID LEGACY_GIT_SHA gpt-5.6-luna exports/company
```

Run once per project into a distinct directory. The resulting `import/` and `snapshot/` packages contain private support data: transfer them through the owner's private channel, never Git or a public PR.

## Native import

Use an isolated native checkout. Start local state/migrations through `rer dev`, then stop it before importing; alternatively prepare/apply local migrations directly. Keep the completed artifact for resume.

```sh
pnpm run migrations:prepare
pnpm exec wrangler d1 migrations apply DB --local --persist-to .wrangler/state
node scripts/import-legacy.mjs --file exports/company.import.json
node scripts/import-legacy.mjs --file exports/company.import.json --apply --persist-to .wrangler/state
```

The plan is read-only. Apply writes only local D1/R2. Bundle digest is the run identity; source rows and canonical writes commit together. Exact replay skips every completed row. A new artifact must match existing canonical bytes or stops without overwriting them. Earlier committed rows remain after a later conflict; resume the exact artifact. This is a migration/replay tool, not an incremental synchronizer or a cutover procedure.

Native mappings preserve conversation/message/note/contact/article/category/macro IDs. Local-agent identity JSON, media alt text and global inbox appearance have no corresponding persisted native field and remain archived. Refresh preferences and successful refresh time survive; pending claims, crawl webhook tokens and credentials are omitted, and scheduled paid work is held.

Internal notes come from `events.type=INTERNAL_NOTE` and remain private. Draft categories use nullable `published_at`; deleted records are archive-only, including dependent transcripts. Preferred contact name/email and original file names survive. Invitees with no user stay archive-only. Old credentials are not native logins; recover/pair/reconnect through native flows separately.

Project `website` supplies the allowed origin. Raw widget/availability settings, responder IDs, timezone, help-center HTTPS URL and logo URL are retained in project settings. Category order/nesting, crawl exclusions and limits, closed insight state, disabled sender/mailbox settings and project slug aliases map into native live fields; unsupported legacy widget defaults, proxy controls and billing fields remain archived. This does not configure DNS, sending domains, mail credentials, providers or legacy-widget compatibility.

## Deliberate boundaries

Omitted: `ai_logs` (operational model request/response logs), page views and collector/tracking events, auth/pairing handshakes and empty prompt-plan caches. Exported conversation event types are `INTERNAL_NOTE`, `AGENT_ASSIGNED` and `USED_INSIGHT`: the support cases rendered by the legacy conversation UI. Assignment/insight history maps to native attributed transcript events; current status and participants come from their durable rows. Event media follows the retained event scope. Delegations, progress events and project device settings have native fields and import with authority disabled; their media remains in the archive/R2.

Archive-only: read/notification maps, connection/proxy state, leads, AI thinking/optimizations, legacy billing/account fields, non-payload collector and summary metadata, provider-only dataset references, non-message media associations, pending invites and deleted rows. Retain these in the private original bundle and `legacy_import_rows` for later decisions. No jobs or provider requests replay. Retained dataset markdown maps only when publication provenance permits it. AI profiles use an explicit chosen native model and original/default prompts. Plugins retain their configuration but must be reviewed before use.

Build before cutover: rewriting article inline media/avatar/background URLs to authorized native object URLs; translating unsupported legacy widget overrides/defaults and availability behavior; recreating live mail/provider/integration configuration with native credentials. Legacy access tokens, passwords and encryption keys are deliberately dropped, not migrated. Redis sessions/cache, open sockets and SQS execution state are dropped; durable conversations and support content come from MySQL/media, not Redis.

## Local integration

`pnpm run test:legacy-export` requires an isolated local/CI MySQL admin supplied by `LEGACY_TEST_MYSQL_HOST`, `LEGACY_TEST_MYSQL_PORT`, `LEGACY_TEST_MYSQL_USER`, `LEGACY_TEST_MYSQL_PASSWORD`, optional `LEGACY_TEST_MYSQL_SOCKET`. It creates and deletes only its randomly named test database/user. It loads the complete migration-derived final schema (53 tables and 580 columns from the live shape, with synthetic rows only) and realistic ChargeDesk/12ui fixtures, grants a SELECT-only reader, runs both exporter commands, invokes the importer's public command twice per project and checks actual local D1/R2 content, privacy, publication, tenant separation and replay. `LEGACY_TEST_OUTPUT` keeps synthetic artifacts outside the checkout for local UI inspection. CI runs this single integration test against MySQL 8.4.
