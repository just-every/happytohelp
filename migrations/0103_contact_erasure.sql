-- Erased message rows keep their identity, revision and frontier; only content is removed.
ALTER TABLE messages ADD COLUMN erased_at INTEGER;
-- Non-identifying erasure audit: who requested it, when, and how many records were removed.
CREATE TABLE contact_erasures(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,erased_by TEXT NOT NULL,erased_at INTEGER NOT NULL,last_erased_at INTEGER NOT NULL,runs INTEGER NOT NULL DEFAULT 1,conversations INTEGER NOT NULL DEFAULT 0,messages INTEGER NOT NULL DEFAULT 0,attachments INTEGER NOT NULL DEFAULT 0,tracked_events INTEGER NOT NULL DEFAULT 0,context_records INTEGER NOT NULL DEFAULT 0,sessions INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,contact_id));
-- Durable R2 deletion ledger: staged before objects are deleted, cleared by the atomic D1 erasure.
CREATE TABLE contact_erasure_objects(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('media','local_attachment')),source_id TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(project_id,contact_id,kind,source_id));
