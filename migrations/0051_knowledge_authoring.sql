ALTER TABLE knowledge_datasets ADD COLUMN url TEXT;
ALTER TABLE knowledge_datasets ADD COLUMN excluded_urls TEXT NOT NULL DEFAULT '[]';
ALTER TABLE knowledge_datasets ADD COLUMN max_crawl_depth INTEGER NOT NULL DEFAULT 3;
ALTER TABLE knowledge_datasets ADD COLUMN max_crawl_pages INTEGER NOT NULL DEFAULT 100;
ALTER TABLE knowledge_categories ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE knowledge_categories ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;
ALTER TABLE knowledge_categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_articles ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
CREATE TABLE knowledge_article_categories(article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,category_id TEXT NOT NULL REFERENCES knowledge_categories(id) ON DELETE CASCADE,PRIMARY KEY(article_id,category_id));
