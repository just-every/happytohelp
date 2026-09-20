UPDATE project_settings
SET settings_json=json_set(settings_json,'$.retired_inbound_address',(SELECT inbound_address FROM email_settings WHERE email_settings.project_id=project_settings.project_id),'$.mailbox_archived_at',json_extract(settings_json,'$.deleted_at')),updated_at=coalesce(json_extract(settings_json,'$.deleted_at'),updated_at)
WHERE json_extract(settings_json,'$.deleted_at') IS NOT NULL
  AND EXISTS(SELECT 1 FROM email_settings WHERE email_settings.project_id=project_settings.project_id AND inbound_address IS NOT NULL);

UPDATE email_settings
SET inbound_address=NULL,is_enabled=0,updated_at=coalesce((SELECT json_extract(settings_json,'$.deleted_at') FROM project_settings WHERE project_settings.project_id=email_settings.project_id),updated_at)
WHERE project_id IN(SELECT project_id FROM project_settings WHERE json_extract(settings_json,'$.deleted_at') IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS email_settings_active_inbound_ci
ON email_settings(lower(inbound_address))
WHERE is_enabled=1 AND inbound_address IS NOT NULL;
