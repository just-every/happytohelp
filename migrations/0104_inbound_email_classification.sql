ALTER TABLE inbound_emails ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0,1));
ALTER TABLE inbound_emails ADD COLUMN evidence_json TEXT;
ALTER TABLE inbound_emails ADD COLUMN local_id TEXT;
ALTER TABLE inbound_emails ADD COLUMN message_id TEXT;
CREATE INDEX IF NOT EXISTS inbound_emails_local ON inbound_emails(project_id,local_id);
