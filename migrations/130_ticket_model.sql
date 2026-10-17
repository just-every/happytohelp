ALTER TABLE conversations ADD COLUMN status_id TEXT NOT NULL DEFAULT 'new';
ALTER TABLE conversations ADD COLUMN status_category TEXT NOT NULL DEFAULT 'new' CHECK(status_category IN ('new','open','pending','on_hold','solved','closed'));
ALTER TABLE conversations ADD COLUMN subject TEXT NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'));
ALTER TABLE conversations ADD COLUMN channel TEXT NOT NULL DEFAULT 'widget';
ALTER TABLE conversations ADD COLUMN brand_id TEXT;
ALTER TABLE conversations ADD COLUMN group_id TEXT;
ALTER TABLE conversations ADD COLUMN requester_id TEXT;
ALTER TABLE conversations ADD COLUMN submitter_id TEXT;
ALTER TABLE conversations ADD COLUMN submitter_type TEXT NOT NULL DEFAULT 'contact';
ALTER TABLE conversations ADD COLUMN ticket_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN ticket_actor_id TEXT;
ALTER TABLE conversations ADD COLUMN ticket_actor_type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE conversations ADD COLUMN ticket_source TEXT NOT NULL DEFAULT 'system';
CREATE TABLE ticket_statuses(project_id TEXT NOT NULL REFERENCES projects(id),id TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('new','open','pending','on_hold','solved','closed')),is_default INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,id));
CREATE TABLE ticket_groups(project_id TEXT NOT NULL REFERENCES projects(id),id TEXT NOT NULL,name TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,id));
CREATE TABLE ticket_group_members(project_id TEXT NOT NULL,group_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(project_id,group_id,user_id),FOREIGN KEY(project_id,group_id) REFERENCES ticket_groups(project_id,id) ON DELETE CASCADE,FOREIGN KEY(project_id,user_id) REFERENCES memberships(project_id,user_id) ON DELETE CASCADE);
CREATE TABLE ticket_fields(project_id TEXT NOT NULL REFERENCES projects(id),id TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('text','number','decimal','date','dropdown','multiselect','checkbox','regex')),required INTEGER NOT NULL DEFAULT 0,options_json TEXT NOT NULL DEFAULT '[]',validation_json TEXT NOT NULL DEFAULT '{}',read_roles_json TEXT NOT NULL DEFAULT '[]',write_roles_json TEXT NOT NULL DEFAULT '[]',updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,id));
CREATE TABLE ticket_field_values(project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,field_id TEXT NOT NULL,value_json TEXT NOT NULL,PRIMARY KEY(project_id,conversation_id,field_id),FOREIGN KEY(project_id,field_id) REFERENCES ticket_fields(project_id,id) ON DELETE CASCADE);
CREATE TABLE ticket_history(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,actor_id TEXT,actor_type TEXT NOT NULL,source TEXT NOT NULL,at INTEGER NOT NULL,changes_json TEXT NOT NULL);
CREATE INDEX ticket_history_conversation ON ticket_history(project_id,conversation_id,at);
CREATE INDEX ticket_status_queue ON conversations(project_id,status_category,priority,updated_at);
INSERT INTO ticket_statuses SELECT p.id,json_extract(s.value,'$.id'),json_extract(s.value,'$.name'),json_extract(s.value,'$.id'),1,1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) FROM projects p CROSS JOIN json_each('[{"id":"new","name":"New"},{"id":"open","name":"Open"},{"id":"pending","name":"Pending"},{"id":"on_hold","name":"On-hold"},{"id":"solved","name":"Solved"},{"id":"closed","name":"Closed"}]') s;
UPDATE conversations SET status_id= CASE WHEN resolved_at IS NOT NULL THEN 'solved' WHEN revision>0 THEN 'open' ELSE 'new' END ,status_category= CASE WHEN resolved_at IS NOT NULL THEN 'solved' WHEN revision>0 THEN 'open' ELSE 'new' END ,brand_id=project_id,requester_id=contact_id,submitter_id=contact_id,channel= CASE WHEN EXISTS(SELECT 1 FROM inbound_emails e WHERE e.conversation_id=conversations.id) THEN 'email' ELSE 'widget' END;
CREATE TRIGGER ticket_project_defaults AFTER INSERT ON projects BEGIN
 INSERT INTO ticket_statuses SELECT NEW.id,json_extract(s.value,'$.id'),json_extract(s.value,'$.name'),json_extract(s.value,'$.id'),1,1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) FROM json_each('[{"id":"new","name":"New"},{"id":"open","name":"Open"},{"id":"pending","name":"Pending"},{"id":"on_hold","name":"On-hold"},{"id":"solved","name":"Solved"},{"id":"closed","name":"Closed"}]') s;
END;
CREATE TRIGGER ticket_conversation_defaults AFTER INSERT ON conversations BEGIN
 UPDATE conversations SET brand_id=NEW.project_id,requester_id=NEW.contact_id,submitter_id=COALESCE(NEW.submitter_id,NEW.contact_id),status_id= CASE WHEN NEW.resolved_at IS NOT NULL THEN 'solved' ELSE NEW.status_id END ,status_category= CASE WHEN NEW.resolved_at IS NOT NULL THEN 'solved' ELSE NEW.status_category END WHERE id=NEW.id;
END;
-- Compatibility for older writers: resolution remains the reporting/rating boundary.
CREATE TRIGGER ticket_legacy_resolution AFTER UPDATE OF resolved_at ON conversations WHEN NEW.status_id=OLD.status_id AND NEW.status_category=OLD.status_category AND ((NEW.resolved_at IS NULL AND OLD.resolved_at IS NOT NULL) OR (NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL)) BEGIN
 UPDATE conversations SET status_id= CASE WHEN NEW.resolved_at IS NULL THEN 'open' ELSE 'solved' END ,status_category= CASE WHEN NEW.resolved_at IS NULL THEN 'open' ELSE 'solved' END WHERE id=NEW.id;
END;
CREATE TRIGGER ticket_closed_terminal BEFORE UPDATE OF status_id,status_category,resolved_at ON conversations WHEN OLD.status_category='closed' AND (NEW.status_id<>OLD.status_id OR NEW.status_category<>OLD.status_category OR NEW.resolved_at IS NOT OLD.resolved_at) BEGIN SELECT RAISE(ABORT,'Closed tickets are final'); END;
CREATE TRIGGER ticket_version_update AFTER UPDATE OF updated_at,revision ON conversations BEGIN UPDATE conversations SET ticket_version=OLD.ticket_version+1 WHERE id=NEW.id; END;
CREATE TRIGGER ticket_history_update AFTER UPDATE OF status_id,subject,priority,channel,brand_id,group_id,requester_id,submitter_id,submitter_type ON conversations WHEN NOT EXISTS(SELECT 1 FROM ticket_history WHERE conversation_id=NEW.id AND at=NEW.updated_at AND actor_id IS NEW.ticket_actor_id AND source=NEW.ticket_source) AND (NEW.status_id<>OLD.status_id OR NEW.subject<>OLD.subject OR NEW.priority<>OLD.priority OR NEW.channel<>OLD.channel OR NEW.brand_id IS NOT OLD.brand_id OR NEW.group_id IS NOT OLD.group_id OR NEW.requester_id IS NOT OLD.requester_id OR NEW.submitter_id IS NOT OLD.submitter_id OR NEW.submitter_type<>OLD.submitter_type) BEGIN
 INSERT INTO ticket_history VALUES(lower(hex(randomblob(16))),NEW.project_id,NEW.id,NEW.ticket_actor_id,NEW.ticket_actor_type,NEW.ticket_source,NEW.updated_at,json_object('status_id',json_object('from',OLD.status_id,'to',NEW.status_id),'status_category',json_object('from',OLD.status_category,'to',NEW.status_category),'subject',json_object('from',OLD.subject,'to',NEW.subject),'priority',json_object('from',OLD.priority,'to',NEW.priority),'channel',json_object('from',OLD.channel,'to',NEW.channel),'brand_id',json_object('from',OLD.brand_id,'to',NEW.brand_id),'group_id',json_object('from',OLD.group_id,'to',NEW.group_id),'requester_id',json_object('from',OLD.requester_id,'to',NEW.requester_id),'submitter_id',json_object('from',OLD.submitter_id,'to',NEW.submitter_id),'submitter_type',json_object('from',OLD.submitter_type,'to',NEW.submitter_type)));
END;
CREATE TRIGGER ticket_history_audit AFTER INSERT ON ticket_history BEGIN
 INSERT INTO audit_events(id,project_id,at,category,action,outcome,actor_type,actor_id,source,target_type,target_id,detail_json) VALUES('ticket:'||NEW.id,NEW.project_id,NEW.at,'data','ticket.updated','succeeded', CASE WHEN NEW.actor_type IN ('user','system','installation','api') THEN NEW.actor_type ELSE 'system' END ,NEW.actor_id, CASE WHEN NEW.source IN ('dashboard','api','rer','email','system') THEN NEW.source ELSE 'system' END ,'conversation',NEW.conversation_id,json_object('history_id',NEW.id));
END;
