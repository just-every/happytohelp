CREATE TABLE context_subjects(project_id TEXT NOT NULL,subject_id TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,subject_id));
CREATE TABLE context_evidence(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,source TEXT NOT NULL,content TEXT NOT NULL,visibility TEXT NOT NULL,occurred_at INTEGER NOT NULL,UNIQUE(project_id,subject_id,id));
CREATE INDEX context_evidence_subject ON context_evidence(project_id,subject_id,occurred_at);
CREATE TABLE context_profiles(project_id TEXT NOT NULL,subject_id TEXT NOT NULL,type TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}',evidence_fingerprint TEXT,generated_count INTEGER NOT NULL DEFAULT 0,started_at INTEGER,PRIMARY KEY(project_id,subject_id,type));
CREATE TABLE context_insights(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,help_type TEXT NOT NULL,content TEXT NOT NULL,buttons TEXT NOT NULL,evidence_ids TEXT NOT NULL,created_at INTEGER NOT NULL,dismissed_at INTEGER);
