// Assistance may use the explicit project audience default even when a human owns
// the conversation. Automatic replies require the conversation's selected AI.
export const assistanceProfileSql = `COALESCE((SELECT a.id FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id AND a.project_id=c.project_id AND a.is_enabled=1 WHERE ca.conversation_id=c.id),(SELECT a.id FROM project_settings ps JOIN ai_profiles a ON a.id=json_extract(ps.settings_json,CASE WHEN (SELECT is_verified FROM contacts WHERE id=c.contact_id)=1 THEN '$.default_verified_user_ai_id' ELSE '$.default_visitor_ai_id' END) AND a.project_id=c.project_id AND a.is_enabled=1 WHERE ps.project_id=c.project_id))`
export const replyProfileSql = `(SELECT ai_id FROM conversation_ai WHERE conversation_id=c.id)`
