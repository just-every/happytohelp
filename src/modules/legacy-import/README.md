# Legacy data import

This module imports an explicit, portable JSON export into an already-migrated local native edition. It does not connect to MySQL, AWS, production buckets or providers. The command defaults to a read-only plan:

```sh
node scripts/import-legacy.mjs --file /absolute/export.json
node scripts/import-legacy.mjs --file /absolute/export.json --apply --persist-to .wrangler/state
```

Input shape:

```json
{
  "format": "happytohelp-legacy-v1",
  "source": {"repository": "happytohelp", "revision": "exact-source-sha", "exportedAt": "2026-09-14T00:00:00.000Z"},
  "tables": {"projects": [], "users": [], "contacts": [], "conversations": [], "messages": []},
  "objects": [{"key": "legacy/project/attachment", "dataBase64": "...", "sha256": "64-hex-digest"}]
}
```

Keep original table/row IDs and all columns. Source queries should use a consistent MySQL snapshot (for example `START TRANSACTION WITH CONSISTENT SNAPSHOT; SELECT * FROM projects; ... COMMIT;`) and a MySQL client JSON encoder that preserves decimal columns as strings. `tables` entries correspond to selected original tables; source extraction is an owner-supplied artifact, not an undocumented database connection inside this tool. Export source provenance and the chosen project filter alongside the artifact. Filter all child tables through the same project set; include referenced users, categories, conversation contacts and devices. The importer rejects conflicting project references and conflicting existing canonical rows.

Required deliberate export enrichment:

* Projects supply `allowed_origin` or their original `website`/`website_url`/`url`; the mapper retains its browser origin. Original widget settings, availability booleans, responder IDs and deletion metadata become native project settings. Supply a chosen `widget_key` or retain project ID as the public key.
* Media supplies `object_key` (or `storage_key`), matching complete bytes in `objects`, plus original filename, type and size. Original polymorphic `mediables` joins attach message files; non-conversation media remains archived until its consumer mapping is provided.
* AI records or `source.aiModel` supply the selected native model identity. No model is guessed. Empty original AI prompt/role inherits its matching `ai_defaults.type` row; original AI users without email retain their identity through the AI profile, rather than becoming login accounts.
* `dataset_files.markdown` (or explicit `content`) becomes a retained published knowledge version only for ready datasets, or the actual retained last-refresh files (explicit `published_file_ids` or timestamps no newer than `last_refreshed_at`); provider file IDs without retained text remain archive-only. No paid re-download or refresh runs.
* Native generation, training and raw provider-usage exports use the explicitly
  named fields in `map-core.ts`, `map-knowledge.ts` and `map-operations.ts`.
  Historical financial SQL and imported financial rows remain retained verbatim
  as immutable archive custody; they do not become active charges, balances,
  checkout or Stripe operations. Original unsupported operation rows remain
  visible as archive-only.

Mapped families include project/membership/contact identity, transcript/revision/frontier and original bucket IDs, notes/participants/media, AI profiles, published knowledge/articles/categories, customer profiles/evidence/insights/summaries, generation attempts/round usage, revoked device/grant custody, delegation/events, training runs/cases and historical financial rows. Every input row is also retained verbatim in `legacy_import_rows`, including deleted, unsupported, financial and unrecognized columns. The plan explicitly lists archive-only rows; preserving them does not claim their application behavior has been normalized. Password hashes and old access tokens are retained only in the source archive; native password recovery and device pairing establish new credentials.

The bundle SHA-256 identifies a run. Each committed row and its canonical writes share one D1 transaction. Resuming the exact artifact skips recorded rows; new artifacts must match existing canonical bytes or fail without overwriting them. Imports are incrementally resumable, not whole-database atomic. Conflict after earlier rows leaves an inspectable partial run. R2 uploads verify their digest, refuse conflicting existing bytes and use conditional creation. The importer does not delete anything and never dispatches jobs.

Pending generation/attempt/training/provider records become `uncertain`; their
raw usage and budget state remains available for review. Historical financial
rows and prior financial SQL remain immutable archive custody and are never
activated as payment or balance behavior. Pending delegated work becomes
cancelled with delivery held. Old grants/devices are revoked.
`legacy_import_holds` records each reconciliation requirement and preserves
original state in the raw archive. A hold is not evidence that a provider did or
did not perform work. Original uppercase project roles, `contacts.blocked_at`, AI
versus human assignment, inherited AI defaults, project website/settings and
delegation `created_by_user_id`/`event_type` are tested as original PHP-shaped
exports, alongside native operation exports. Encrypted collector actions require
explicit `plaintext_action` to become native context actions; the encrypted
original remains archived otherwise.

`tests/legacy-import.mjs` exercises 33 table families with real local D1/R2, original transcript/bucket/knowledge IDs, exact minor-unit money, held operations, deterministic replay, conflict protection and corrupt-object denial. This fixture proof is not an import of a production dump, nor a claim that every archive-only historical system is already normalized.
