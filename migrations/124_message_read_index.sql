-- First read observations live in the attributed event store.
CREATE INDEX context_message_read ON context_tracked_events(project_id,json_extract(payload,'$.message_id')) WHERE type='MESSAGE_READ' AND json_valid(payload);
