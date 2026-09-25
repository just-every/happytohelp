-- Retained independently of users so deletion cannot reopen first-owner setup.
CREATE TABLE owner_setup (singleton INTEGER PRIMARY KEY CHECK(singleton=1), claim_id TEXT NOT NULL);
INSERT INTO owner_setup SELECT 1,'existing-installation' WHERE EXISTS(SELECT 1 FROM users) OR EXISTS(SELECT 1 FROM projects);
-- Imports and registration also close first-owner setup permanently.
CREATE TRIGGER owner_setup_on_user AFTER INSERT ON users BEGIN
 INSERT INTO owner_setup(singleton,claim_id) VALUES(1,'existing-installation') ON CONFLICT(singleton) DO NOTHING;
END;
CREATE TRIGGER owner_setup_on_project AFTER INSERT ON projects BEGIN
 INSERT INTO owner_setup(singleton,claim_id) VALUES(1,'existing-installation') ON CONFLICT(singleton) DO NOTHING;
END;
