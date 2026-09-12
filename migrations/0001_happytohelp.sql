PRAGMA foreign_keys = ON;
CREATE TABLE operators (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES operators(id), expires_at TEXT NOT NULL);
CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT, created_at TEXT NOT NULL);
CREATE TABLE requests (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), subject TEXT NOT NULL, customer_email TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, revoked_at TEXT, created_at TEXT NOT NULL, last_seen_at TEXT);
CREATE TABLE agent_workspaces (agent_id TEXT NOT NULL REFERENCES agents(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id), PRIMARY KEY(agent_id,workspace_id));
CREATE TABLE jobs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id), assigned_agent_id TEXT REFERENCES agents(id), mode TEXT NOT NULL CHECK(mode IN ('investigate','resolve','resolve_reply')), instructions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', agent_id TEXT REFERENCES agents(id), session_id TEXT, run_id TEXT, lease_expires_at TEXT, result_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX one_active_job ON jobs(request_id) WHERE status IN ('queued','running','needs_input');
CREATE TABLE events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), run_id TEXT, kind TEXT NOT NULL, payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX events_job ON events(job_id,created_at);
CREATE TABLE attachments (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), run_id TEXT NOT NULL, agent_id TEXT NOT NULL REFERENCES agents(id), content_type TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE replies (id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), job_id TEXT NOT NULL REFERENCES jobs(id), body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('proposed','approved','sending','accepted','failed','uncertain')), provider_id TEXT, error TEXT, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TEXT NOT NULL);
