/* Publication identities survive timestamp collisions, unpublish/republish and ID reuse. */
/* Reuse the existing incarnation/revision fence without a second mutation trigger. */
ALTER TABLE knowledge_articles ADD COLUMN publication_version TEXT GENERATED ALWAYS AS (source_incarnation || ':' || source_revision) VIRTUAL;
ALTER TABLE messages ADD COLUMN citations_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE ai_generation_sources(
 generation_id TEXT NOT NULL REFERENCES ai_generations(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL,
 source_id TEXT NOT NULL,
 source_version TEXT NOT NULL,
 PRIMARY KEY(generation_id,source_id,source_version)
);
/* Existing subjects also need a one-time fence for mutations made before they existed. */
INSERT OR IGNORE INTO context_subjects(project_id,subject_id) SELECT project_id,id FROM contacts;
UPDATE context_subjects SET revision=revision+1;
CREATE TRIGGER context_customer_created AFTER INSERT ON contacts BEGIN
 INSERT OR IGNORE INTO context_subjects(project_id,subject_id) VALUES(NEW.project_id,NEW.id);
END;
CREATE TRIGGER context_conversation_created AFTER INSERT ON conversations BEGIN
 INSERT OR IGNORE INTO context_subjects(project_id,subject_id) VALUES(NEW.project_id,NEW.contact_id);
END;
