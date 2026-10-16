-- An address a widget visitor typed is a notification preference, never inbound
-- mail authority. Mark existing widget contacts whose address no signature names.
UPDATE contacts SET metadata_json=json_set(coalesce(metadata_json,'{}'),'$.email_unproven',1)
 WHERE (email IS NOT NULL OR json_extract(metadata_json,'$.provided_email') IS NOT NULL)
 AND NOT (coalesce(is_verified,0)=1 AND email IS NOT NULL AND lower(trim(external_id))=lower(trim(email)) AND json_extract(metadata_json,'$.provided_email') IS NULL)
 AND EXISTS(SELECT 1 FROM sessions s WHERE s.contact_id=contacts.id AND s.project_id=contacts.project_id AND s.role='contact');
