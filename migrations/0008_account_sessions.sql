CREATE TABLE sessions_account(token_hash TEXT PRIMARY KEY,actor_id TEXT NOT NULL,project_id TEXT REFERENCES projects(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','operator','contact')),contact_id TEXT REFERENCES contacts(id),expires_at INTEGER NOT NULL,revoked_at INTEGER,CHECK(project_id IS NOT NULL OR (role='operator' AND contact_id IS NULL)));
INSERT INTO sessions_account SELECT * FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_account RENAME TO sessions;
CREATE TABLE identity_tokens_account(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),project_id TEXT REFERENCES projects(id),email TEXT NOT NULL,role TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('invite','reset')),expires_at INTEGER NOT NULL,consumed_at INTEGER,CHECK(kind='reset' OR project_id IS NOT NULL));
INSERT INTO identity_tokens_account SELECT * FROM identity_tokens;
DROP TABLE identity_tokens;
ALTER TABLE identity_tokens_account RENAME TO identity_tokens;
