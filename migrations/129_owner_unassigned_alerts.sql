-- A workspace where no member is alerted to new unassigned conversation activity alerts its owner, so a solo owner hears about new conversations. Workspaces where any member already gets these alerts are unchanged, and every member can still switch them off.
INSERT INTO user_project_preferences(project_id,user_id,is_notified_on_unassigned_activity)
SELECT m.project_id,m.user_id,1 FROM memberships m JOIN projects p ON p.id=m.project_id LEFT JOIN project_settings s ON s.project_id=p.id
WHERE m.role='owner' AND COALESCE(json_extract(s.settings_json,'$.is_demo'),0)<>1 AND json_extract(s.settings_json,'$.deleted_at') IS NULL
AND NOT EXISTS(SELECT 1 FROM user_project_preferences pref WHERE pref.project_id=m.project_id AND pref.is_notified_on_unassigned_activity=1)
ON CONFLICT(project_id,user_id) DO UPDATE SET is_notified_on_unassigned_activity=1;
