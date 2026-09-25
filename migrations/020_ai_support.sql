CREATE TABLE ai_generations (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('queued','running','completed','uncertain','cancelled','superseded','failed')),
 source_revision INTEGER NOT NULL, source_context_revision INTEGER NOT NULL DEFAULT 0, source_last_message_id TEXT, actor_json TEXT NOT NULL,
 model TEXT NOT NULL, ai_id TEXT NOT NULL, ai_profile_json TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'reply', instruction TEXT NOT NULL DEFAULT '', options_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT, output_json TEXT
);
CREATE INDEX ai_generation_conversation ON ai_generations(project_id,conversation_id,state);
CREATE TABLE ai_attempts (
 id TEXT PRIMARY KEY, generation_id TEXT NOT NULL REFERENCES ai_generations(id),
 state TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, error TEXT,
 UNIQUE(generation_id)
);
CREATE TABLE ai_round_usage (
 attempt_id TEXT NOT NULL REFERENCES ai_attempts(id), request_id TEXT NOT NULL,
 model TEXT, usage_json TEXT, observed INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(attempt_id,request_id)
);

CREATE TABLE ai_attempt_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL REFERENCES ai_attempts(id),
 type TEXT NOT NULL, event_json TEXT NOT NULL, created_at TEXT NOT NULL
);

