-- Passwordless sign-in has its own single-use capability, independent of recovery and invitations.
CREATE TABLE magic_signins(
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 project_id TEXT REFERENCES projects(id),
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER
);
CREATE INDEX magic_signins_expiry ON magic_signins(expires_at);
