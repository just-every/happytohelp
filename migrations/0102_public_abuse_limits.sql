CREATE TABLE abuse_counters(key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,used INTEGER NOT NULL CHECK(used>=0),expires_at INTEGER NOT NULL);
CREATE INDEX abuse_counters_expiry ON abuse_counters(expires_at);
