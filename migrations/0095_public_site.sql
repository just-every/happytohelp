CREATE TABLE public_waitlist (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 website_url TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 request_hash TEXT NOT NULL,
 notification_status TEXT NOT NULL DEFAULT 'not_configured'
);
CREATE INDEX public_waitlist_admission ON public_waitlist(request_hash,created_at);
CREATE TABLE public_project_aliases (
 slug TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
);
