-- A new message raises the context revision of its conversation's contact and of
-- its author. The previous form's OR could use only the project prefix of the
-- (project_id, subject_id) key, reading every subject of the workspace for each
-- message; the same two subjects are now reached through the key.
DROP TRIGGER context_message_added;
CREATE TRIGGER context_message_added AFTER INSERT ON messages WHEN NOT EXISTS(SELECT 1 FROM move_in_native_fences f WHERE f.project_id=NEW.project_id AND f.conversation_id=NEW.conversation_id) BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id IN (SELECT contact_id FROM conversations WHERE id=NEW.conversation_id AND project_id=NEW.project_id UNION SELECT NEW.actor_id); END;
