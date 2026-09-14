CREATE TABLE conversation_buckets(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),created_at INTEGER NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}');
ALTER TABLE messages ADD COLUMN bucket_id TEXT;
