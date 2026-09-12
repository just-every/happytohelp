ALTER TABLE requests ADD COLUMN current_job_id TEXT REFERENCES jobs(id);
UPDATE requests SET current_job_id=(SELECT id FROM jobs WHERE request_id=requests.id ORDER BY created_at DESC,rowid DESC LIMIT 1);
ALTER TABLE replies ADD COLUMN attempt_id TEXT;
ALTER TABLE replies ADD COLUMN submission_expires_at TEXT;
UPDATE replies SET attempt_id='legacy-'||id,submission_expires_at=strftime('%Y-%m-%dT%H:%M:%fZ',updated_at,'+30 seconds') WHERE status IN ('sending','uncertain');
