/** Used inside the publishing statement so deletion cannot race a separate read. */
export const activeProjectSql = "EXISTS(SELECT 1 FROM projects p WHERE p.id=? AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=p.id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL))"
