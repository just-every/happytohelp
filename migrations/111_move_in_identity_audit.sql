-- Earlier completeness claims did not audit every nested source field.
-- Preserve all content and native rows; treat that private custody conservatively
-- when a workspace contact is erased. New uploads use the current shape audit.
UPDATE move_in_runs SET identity_complete=0 WHERE identity_complete<>0;

-- Zero means original custody predates the bounded admission audit. Erasure
-- reindexes its real bytes before deleting them; -1 denotes unprocessable old
-- custody and 1 denotes a completed structural identity extraction.
ALTER TABLE move_in_runs ADD COLUMN identity_audited INTEGER NOT NULL DEFAULT 0;
