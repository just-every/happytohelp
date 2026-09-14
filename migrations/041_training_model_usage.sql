CREATE TABLE training_model_events(id INTEGER PRIMARY KEY AUTOINCREMENT,attempt_id TEXT NOT NULL,project_id TEXT NOT NULL,type TEXT NOT NULL,event_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX training_model_event_attempt ON training_model_events(attempt_id,id);
CREATE TABLE training_model_rounds(attempt_id TEXT NOT NULL,request_id TEXT NOT NULL,project_id TEXT NOT NULL,model TEXT,usage_json TEXT,observed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(attempt_id,request_id));
