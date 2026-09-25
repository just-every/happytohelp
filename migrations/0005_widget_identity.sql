ALTER TABLE projects ADD COLUMN verification_secret TEXT;
ALTER TABLE contacts ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
