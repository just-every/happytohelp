-- Distinguish mailbox proof from a re-entered password. Existing proofs retain
-- their exact account, method and timestamp; email is never a second factor.
CREATE TABLE session_factors_email(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,method TEXT NOT NULL CHECK(method IN ('password','email_link','totp','webauthn','recovery','installation')),verified_at INTEGER NOT NULL);
INSERT INTO session_factors_email(token_hash,user_id,method,verified_at) SELECT token_hash,user_id,method,verified_at FROM session_factors;
DROP TABLE session_factors;
ALTER TABLE session_factors_email RENAME TO session_factors;
