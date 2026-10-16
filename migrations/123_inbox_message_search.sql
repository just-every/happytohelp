-- Retained and newly admitted messages share one index, including import/undo
-- and erasure writes. No historical provider work is replayed by this migration.
CREATE VIRTUAL TABLE inbox_message_search USING fts5(content, conversation_id UNINDEXED, project_id UNINDEXED, content='messages', content_rowid='rowid');
INSERT INTO inbox_message_search(inbox_message_search) VALUES('rebuild');
CREATE TRIGGER inbox_message_search_insert AFTER INSERT ON messages BEGIN
 INSERT INTO inbox_message_search(rowid,content,conversation_id,project_id) VALUES(new.rowid,new.content,new.conversation_id,new.project_id);
END;
CREATE TRIGGER inbox_message_search_delete AFTER DELETE ON messages BEGIN
 INSERT INTO inbox_message_search(inbox_message_search,rowid,content,conversation_id,project_id) VALUES('delete',old.rowid,old.content,old.conversation_id,old.project_id);
END;
CREATE TRIGGER inbox_message_search_update AFTER UPDATE ON messages BEGIN
 INSERT INTO inbox_message_search(inbox_message_search,rowid,content,conversation_id,project_id) VALUES('delete',old.rowid,old.content,old.conversation_id,old.project_id);
 INSERT INTO inbox_message_search(rowid,content,conversation_id,project_id) VALUES(new.rowid,new.content,new.conversation_id,new.project_id);
END;
CREATE INDEX conversations_contact_history ON conversations(project_id,contact_id,updated_at DESC,id);
