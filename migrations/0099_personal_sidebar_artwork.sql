ALTER TABLE user_settings ADD COLUMN sidebar_artwork_id TEXT;
ALTER TABLE user_settings ADD COLUMN sidebar_artwork_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sidebar_artwork_enabled IN (0,1));
