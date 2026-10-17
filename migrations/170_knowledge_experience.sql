-- Existing centers remain public, at their existing URLs and in their original locale.
ALTER TABLE knowledge_categories ADD COLUMN audience TEXT NOT NULL DEFAULT 'public' CHECK(audience IN ('public','signed-in','domains'));
ALTER TABLE knowledge_categories ADD COLUMN allowed_domains TEXT NOT NULL DEFAULT '[]';
ALTER TABLE knowledge_articles ADD COLUMN editor_id TEXT;
CREATE TABLE knowledge_experience(project_id TEXT PRIMARY KEY REFERENCES projects(id),default_locale TEXT NOT NULL DEFAULT 'en',locales_json TEXT NOT NULL DEFAULT '["en"]',templates_json TEXT NOT NULL DEFAULT '{}',updated_by TEXT,updated_at INTEGER NOT NULL);
CREATE TABLE knowledge_translations(article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,locale TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,summary TEXT NOT NULL DEFAULT '',review_status TEXT NOT NULL CHECK(review_status IN ('draft','reviewed')),reviewed_by TEXT,reviewed_at INTEGER,source_version TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(article_id,locale));
CREATE TABLE knowledge_article_history(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,snapshot_json TEXT NOT NULL,editor_id TEXT,created_at INTEGER NOT NULL);
CREATE INDEX knowledge_history_article ON knowledge_article_history(project_id,article_id,created_at);
CREATE TABLE knowledge_slug_redirects(project_id TEXT NOT NULL,slug TEXT NOT NULL,article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,slug));
CREATE TRIGGER knowledge_article_snapshot_insert AFTER INSERT ON knowledge_articles BEGIN
 INSERT INTO knowledge_article_history VALUES(lower(hex(randomblob(16))),NEW.project_id,NEW.id,json_object('slug',NEW.slug,'title',NEW.title,'content',NEW.content,'summary',NEW.summary,'status',NEW.status),NEW.editor_id,NEW.updated_at);
END;
CREATE TRIGGER knowledge_article_snapshot_update AFTER UPDATE OF slug,title,content,summary,status ON knowledge_articles WHEN OLD.slug<>NEW.slug OR OLD.title<>NEW.title OR OLD.content<>NEW.content OR OLD.summary<>NEW.summary OR OLD.status<>NEW.status BEGIN
 INSERT INTO knowledge_article_history VALUES(lower(hex(randomblob(16))),NEW.project_id,NEW.id,json_object('slug',NEW.slug,'title',NEW.title,'content',NEW.content,'summary',NEW.summary,'status',NEW.status),NEW.editor_id,NEW.updated_at);
END;
INSERT INTO knowledge_article_history SELECT lower(hex(randomblob(16))),project_id,id,json_object('slug',slug,'title',title,'content',content,'summary',summary,'status',status),editor_id,updated_at FROM knowledge_articles;
CREATE TRIGGER knowledge_article_slug_redirect AFTER UPDATE OF slug ON knowledge_articles WHEN OLD.slug<>NEW.slug BEGIN
 INSERT INTO knowledge_slug_redirects VALUES(NEW.project_id,OLD.slug,NEW.id,NEW.updated_at) ON CONFLICT(project_id,slug) DO UPDATE SET article_id=excluded.article_id,created_at=excluded.created_at;
 DELETE FROM knowledge_slug_redirects WHERE project_id=NEW.project_id AND slug=NEW.slug AND article_id=NEW.id;
END;
CREATE TRIGGER knowledge_category_audience_revision AFTER UPDATE OF audience,allowed_domains ON knowledge_categories BEGIN
 UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id=NEW.project_id;
END;
CREATE TABLE knowledge_help_links(token_hash TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),email TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE knowledge_help_sessions(token_hash TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),contact_id TEXT REFERENCES contacts(id),email TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE knowledge_feedback(project_id TEXT NOT NULL,article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,locale TEXT NOT NULL,brand TEXT NOT NULL DEFAULT '',visitor_hash TEXT NOT NULL,contact_id TEXT REFERENCES contacts(id),helpful INTEGER NOT NULL CHECK(helpful IN (0,1)),comment TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,article_id,locale,visitor_hash));
CREATE TABLE knowledge_events(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,article_id TEXT REFERENCES knowledge_articles(id) ON DELETE CASCADE,locale TEXT NOT NULL,brand TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL CHECK(kind IN ('view','search','click','ticket')),query TEXT NOT NULL DEFAULT '',result_count INTEGER,visitor_hash TEXT NOT NULL,contact_id TEXT REFERENCES contacts(id),created_at INTEGER NOT NULL);
CREATE INDEX knowledge_events_project ON knowledge_events(project_id,locale,created_at);
ALTER TABLE knowledge_translations ADD COLUMN published_json TEXT;
ALTER TABLE knowledge_translations ADD COLUMN published_source_version TEXT;
CREATE TABLE knowledge_translation_history(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,locale TEXT NOT NULL,snapshot_json TEXT NOT NULL,editor_id TEXT NOT NULL,created_at INTEGER NOT NULL);
