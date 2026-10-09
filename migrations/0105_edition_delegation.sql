-- Dedicated edition credentials never enter sessions. Receipts retain hashes, not content.
CREATE TABLE edition_clients(id TEXT NOT NULL,project_id TEXT NOT NULL,origin TEXT NOT NULL,redirect_uri TEXT NOT NULL,allow_loopback INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(project_id,id));
CREATE TABLE edition_grants(id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,client_id TEXT NOT NULL,project_id TEXT NOT NULL,principal_id TEXT NOT NULL,scopes TEXT NOT NULL,targets TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,token_hash TEXT UNIQUE,created_at INTEGER NOT NULL);
CREATE TABLE edition_codes(code_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES edition_grants(id),challenge TEXT NOT NULL,redirect_uri TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE edition_consents(id TEXT PRIMARY KEY,session_hash TEXT NOT NULL,request_json TEXT NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);
CREATE TABLE edition_audiences(project_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 1);
INSERT INTO edition_audiences(project_id) SELECT id FROM projects;
CREATE TRIGGER edition_new_project AFTER INSERT ON projects BEGIN INSERT INTO edition_audiences(project_id) VALUES(NEW.id); END;
CREATE TRIGGER edition_member_insert AFTER INSERT ON memberships BEGIN UPDATE edition_audiences SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER edition_member_update AFTER UPDATE ON memberships BEGIN UPDATE edition_audiences SET revision=revision+1 WHERE project_id IN (OLD.project_id,NEW.project_id); END;
CREATE TRIGGER edition_member_delete AFTER DELETE ON memberships BEGIN UPDATE edition_audiences SET revision=revision+1 WHERE project_id=OLD.project_id; END;
ALTER TABLE knowledge_articles ADD COLUMN source_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE knowledge_articles ADD COLUMN source_incarnation TEXT NOT NULL DEFAULT '';
UPDATE knowledge_articles SET source_incarnation=lower(hex(randomblob(16)));
CREATE TRIGGER edition_article_incarnation AFTER INSERT ON knowledge_articles BEGIN UPDATE knowledge_articles SET source_incarnation=lower(hex(randomblob(16))) WHERE id=NEW.id; END;
CREATE TRIGGER edition_article_revision AFTER UPDATE ON knowledge_articles WHEN NEW.source_revision=OLD.source_revision BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id=NEW.id; END;
CREATE TRIGGER edition_category_update AFTER UPDATE ON knowledge_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id IN (OLD.project_id,NEW.project_id); END;
CREATE TRIGGER edition_category_delete BEFORE DELETE ON knowledge_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER edition_category_insert AFTER INSERT ON knowledge_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER edition_article_category_insert AFTER INSERT ON knowledge_article_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id=NEW.article_id; END;
CREATE TRIGGER edition_article_category_delete AFTER DELETE ON knowledge_article_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id=OLD.article_id; END;
CREATE TRIGGER edition_article_category_update AFTER UPDATE ON knowledge_article_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id IN (OLD.article_id,NEW.article_id); END;
CREATE TABLE edition_receipts(id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,project_id TEXT NOT NULL,client_id TEXT NOT NULL,principal_id TEXT NOT NULL,operation_key TEXT NOT NULL,request_hash TEXT NOT NULL,target TEXT NOT NULL,operation TEXT NOT NULL,before_revision TEXT NOT NULL,after_revision TEXT NOT NULL,committed_at INTEGER NOT NULL,UNIQUE(installation_id,project_id,client_id,principal_id,operation_key));
-- Inserting a guard and deleting it in the same batch makes failure abort the whole mutation.
CREATE TABLE edition_effect_guards(id TEXT PRIMARY KEY,valid INTEGER NOT NULL CHECK(valid=1));
