CREATE TABLE attachment_chunks (
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  PRIMARY KEY (attachment_id, ordinal)
);
