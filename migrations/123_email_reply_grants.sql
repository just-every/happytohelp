-- Opaque reply addresses bind possession of a recipient's mail to this thread.
CREATE TABLE email_reply_grants(
 token_hash TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 conversation_id TEXT NOT NULL REFERENCES conversations(id),
 recipient TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX email_reply_grants_conversation ON email_reply_grants(project_id,conversation_id);
