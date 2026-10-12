-- Workspace credentials outlive their issuer's membership. Authority revisions
-- fence issuance only; token use is fenced by the token's own live grant.
CREATE TABLE integration_authority_epoch(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
INSERT INTO integration_authority_epoch VALUES(1,0);
CREATE TABLE native_integration_destinations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL CHECK(kind IN ('webhook','slack')),name TEXT NOT NULL,mode TEXT,events_json TEXT NOT NULL,secret_ciphertext TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
CREATE INDEX native_integration_destinations_project ON native_integration_destinations(project_id,kind);
CREATE TABLE native_integration_events(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT,contact_id TEXT,event TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL,erased_at INTEGER);
CREATE TABLE native_integration_intents(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,event_id TEXT NOT NULL REFERENCES native_integration_events(id),destination_id TEXT NOT NULL REFERENCES native_integration_destinations(id),prepared_at INTEGER,error_code TEXT,UNIQUE(event_id,destination_id));
CREATE TABLE native_integration_audit(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,resource_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE native_integration_dispatch_cursor(id INTEGER PRIMARY KEY CHECK(id=1),project_id TEXT NOT NULL);
CREATE TRIGGER native_integration_fanout AFTER INSERT ON native_integration_events BEGIN
 INSERT INTO native_integration_intents(id,project_id,event_id,destination_id)
 SELECT lower(hex(randomblob(16))),NEW.project_id,NEW.id,d.id FROM native_integration_destinations d
 WHERE d.project_id=NEW.project_id AND d.enabled=1 AND EXISTS(SELECT 1 FROM json_each(d.events_json) WHERE value=NEW.event);
END;
CREATE TRIGGER native_integration_created AFTER INSERT ON conversation_tracking WHEN NEW.initial_history_complete=1 BEGIN
 INSERT INTO native_integration_events SELECT 'created:'||c.id,c.project_id,c.id,c.contact_id,'conversation.created',json_object('conversation_id',c.id),c.created_at,NULL FROM conversations c WHERE c.id=NEW.conversation_id AND NOT EXISTS(SELECT 1 FROM inbound_emails mail WHERE mail.project_id=c.project_id AND mail.conversation_id=c.id AND mail.automatic=1);
END;
CREATE TRIGGER native_integration_message AFTER INSERT ON conversation_outbox BEGIN
 INSERT OR IGNORE INTO native_integration_events SELECT 'message:'||m.id,m.project_id,m.conversation_id,c.contact_id,'message.created',json_object('conversation_id',m.conversation_id,'message_id',m.id,'revision',m.revision),m.created_at,NULL FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=NEW.message_id AND NOT EXISTS(SELECT 1 FROM inbound_emails mail WHERE mail.project_id=m.project_id AND mail.local_id=m.local_id AND mail.automatic=1 AND mail.conversation_id=m.conversation_id);
END;
CREATE TRIGGER native_integration_resolved AFTER INSERT ON conversation_resolutions BEGIN
 INSERT INTO native_integration_events VALUES('resolved:'||NEW.id,NEW.project_id,NEW.conversation_id,NEW.contact_id,'conversation.resolved',json_object('conversation_id',NEW.conversation_id,'resolution_id',NEW.id,'outcome',NEW.outcome),NEW.resolved_at,NULL);
END;
CREATE TRIGGER native_integration_rated AFTER INSERT ON conversation_rating_history BEGIN
 INSERT INTO native_integration_events SELECT 'rated:'||NEW.id,r.project_id,r.conversation_id,r.contact_id,'conversation.rated',json_object('conversation_id',r.conversation_id,'resolution_id',r.id,'rating',NEW.value,'revision',NEW.revision),NEW.created_at,NULL FROM conversation_resolutions r WHERE r.id=NEW.resolution_id;
END;
-- Delete private retained payloads and prevent recovery of pending erased events.
-- Attempts contain only safe status codes, timestamps and opaque delivery IDs.
CREATE TRIGGER native_integration_erasure AFTER UPDATE OF metadata_json ON contacts WHEN json_extract(NEW.metadata_json,'$.is_erasing')=1 OR json_extract(NEW.metadata_json,'$.is_erased')=1 BEGIN
 DELETE FROM integration_deliveries WHERE namespace=NEW.project_id AND id IN (SELECT i.id FROM native_integration_intents i JOIN native_integration_events e ON e.id=i.event_id WHERE e.project_id=NEW.project_id AND e.contact_id=NEW.id);
 UPDATE native_integration_intents SET error_code='contact_erased',prepared_at=COALESCE(prepared_at,unixepoch()*1000) WHERE event_id IN (SELECT id FROM native_integration_events WHERE project_id=NEW.project_id AND contact_id=NEW.id);
 UPDATE native_integration_events SET body='{}',conversation_id=NULL,contact_id=NULL,erased_at=unixepoch()*1000 WHERE project_id=NEW.project_id AND contact_id=NEW.id;
END;
-- Fence payload persistence against an erasure committed during asynchronous
-- protocol preparation. Base remains unchanged; native custody owns this guard.
CREATE TRIGGER native_integration_delivery_guard BEFORE INSERT ON integration_deliveries WHEN NOT EXISTS(
 SELECT 1 FROM native_integration_intents i JOIN native_integration_events e ON e.id=i.event_id AND e.project_id=i.project_id
 WHERE i.id=NEW.id AND i.project_id=NEW.namespace AND e.erased_at IS NULL
) BEGIN SELECT RAISE(ABORT,'native_event_unavailable'); END;
CREATE TRIGGER integration_epoch_memberships_insert AFTER INSERT ON memberships BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_memberships_update AFTER UPDATE ON memberships BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_memberships_delete AFTER DELETE ON memberships BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_sessions_insert AFTER INSERT ON sessions BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_sessions_update AFTER UPDATE ON sessions BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_sessions_delete AFTER DELETE ON sessions BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_project_settings_insert AFTER INSERT ON project_settings BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_project_settings_update AFTER UPDATE ON project_settings BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_project_settings_delete AFTER DELETE ON project_settings BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_users_insert AFTER INSERT ON users BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_users_update AFTER UPDATE ON users BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_users_delete AFTER DELETE ON users BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_projects_insert AFTER INSERT ON projects BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_projects_update AFTER UPDATE ON projects BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER integration_epoch_projects_delete AFTER DELETE ON projects BEGIN UPDATE integration_authority_epoch SET revision=revision+1 WHERE id=1; END;
