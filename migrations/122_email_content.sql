-- Original email text is private transcript data, separate from its visible reply.
ALTER TABLE messages ADD COLUMN content_raw TEXT;
CREATE TRIGGER erase_original_email AFTER UPDATE OF content ON messages
WHEN NEW.content='' AND NEW.content_raw IS NOT NULL
BEGIN
 UPDATE messages SET content_raw=NULL WHERE id=NEW.id;
END;
