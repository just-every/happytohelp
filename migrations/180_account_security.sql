-- Account security, audit and data custody (round R8). Only new tables, so an
-- archive made before this migration still restores (rer's additive bridge).
-- Second factors: a TOTP authenticator (secret encrypted under the installation
-- key) or a WebAuthn credential (public key only). last_step refuses a replayed TOTP code.
CREATE TABLE user_factors(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('totp','webauthn')),label TEXT NOT NULL,secret_ciphertext TEXT,credential_id TEXT,public_key TEXT,algorithm INTEGER,sign_count INTEGER NOT NULL DEFAULT 0,last_step INTEGER,created_at INTEGER NOT NULL,confirmed_at INTEGER,last_used_at INTEGER,UNIQUE(credential_id));
CREATE INDEX user_factors_user ON user_factors(user_id,confirmed_at);
-- Ten single-use recovery codes per account, stored only as SHA-256 hashes.
CREATE TABLE recovery_codes(user_id TEXT NOT NULL REFERENCES users(id),code_hash TEXT NOT NULL,created_at INTEGER NOT NULL,used_at INTEGER,PRIMARY KEY(user_id,code_hash));
-- When a session last proved its holder's second factor (or password, for an
-- account without one). Excluded from archives with the sessions it describes.
CREATE TABLE session_factors(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,method TEXT NOT NULL CHECK(method IN ('password','totp','webauthn','recovery','installation')),verified_at INTEGER NOT NULL);
-- Outstanding WebAuthn challenges (registration and assertion), single use.
CREATE TABLE webauthn_challenges(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN ('register','assert')),challenge TEXT NOT NULL,expires_at INTEGER NOT NULL);
-- Installation recovery keys already spent: a key set through rer works once.
CREATE TABLE owner_recoveries(key_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,used_at INTEGER NOT NULL);

-- Roles beyond the membership's base role. A custom role narrows its base role's
-- permissions. 'collaborator' is the built-in notes-and-follow role on an operator membership.
CREATE TABLE project_roles(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,base TEXT NOT NULL CHECK(base IN ('admin','operator','collaborator')),permissions_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(project_id,name));
CREATE TABLE member_roles(project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),role_key TEXT NOT NULL,assigned_at INTEGER NOT NULL,PRIMARY KEY(project_id,user_id));
CREATE TABLE conversation_followers(conversation_id TEXT NOT NULL REFERENCES conversations(id),user_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,PRIMARY KEY(conversation_id,user_id));

-- The workspace security log. Rows are never edited. They leave only through a
-- retention purge that the application opens for one workspace and one cutoff,
-- and never while a legal hold covers them.
CREATE TABLE audit_events(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,at INTEGER NOT NULL,category TEXT NOT NULL,action TEXT NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','refused','failed')),actor_type TEXT NOT NULL CHECK(actor_type IN ('user','system','installation','api')),actor_id TEXT,source TEXT NOT NULL,target_type TEXT,target_id TEXT,purpose TEXT,detail_json TEXT NOT NULL DEFAULT '{}');
CREATE INDEX audit_events_project ON audit_events(project_id,at);
CREATE TABLE audit_holds(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,reason TEXT NOT NULL,starts_at INTEGER NOT NULL,ends_at INTEGER,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,released_by TEXT,released_at INTEGER);
CREATE TABLE audit_purges(project_id TEXT PRIMARY KEY,before_at INTEGER NOT NULL);
CREATE TRIGGER audit_events_append_only BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_append_only'); END;
CREATE TRIGGER audit_events_retained BEFORE DELETE ON audit_events WHEN NOT EXISTS(SELECT 1 FROM audit_purges p WHERE p.project_id=OLD.project_id AND OLD.at<p.before_at) OR EXISTS(SELECT 1 FROM audit_holds h WHERE h.project_id=OLD.project_id AND h.released_at IS NULL AND OLD.at>=h.starts_at AND (h.ends_at IS NULL OR OLD.at<=h.ends_at)) BEGIN SELECT RAISE(ABORT,'audit_retained'); END;

-- Erasure's requests to connected providers, one row per store or destination.
-- Holds the contact's opaque id only. The outcome is what the provider answered.
CREATE TABLE erasure_requests(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,contact_id TEXT NOT NULL,store TEXT NOT NULL,destination_id TEXT,state TEXT NOT NULL CHECK(state IN ('pending','completed','failed','unsupported')),detail TEXT NOT NULL,requested_at INTEGER NOT NULL,settled_at INTEGER,UNIQUE(project_id,contact_id,store,destination_id));

-- Durable Object storage captured by rer export, so the archive carries it with
-- its schema and digest. Written only by the local export and import commands.
CREATE TABLE durable_object_snapshots(namespace TEXT PRIMARY KEY,class_name TEXT NOT NULL,schema TEXT NOT NULL,instances INTEGER NOT NULL,records INTEGER NOT NULL,records_json TEXT NOT NULL,digest TEXT NOT NULL,captured_at INTEGER NOT NULL);
