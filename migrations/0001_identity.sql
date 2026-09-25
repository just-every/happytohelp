PRAGMA foreign_keys=ON;
CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,widget_key TEXT UNIQUE NOT NULL,allowed_origin TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE memberships(project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','operator')),PRIMARY KEY(project_id,user_id));
CREATE TABLE contacts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT,email TEXT,external_id TEXT,created_at INTEGER NOT NULL,UNIQUE(project_id,external_id));
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,actor_id TEXT NOT NULL,project_id TEXT NOT NULL REFERENCES projects(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','operator','contact')),contact_id TEXT REFERENCES contacts(id),expires_at INTEGER NOT NULL,revoked_at INTEGER);
