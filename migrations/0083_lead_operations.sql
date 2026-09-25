ALTER TABLE leads ADD COLUMN source TEXT NOT NULL DEFAULT 'happytohelp';
ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN subject TEXT;
ALTER TABLE leads ADD COLUMN content TEXT;
ALTER TABLE leads ADD COLUMN website_html TEXT;
ALTER TABLE leads ADD COLUMN error TEXT;
ALTER TABLE leads ADD COLUMN sent_at INTEGER;
CREATE TABLE lead_jobs(id TEXT PRIMARY KEY,lead_id TEXT NOT NULL REFERENCES leads(id),state TEXT NOT NULL,provider_started INTEGER NOT NULL DEFAULT 0,usage_json TEXT,error TEXT,created_at INTEGER NOT NULL,started_at INTEGER,finished_at INTEGER);
CREATE UNIQUE INDEX lead_one_job ON lead_jobs(lead_id) WHERE state IN ('queued','running','uncertain');
