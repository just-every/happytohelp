CREATE TABLE credentials(user_id TEXT PRIMARY KEY REFERENCES users(id),password_hash TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE identity_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),project_id TEXT NOT NULL REFERENCES projects(id),email TEXT NOT NULL,role TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('invite','reset')),expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE login_attempts(key TEXT PRIMARY KEY,failures INTEGER NOT NULL,window_start INTEGER NOT NULL);
