-- Additive reviewed import journal from the shared Base D1 schema.
CREATE TABLE IF NOT EXISTS ik_jobs (
 id TEXT PRIMARY KEY, destination TEXT NOT NULL, namespace TEXT NOT NULL,
 mapping_version TEXT NOT NULL, principal_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 operation_key TEXT NOT NULL, plan_json TEXT NOT NULL, state TEXT NOT NULL,
 checkpoint INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, fence INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_expires INTEGER, error TEXT,
 UNIQUE(destination, principal_id, operation_key)
);
CREATE TABLE IF NOT EXISTS ik_original_sets (
 job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id), version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ik_originals (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), kind TEXT NOT NULL, original_key TEXT NOT NULL,
 name TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, bytes BLOB,
 PRIMARY KEY(job_id,kind,original_key)
);
CREATE TABLE IF NOT EXISTS ik_sources (
 identity TEXT PRIMARY KEY, source_hash TEXT NOT NULL, mapping_version TEXT NOT NULL,
 effects_hash TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES ik_jobs(id)
);
CREATE TABLE IF NOT EXISTS ik_provenance (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, effect_ordinal INTEGER NOT NULL,
 source_identity TEXT NOT NULL, destination TEXT NOT NULL, target_kind TEXT NOT NULL,
 target_id TEXT NOT NULL, reversed INTEGER NOT NULL DEFAULT 0, record_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ik_active_target ON ik_provenance(destination,target_kind,target_id) WHERE reversed=0;
CREATE TABLE IF NOT EXISTS ik_stages (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), fence INTEGER NOT NULL, effect_id TEXT NOT NULL,
 sha256 TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job_id,fence,effect_id)
);
CREATE TABLE IF NOT EXISTS ik_batches (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), action TEXT NOT NULL, position INTEGER NOT NULL,
 end_position INTEGER NOT NULL, fence INTEGER NOT NULL, PRIMARY KEY(job_id,action,position)
);
CREATE TABLE IF NOT EXISTS ik_targets (
 destination TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
 revision TEXT NOT NULL, value_json TEXT NOT NULL, attachment_json TEXT,
 PRIMARY KEY(destination,kind,id)
);
CREATE TABLE IF NOT EXISTS ik_d1_plan_chunks (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(job_id,ordinal));
CREATE TABLE IF NOT EXISTS ik_d1_original_chunks (job_id TEXT NOT NULL REFERENCES ik_jobs(id), kind TEXT NOT NULL, original_key TEXT NOT NULL, ordinal INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job_id,kind,original_key,ordinal));
CREATE TABLE IF NOT EXISTS ik_d1_history (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, effect_ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, destination TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, reversed INTEGER NOT NULL CHECK(reversed=0), record_json TEXT NOT NULL, successor_id TEXT NOT NULL UNIQUE);
CREATE INDEX IF NOT EXISTS ik_d1_history_job ON ik_d1_history(job_id);
CREATE TABLE IF NOT EXISTS ik_d1_entries (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, owner_job_id TEXT NOT NULL REFERENCES ik_jobs(id), effects_hash TEXT NOT NULL, PRIMARY KEY(job_id,ordinal));
CREATE TABLE IF NOT EXISTS ik_d1_assertions (ok INTEGER NOT NULL CONSTRAINT IMPORT_ATOMIC_GUARD CHECK(ok=1));
CREATE TABLE workspace_tags(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,normalized_name TEXT NOT NULL,UNIQUE(project_id,normalized_name));
CREATE TABLE conversation_tags(project_id TEXT NOT NULL REFERENCES projects(id),conversation_id TEXT NOT NULL REFERENCES conversations(id),tag_id TEXT NOT NULL REFERENCES workspace_tags(id),PRIMARY KEY(conversation_id,tag_id));
CREATE INDEX conversation_tags_filter ON conversation_tags(project_id,tag_id,conversation_id);
CREATE TABLE move_in_runs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),actor_id TEXT NOT NULL REFERENCES users(id),session_hash TEXT NOT NULL,vendor TEXT NOT NULL,filename TEXT NOT NULL,artifact_hash TEXT NOT NULL,object_key TEXT NOT NULL,bytes INTEGER NOT NULL,state TEXT NOT NULL,identity_complete INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0,file_index INTEGER NOT NULL DEFAULT 0,files_json TEXT NOT NULL DEFAULT '[]',diagnostics_json TEXT NOT NULL DEFAULT '[]',parsed_total INTEGER NOT NULL DEFAULT 0,kit_job_id TEXT,review_fingerprint TEXT,total INTEGER NOT NULL DEFAULT 0,plan_json TEXT,report_json TEXT,error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(project_id,vendor,artifact_hash));
CREATE TABLE move_in_records(run_id TEXT NOT NULL REFERENCES move_in_runs(id),ordinal INTEGER NOT NULL,record_json TEXT NOT NULL,serialized TEXT NOT NULL,PRIMARY KEY(run_id,ordinal));
CREATE TABLE move_in_batches(run_id TEXT NOT NULL REFERENCES move_in_runs(id),ordinal INTEGER NOT NULL,plan_key TEXT NOT NULL,fingerprint TEXT NOT NULL,total INTEGER NOT NULL,kit_job_id TEXT,state TEXT NOT NULL DEFAULT 'queued',checkpoint INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(run_id,ordinal));
CREATE INDEX move_in_batches_job ON move_in_batches(kit_job_id,run_id);
CREATE TABLE move_in_origins(project_id TEXT NOT NULL,target_kind TEXT NOT NULL,target_id TEXT NOT NULL,vendor TEXT NOT NULL,source_id TEXT NOT NULL,source_json TEXT NOT NULL,revision TEXT NOT NULL,PRIMARY KEY(project_id,target_kind,target_id));
CREATE TABLE move_in_notes(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id),author_json TEXT NOT NULL,content TEXT NOT NULL,created_at INTEGER NOT NULL,source_time TEXT NOT NULL);
CREATE INDEX move_in_notes_conversation ON move_in_notes(project_id,conversation_id,created_at);
CREATE TABLE move_in_message_sources(message_id TEXT PRIMARY KEY REFERENCES messages(id),project_id TEXT NOT NULL,author_json TEXT NOT NULL,source_id TEXT NOT NULL,source_time TEXT,time_provenance TEXT NOT NULL);
CREATE TABLE move_in_conversations(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id),project_id TEXT NOT NULL,vendor TEXT NOT NULL,source_id TEXT NOT NULL,subject TEXT NOT NULL,source_state TEXT NOT NULL,source_channel TEXT NOT NULL);
-- Import and reversal are inert. The fence exists only within the same D1 batch.
-- ordinary message writes retain their existing context invalidation behavior.
CREATE TABLE move_in_native_fences(project_id TEXT NOT NULL,conversation_id TEXT NOT NULL,PRIMARY KEY(project_id,conversation_id));
DROP TRIGGER context_message_added;
CREATE TRIGGER context_message_added AFTER INSERT ON messages WHEN NOT EXISTS(SELECT 1 FROM move_in_native_fences f WHERE f.project_id=NEW.project_id AND f.conversation_id=NEW.conversation_id) BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND (subject_id IN (SELECT contact_id FROM conversations WHERE id=NEW.conversation_id AND project_id=NEW.project_id) OR subject_id=NEW.actor_id); END;
DROP TRIGGER context_message_removed;
CREATE TRIGGER context_message_removed AFTER DELETE ON messages WHEN NOT EXISTS(SELECT 1 FROM move_in_native_fences f WHERE f.project_id=OLD.project_id AND f.conversation_id=OLD.conversation_id) BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id; END;
CREATE TABLE move_in_erasure_runs(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,run_id TEXT NOT NULL,job_id TEXT,PRIMARY KEY(project_id,contact_id,run_id));
CREATE TABLE move_in_erasure_objects(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,run_id TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(project_id,contact_id,object_key));

-- Bound inbound-reference checks for conflict-safe whole-import undo.
CREATE INDEX move_in_contact_conversations ON conversations(project_id,contact_id);
CREATE INDEX move_in_contact_authors ON messages(project_id,actor_role,actor_id,conversation_id);
CREATE INDEX move_in_contact_participants ON conversation_participants(contact_id,conversation_id);

-- Relevant native identity lookups must not scan unrelated workspace contacts.
CREATE INDEX move_in_contact_external ON contacts(project_id,external_id);

-- Hash-only identity custody exists before asynchronous parsing and review.
CREATE TABLE move_in_identity_links(project_id TEXT NOT NULL,run_id TEXT NOT NULL REFERENCES move_in_runs(id),digest TEXT NOT NULL,source_digest TEXT NOT NULL,PRIMARY KEY(project_id,digest,source_digest,run_id));
CREATE INDEX move_in_identity_source ON move_in_identity_links(project_id,source_digest,digest,run_id);
CREATE INDEX move_in_identity_run ON move_in_identity_links(run_id);
CREATE TABLE move_in_erased_identities(project_id TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(project_id,digest));

-- The incremental identity index preserves Unicode email comparison semantics.
CREATE TABLE move_in_contact_keys(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,email_digest TEXT,PRIMARY KEY(project_id,contact_id));
CREATE INDEX move_in_contact_key_pending ON move_in_contact_keys(project_id,contact_id) WHERE email_digest IS NULL;
CREATE INDEX move_in_contact_key_email ON move_in_contact_keys(project_id,email_digest,contact_id);
INSERT INTO move_in_contact_keys(project_id,contact_id) SELECT project_id,id FROM contacts WHERE email IS NOT NULL;
CREATE TRIGGER move_in_contact_key_added AFTER INSERT ON contacts WHEN NEW.email IS NOT NULL BEGIN INSERT OR REPLACE INTO move_in_contact_keys(project_id,contact_id) VALUES(NEW.project_id,NEW.id); END;
CREATE TRIGGER move_in_contact_key_changed AFTER UPDATE OF email ON contacts WHEN OLD.email IS NOT NEW.email BEGIN DELETE FROM move_in_contact_keys WHERE project_id=OLD.project_id AND contact_id=OLD.id; INSERT INTO move_in_contact_keys(project_id,contact_id) SELECT NEW.project_id,NEW.id WHERE NEW.email IS NOT NULL; END;
CREATE TRIGGER move_in_contact_key_removed AFTER DELETE ON contacts BEGIN DELETE FROM move_in_contact_keys WHERE project_id=OLD.project_id AND contact_id=OLD.id; END;

-- Relevant complete-bundle lookups use conversation indexes, not workspace scans.
CREATE INDEX move_in_native_messages ON messages(project_id,conversation_id,id);
CREATE INDEX move_in_native_notes ON conversation_notes(conversation_id,id);
CREATE INDEX move_in_native_media ON media(conversation_id,id);
CREATE INDEX move_in_native_buckets ON conversation_buckets(conversation_id,id);
