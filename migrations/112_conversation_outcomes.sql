-- Only native services create tracking. Import target writes do not create it.
CREATE TABLE message_authorship(message_id TEXT PRIMARY KEY REFERENCES messages(id),project_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('visitor','human','ai','assisted','unknown')),source_kind TEXT,source_id TEXT,source_part TEXT,recorded_at INTEGER NOT NULL);
CREATE INDEX message_authorship_project ON message_authorship(project_id,kind,message_id);
CREATE TABLE conversation_tracking(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id),project_id TEXT NOT NULL,initial_history_complete INTEGER NOT NULL,cycle_history_complete INTEGER NOT NULL,cycle_start_revision INTEGER NOT NULL DEFAULT 0,cycle_start_at INTEGER NOT NULL,cycle_epoch INTEGER NOT NULL DEFAULT 0,first_resolved_at INTEGER,transition_id TEXT);
CREATE TABLE conversation_handoffs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id),agent_id TEXT NOT NULL,revision INTEGER NOT NULL,created_at INTEGER NOT NULL,cycle_epoch INTEGER NOT NULL);
CREATE INDEX conversation_handoffs_cycle ON conversation_handoffs(conversation_id,created_at,revision);
CREATE TABLE conversation_resolutions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id),contact_id TEXT NOT NULL,ordinal INTEGER NOT NULL,resolved_at INTEGER NOT NULL,resolved_revision INTEGER NOT NULL,cycle_start_revision INTEGER NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('ai','assisted','human','unknown')),evidence_json TEXT NOT NULL,reopened_at INTEGER,UNIQUE(conversation_id,ordinal));
CREATE INDEX conversation_resolutions_latest ON conversation_resolutions(project_id,conversation_id,ordinal DESC);
CREATE TABLE conversation_ratings(resolution_id TEXT PRIMARY KEY REFERENCES conversation_resolutions(id),value INTEGER NOT NULL CHECK(value IN (-1,1)),comment TEXT NOT NULL CHECK(length(comment)<=1000),updated_at INTEGER NOT NULL,revision INTEGER NOT NULL);
CREATE TABLE conversation_rating_history(id TEXT PRIMARY KEY,resolution_id TEXT NOT NULL REFERENCES conversation_resolutions(id),value INTEGER NOT NULL CHECK(value IN (-1,1)),comment TEXT NOT NULL CHECK(length(comment)<=1000),created_at INTEGER NOT NULL,revision INTEGER NOT NULL,UNIQUE(resolution_id,revision));
CREATE TABLE reporting_legacy_conversations(project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id),run_id TEXT NOT NULL,PRIMARY KEY(project_id,conversation_id));

CREATE TRIGGER conversation_record_handoff AFTER UPDATE OF assigned_to ON conversations WHEN NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS NOT OLD.assigned_to AND NOT (OLD.resolved_at IS NOT NULL AND NEW.resolved_at IS NULL) AND EXISTS(SELECT 1 FROM conversation_tracking WHERE conversation_id=NEW.id) BEGIN
 INSERT INTO conversation_handoffs SELECT lower(hex(randomblob(16))),NEW.project_id,NEW.id,NEW.assigned_to,NEW.revision,NEW.updated_at,cycle_epoch FROM conversation_tracking WHERE conversation_id=NEW.id;
END;
CREATE TRIGGER conversation_record_reopen AFTER UPDATE OF resolved_at ON conversations WHEN OLD.resolved_at IS NOT NULL AND NEW.resolved_at IS NULL AND EXISTS(SELECT 1 FROM conversation_tracking WHERE conversation_id=NEW.id) BEGIN
 UPDATE conversation_resolutions SET reopened_at=NEW.updated_at WHERE conversation_id=NEW.id AND ordinal=(SELECT MAX(ordinal) FROM conversation_resolutions WHERE conversation_id=NEW.id) AND reopened_at IS NULL;
 UPDATE conversation_tracking SET cycle_history_complete=1,cycle_epoch=cycle_epoch+1,cycle_start_revision=OLD.revision,cycle_start_at=NEW.updated_at WHERE conversation_id=NEW.id;
 INSERT INTO conversation_handoffs SELECT lower(hex(randomblob(16))),NEW.project_id,NEW.id,NEW.assigned_to,NEW.revision,NEW.updated_at,cycle_epoch FROM conversation_tracking WHERE conversation_id=NEW.id AND NEW.assigned_to IS NOT NULL;
END;
CREATE TRIGGER conversation_record_resolution AFTER UPDATE OF resolved_at ON conversations WHEN NEW.resolved_at IS NOT NULL AND (OLD.resolved_at IS NULL OR NEW.revision>OLD.revision) AND EXISTS(SELECT 1 FROM conversation_tracking WHERE conversation_id=NEW.id) BEGIN
 UPDATE conversation_resolutions SET reopened_at=NEW.updated_at WHERE OLD.resolved_at IS NOT NULL AND conversation_id=NEW.id AND ordinal=(SELECT MAX(ordinal) FROM conversation_resolutions WHERE conversation_id=NEW.id) AND reopened_at IS NULL;
 INSERT INTO conversation_resolutions(id,project_id,conversation_id,contact_id,ordinal,resolved_at,resolved_revision,cycle_start_revision,outcome,evidence_json)
 SELECT lower(hex(randomblob(16))),NEW.project_id,NEW.id,NEW.contact_id,COALESCE((SELECT MAX(ordinal)+1 FROM conversation_resolutions WHERE conversation_id=NEW.id),1),NEW.resolved_at,NEW.revision,t.cycle_start_revision,
 CASE
  WHEN EXISTS(SELECT 1 FROM messages m JOIN message_authorship a ON a.message_id=m.id WHERE m.conversation_id=NEW.id AND m.revision>t.cycle_start_revision AND m.revision<=NEW.revision AND a.kind='assisted' AND COALESCE(a.source_kind,'')<>'insight') THEN 'assisted'
  WHEN EXISTS(SELECT 1 FROM messages m JOIN message_authorship a ON a.message_id=m.id WHERE m.conversation_id=NEW.id AND m.revision>t.cycle_start_revision AND m.revision<=NEW.revision AND a.kind='human' AND COALESCE(a.source_kind,'')<>'insight') THEN 'human'
  WHEN t.cycle_history_complete=1 AND NEW.assigned_to IS NULL
   AND EXISTS(SELECT 1 FROM messages m JOIN message_authorship a ON a.message_id=m.id WHERE m.conversation_id=NEW.id AND m.revision>t.cycle_start_revision AND m.revision<=NEW.revision AND a.kind='ai' AND COALESCE(a.source_kind,'')<>'insight')
   AND NOT EXISTS(SELECT 1 FROM messages m LEFT JOIN message_authorship a ON a.message_id=m.id WHERE m.conversation_id=NEW.id AND m.revision>t.cycle_start_revision AND m.revision<=NEW.revision AND m.actor_role<>'contact' AND COALESCE(a.source_kind,'')<>'insight' AND COALESCE(a.kind,'unknown')<>'ai')
   AND NOT EXISTS(SELECT 1 FROM conversation_handoffs h WHERE h.conversation_id=NEW.id AND h.cycle_epoch=t.cycle_epoch) THEN 'ai'
  ELSE 'unknown' END,
 json_object('historyComplete',t.cycle_history_complete,'messages',json((SELECT json_group_array(json_object('id',m.id,'kind',COALESCE(a.kind,'unknown'),'source',a.source_kind,'sourceId',a.source_id)) FROM messages m LEFT JOIN message_authorship a ON a.message_id=m.id WHERE m.conversation_id=NEW.id AND m.revision>t.cycle_start_revision AND m.revision<=NEW.revision AND m.actor_role<>'contact' AND COALESCE(a.source_kind,'')<>'insight')))
 FROM conversation_tracking t WHERE t.conversation_id=NEW.id;
 UPDATE conversation_tracking SET first_resolved_at=CASE WHEN initial_history_complete=1 THEN COALESCE(first_resolved_at,NEW.resolved_at) ELSE first_resolved_at END,cycle_start_revision=NEW.revision,cycle_start_at=NEW.resolved_at,cycle_history_complete=1 WHERE conversation_id=NEW.id;
END;
