-- Restore the identical 115 runtime guard after the 125 email-proof backfill.
-- This migration changes no row. Finish all migrations before serving traffic.
CREATE TRIGGER native_integration_erasure AFTER UPDATE OF metadata_json ON contacts WHEN json_extract(NEW.metadata_json,'$.is_erasing')=1 OR json_extract(NEW.metadata_json,'$.is_erased')=1 BEGIN
 DELETE FROM integration_deliveries WHERE namespace=NEW.project_id AND id IN (SELECT i.id FROM native_integration_intents i JOIN native_integration_events e ON e.id=i.event_id WHERE e.project_id=NEW.project_id AND e.contact_id=NEW.id);
 UPDATE native_integration_intents SET error_code='contact_erased',prepared_at=COALESCE(prepared_at,unixepoch()*1000) WHERE event_id IN (SELECT id FROM native_integration_events WHERE project_id=NEW.project_id AND contact_id=NEW.id);
 UPDATE native_integration_events SET body='{}',conversation_id=NULL,contact_id=NULL,erased_at=unixepoch()*1000 WHERE project_id=NEW.project_id AND contact_id=NEW.id;
END;
