CREATE TABLE ticket_views (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 owner_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL,
 visibility TEXT NOT NULL CHECK(visibility IN ('personal','shared')),
 filters_json TEXT NOT NULL CHECK(json_valid(filters_json)),
 sort_json TEXT NOT NULL CHECK(json_valid(sort_json)),
 version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX ticket_views_workspace ON ticket_views(project_id,visibility,owner_id);
