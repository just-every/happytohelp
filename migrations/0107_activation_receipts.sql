-- No historical activity is backfilled as an installation validation.
CREATE TABLE activation_receipts (
 project_id TEXT NOT NULL REFERENCES projects(id),
 step_id TEXT NOT NULL CHECK(step_id IN ('owner_mail','sender_dns','inbound_address','model_key','spend_ceilings','published_article','widget_origin','widget_seen')),
 state TEXT NOT NULL CHECK(state IN ('not_checked','checking','pending','done','failed','unavailable','unknown')),
 fingerprint TEXT NOT NULL, checked_at INTEGER NOT NULL, detail TEXT NOT NULL,
 receipt_ref TEXT, check_token TEXT NOT NULL, PRIMARY KEY(project_id,step_id)
);
CREATE TABLE activation_widget_pings (
 project_id TEXT PRIMARY KEY REFERENCES projects(id), origin TEXT NOT NULL,
 checked_at INTEGER NOT NULL, receipt_ref TEXT NOT NULL
);
CREATE TABLE activation_inbound_receipts (
 inbound_id TEXT PRIMARY KEY REFERENCES inbound_emails(id), project_id TEXT NOT NULL REFERENCES projects(id),
 address TEXT NOT NULL, settings_updated_at INTEGER NOT NULL
);
CREATE INDEX activation_inbound_project ON activation_inbound_receipts(project_id,address);
CREATE TRIGGER activation_observe_inbound AFTER INSERT ON inbound_emails
BEGIN
 INSERT INTO activation_inbound_receipts(inbound_id,project_id,address,settings_updated_at)
 SELECT NEW.id,NEW.project_id,lower(inbound_address),updated_at FROM email_settings
 WHERE project_id=NEW.project_id AND is_enabled=1 AND inbound_address IS NOT NULL;
END;
CREATE TRIGGER activation_origin_changed AFTER UPDATE OF allowed_origin ON projects
WHEN OLD.allowed_origin IS NOT NEW.allowed_origin
BEGIN
 DELETE FROM activation_widget_pings WHERE project_id=NEW.id;
 UPDATE activation_receipts SET state='unknown',detail='Widget origin changed. Check again.'
 WHERE project_id=NEW.id AND step_id IN ('widget_origin','widget_seen');
END;
