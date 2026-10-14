-- Adding a new category cannot change a pre-existing article's FK-linked ancestry.
-- Deleting a category invalidates only articles whose ancestry actually changes.
DROP TRIGGER edition_category_insert;
DROP TRIGGER edition_category_delete;
CREATE TRIGGER edition_category_delete BEFORE DELETE ON knowledge_categories BEGIN
 UPDATE knowledge_articles SET source_revision=source_revision+1
 WHERE project_id=OLD.project_id AND (
  category_id IN (WITH RECURSIVE descendants(id) AS (SELECT OLD.id UNION SELECT c.id FROM knowledge_categories c JOIN descendants d ON c.parent_id=d.id WHERE c.project_id=OLD.project_id) SELECT id FROM descendants)
  OR id IN (SELECT article_id FROM knowledge_article_categories WHERE category_id IN (WITH RECURSIVE descendants(id) AS (SELECT OLD.id UNION SELECT c.id FROM knowledge_categories c JOIN descendants d ON c.parent_id=d.id WHERE c.project_id=OLD.project_id) SELECT id FROM descendants))
 );
END;
