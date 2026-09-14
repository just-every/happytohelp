CREATE TABLE user_project_preferences(project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),is_primary INTEGER NOT NULL DEFAULT 0,is_notified_on_unassigned_activity INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,user_id));
CREATE UNIQUE INDEX user_primary_project ON user_project_preferences(user_id) WHERE is_primary=1;
