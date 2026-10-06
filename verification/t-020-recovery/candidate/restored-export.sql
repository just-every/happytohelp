PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_identity.sql','2026-10-06 04:13:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_conversations.sql','2026-10-06 04:13:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_identity_credentials.sql','2026-10-06 04:13:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_message_intent.sql','2026-10-06 04:13:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_widget_identity.sql','2026-10-06 04:13:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_registration.sql','2026-10-06 04:13:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'0007_conversation_history.sql','2026-10-06 04:13:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'0008_account_sessions.sql','2026-10-06 04:13:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'020_ai_support.sql','2026-10-06 04:13:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(10,'030_local_computer.sql','2026-10-06 04:13:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(11,'040_training_runs.sql','2026-10-06 04:13:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(12,'041_training_model_usage.sql','2026-10-06 04:13:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(13,'0050_knowledge.sql','2026-10-06 04:13:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(14,'0051_knowledge_authoring.sql','2026-10-06 04:13:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(15,'0052_knowledge_imports.sql','2026-10-06 04:13:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(16,'0053_knowledge_recovery.sql','2026-10-06 04:13:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(17,'0060_customer_context.sql','2026-10-06 04:13:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(18,'0060_customer_context_engine.sql','2026-10-06 04:13:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(19,'0070_management.sql','2026-10-06 04:13:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(20,'0071_management_preferences.sql','2026-10-06 04:13:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(21,'0080_integrations.sql','2026-10-06 04:13:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(22,'0081_billing_receipts.sql','2026-10-06 04:13:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(23,'0082_github_oauth.sql','2026-10-06 04:13:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(24,'0083_lead_operations.sql','2026-10-06 04:13:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(25,'0084_billing_project_usage.sql','2026-10-06 04:13:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(26,'0085_ai_context_guards.sql','2026-10-06 04:13:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(27,'090_legacy_import.sql','2026-10-06 04:13:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(28,'0095_public_site.sql','2026-10-06 04:13:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(29,'0096_site_preview.sql','2026-10-06 04:13:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(30,'0097_owner_setup.sql','2026-10-06 04:13:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(31,'0098_personal_visual_inspiration.sql','2026-10-06 04:13:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(32,'0099_personal_sidebar_artwork.sql','2026-10-06 04:13:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(33,'0100_inbound_email_claims.sql','2026-10-06 04:13:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(34,'0101_email_mailbox_lifecycle.sql','2026-10-06 04:13:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(35,'0102_public_abuse_limits.sql','2026-10-06 04:13:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(36,'0103_contact_erasure.sql','2026-10-06 04:13:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(37,'0104_inbound_email_classification.sql','2026-10-06 04:13:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(38,'0105_edition_delegation.sql','2026-10-06 04:13:14');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(39,'0106_project_verification_secret.sql','2026-10-06 04:13:14');
CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,widget_key TEXT UNIQUE NOT NULL,allowed_origin TEXT NOT NULL,created_at INTEGER NOT NULL, verification_secret TEXT);
INSERT INTO "projects" ("id","name","widget_key","allowed_origin","created_at","verification_secret") VALUES('aaf368da-0950-4ce4-aeed-331da0af5a37','Recovery comparison fixture','c80aa155-4dff-4179-b7da-84ece27b1b65','https://recovery.example.test',1791259995494,'2bdf1ee06c1ca50b512c97eeaba2b14d09e6da80c5efc17549f23cfdc9aece14');
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,created_at INTEGER NOT NULL);
INSERT INTO "users" ("id","email","name","created_at") VALUES('cb920b81-1605-47f3-a914-01a083781cbf','recovery@example.test','Recovery comparison fixture',1791259995494);
CREATE TABLE memberships(project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','operator')),PRIMARY KEY(project_id,user_id));
INSERT INTO "memberships" ("project_id","user_id","role") VALUES('aaf368da-0950-4ce4-aeed-331da0af5a37','cb920b81-1605-47f3-a914-01a083781cbf','owner');
CREATE TABLE contacts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT,email TEXT,external_id TEXT,created_at INTEGER NOT NULL, is_verified INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}',UNIQUE(project_id,external_id));
INSERT INTO "contacts" ("id","project_id","name","email","external_id","created_at","is_verified","metadata_json") VALUES('bebb7682-e372-415a-af97-a62c17bb5e24','aaf368da-0950-4ce4-aeed-331da0af5a37',NULL,NULL,NULL,1791259995520,0,'{}');
CREATE TABLE conversations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),contact_id TEXT NOT NULL REFERENCES contacts(id),revision INTEGER NOT NULL DEFAULT 0,last_message_id TEXT,assigned_to TEXT,resolved_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
INSERT INTO "conversations" ("id","project_id","contact_id","revision","last_message_id","assigned_to","resolved_at","created_at","updated_at") VALUES('965f1a80-2dee-42fa-8388-be510469b205','aaf368da-0950-4ce4-aeed-331da0af5a37','bebb7682-e372-415a-af97-a62c17bb5e24',1,'3da8d899-3a39-485a-a5c9-f349bc78de3a',NULL,NULL,1791259995534,1791259995549);
CREATE TABLE messages(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),conversation_id TEXT NOT NULL REFERENCES conversations(id),local_id TEXT NOT NULL,actor_id TEXT NOT NULL,actor_role TEXT NOT NULL,content TEXT NOT NULL,revision INTEGER NOT NULL,created_at INTEGER NOT NULL, intent_hash TEXT, bucket_id TEXT, erased_at INTEGER,UNIQUE(conversation_id,local_id),UNIQUE(conversation_id,revision));
INSERT INTO "messages" ("id","project_id","conversation_id","local_id","actor_id","actor_role","content","revision","created_at","intent_hash","bucket_id","erased_at") VALUES('3da8d899-3a39-485a-a5c9-f349bc78de3a','aaf368da-0950-4ce4-aeed-331da0af5a37','965f1a80-2dee-42fa-8388-be510469b205','recovery-comparison-message','bebb7682-e372-415a-af97-a62c17bb5e24','contact','Native recovery must preserve this transcript exactly: café 日本語.',1,1791259995549,'d8a4cbc9834296765db16061abd7378b198f717cdb801d3ca6f44be531d120db',NULL,NULL);
CREATE TABLE media(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT NOT NULL REFERENCES conversations(id),uploaded_by TEXT NOT NULL,object_key TEXT UNIQUE NOT NULL,filename TEXT NOT NULL,content_type TEXT NOT NULL,size INTEGER NOT NULL,message_id TEXT REFERENCES messages(id),created_at INTEGER NOT NULL);
INSERT INTO "media" ("id","project_id","conversation_id","uploaded_by","object_key","filename","content_type","size","message_id","created_at") VALUES('6961cfd4-3aad-4389-8da4-ed26135b2fce','aaf368da-0950-4ce4-aeed-331da0af5a37','965f1a80-2dee-42fa-8388-be510469b205','cb920b81-1605-47f3-a914-01a083781cbf','aaf368da-0950-4ce4-aeed-331da0af5a37/965f1a80-2dee-42fa-8388-be510469b205/6961cfd4-3aad-4389-8da4-ed26135b2fce','recovery.bin','application/octet-stream',8,NULL,1791259995589);
CREATE TABLE conversation_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,conversation_id TEXT NOT NULL,message_id TEXT UNIQUE NOT NULL REFERENCES messages(id),created_at INTEGER NOT NULL,delivered_at INTEGER);
INSERT INTO "conversation_outbox" ("id","project_id","conversation_id","message_id","created_at","delivered_at") VALUES(1,'aaf368da-0950-4ce4-aeed-331da0af5a37','965f1a80-2dee-42fa-8388-be510469b205','3da8d899-3a39-485a-a5c9-f349bc78de3a',1791259995549,NULL);
CREATE TABLE credentials(user_id TEXT PRIMARY KEY REFERENCES users(id),password_hash TEXT NOT NULL,updated_at INTEGER NOT NULL);
INSERT INTO "credentials" ("user_id","password_hash","updated_at") VALUES('cb920b81-1605-47f3-a914-01a083781cbf','11d03c5b-4efa-4661-912d-44c03ff0e04b:fcca28583e9768445f5ddab130c93d4abf04682594a2905aa465121810b30f08',1791259995494);
CREATE TABLE login_attempts(key TEXT PRIMARY KEY,failures INTEGER NOT NULL,window_start INTEGER NOT NULL);
CREATE TABLE registrations(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,project_name TEXT NOT NULL,allowed_origin TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE conversation_buckets(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),created_at INTEGER NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS "sessions"(token_hash TEXT PRIMARY KEY,actor_id TEXT NOT NULL,project_id TEXT REFERENCES projects(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','operator','contact')),contact_id TEXT REFERENCES contacts(id),expires_at INTEGER NOT NULL,revoked_at INTEGER,CHECK(project_id IS NOT NULL OR (role='operator' AND contact_id IS NULL)));
INSERT INTO "sessions" ("token_hash","actor_id","project_id","role","contact_id","expires_at","revoked_at") VALUES('1e13412ec44216bdd6820d59d17afcb7589af67533d81798ef24c96a8b2023ad','cb920b81-1605-47f3-a914-01a083781cbf','aaf368da-0950-4ce4-aeed-331da0af5a37','owner',NULL,1791346395494,NULL);
INSERT INTO "sessions" ("token_hash","actor_id","project_id","role","contact_id","expires_at","revoked_at") VALUES('86b26781067313907e846a3e6453d9a0ff3a86ac5400af37c9e338e02a1b5e33','bebb7682-e372-415a-af97-a62c17bb5e24','aaf368da-0950-4ce4-aeed-331da0af5a37','contact','bebb7682-e372-415a-af97-a62c17bb5e24',1793851995520,NULL);
CREATE TABLE IF NOT EXISTS "identity_tokens"(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),project_id TEXT REFERENCES projects(id),email TEXT NOT NULL,role TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('invite','reset')),expires_at INTEGER NOT NULL,consumed_at INTEGER,CHECK(kind='reset' OR project_id IS NOT NULL));
CREATE TABLE ai_generations (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('queued','running','completed','uncertain','cancelled','superseded','failed')),
 source_revision INTEGER NOT NULL, source_context_revision INTEGER NOT NULL DEFAULT 0, source_last_message_id TEXT, actor_json TEXT NOT NULL,
 model TEXT NOT NULL, ai_id TEXT NOT NULL, ai_profile_json TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'reply', instruction TEXT NOT NULL DEFAULT '', options_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT, output_json TEXT
);
CREATE TABLE ai_attempts (
 id TEXT PRIMARY KEY, generation_id TEXT NOT NULL REFERENCES ai_generations(id),
 state TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, error TEXT,
 UNIQUE(generation_id)
);
CREATE TABLE ai_round_usage (
 attempt_id TEXT NOT NULL REFERENCES ai_attempts(id), request_id TEXT NOT NULL,
 model TEXT, usage_json TEXT, observed INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(attempt_id,request_id)
);
CREATE TABLE ai_attempt_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL REFERENCES ai_attempts(id),
 type TEXT NOT NULL, event_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE local_pairings (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, redeemed_at TEXT);
CREATE TABLE local_grants (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT, token_hash TEXT UNIQUE, revoked_at TEXT);
CREATE TABLE local_authorizations (id TEXT PRIMARY KEY, device_hash TEXT NOT NULL UNIQUE, user_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, client_session_id TEXT NOT NULL, capabilities TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', user_id TEXT, expires_at TEXT NOT NULL);
CREATE TABLE local_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT, grant_id TEXT REFERENCES local_grants(id), pairing_id TEXT, client_session_id TEXT, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, provider TEXT NOT NULL, capabilities TEXT NOT NULL, max_concurrent_tasks INTEGER NOT NULL DEFAULT 3 CHECK(max_concurrent_tasks BETWEEN 1 AND 8), last_seen_at TEXT, worker_ready_at TEXT, worker_mode TEXT, revoked_at TEXT, UNIQUE(grant_id,client_session_id));
CREATE TABLE local_device_settings (device_id TEXT NOT NULL REFERENCES local_devices(id), project_id TEXT NOT NULL, working_directories TEXT NOT NULL DEFAULT '[]', PRIMARY KEY(device_id,project_id));
CREATE TABLE local_jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, conversation_id TEXT NOT NULL, operator_id TEXT NOT NULL, device_id TEXT NOT NULL REFERENCES local_devices(id), request_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('investigate','resolve','resolve_reply')), instructions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', claim_id TEXT, run_id TEXT, context TEXT, expected_last_message_id TEXT, session_id TEXT, result TEXT, cancel_requested INTEGER NOT NULL DEFAULT 0, delivery_state TEXT, parent_delegation_id TEXT, source_proposal_id TEXT, created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT, UNIQUE(project_id,request_id), UNIQUE(device_id,claim_id));
CREATE TABLE local_events (job_id TEXT NOT NULL REFERENCES local_jobs(id), event_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(job_id,event_id));
CREATE TABLE local_attachments (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES local_jobs(id), device_id TEXT NOT NULL, storage_key TEXT NOT NULL, mime_type TEXT NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL);
CREATE TABLE local_receipts (job_id TEXT NOT NULL, proposal_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, message_id TEXT, child_delegation_id TEXT, review_message TEXT, expected_revision INTEGER, expected_last_message_id TEXT, PRIMARY KEY(job_id,proposal_id,kind));
CREATE TABLE local_attachment_grants (attachment_id TEXT NOT NULL REFERENCES local_attachments(id),job_id TEXT NOT NULL REFERENCES local_jobs(id),device_id TEXT NOT NULL,PRIMARY KEY(attachment_id,job_id));
CREATE TABLE local_result_effects(job_id TEXT PRIMARY KEY REFERENCES local_jobs(id),event_id TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE training_runs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,operator_id TEXT NOT NULL,request_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('evaluation','simulation')),status TEXT NOT NULL DEFAULT 'queued',config TEXT NOT NULL,case_count INTEGER NOT NULL,max_cost REAL NOT NULL CHECK(max_cost>=0),max_tokens INTEGER NOT NULL CHECK(max_tokens>0),spent_cost REAL NOT NULL DEFAULT 0,reserved_cost REAL NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,completed_at INTEGER,UNIQUE(project_id,request_id));
CREATE TABLE training_cases(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES training_runs(id),case_id TEXT NOT NULL,model TEXT NOT NULL,variant TEXT NOT NULL,definition TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',attempt_id TEXT,output_key TEXT,checks TEXT,usage TEXT,error TEXT,started_at INTEGER,completed_at INTEGER, lease_expires_at INTEGER,UNIQUE(run_id,case_id,model,variant));
CREATE TABLE training_workspaces(project_id TEXT PRIMARY KEY REFERENCES projects(id),namespace TEXT NOT NULL UNIQUE,fixture_digest TEXT NOT NULL,seeded_at INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'planning');
CREATE TABLE training_model_events(id INTEGER PRIMARY KEY AUTOINCREMENT,attempt_id TEXT NOT NULL,project_id TEXT NOT NULL,type TEXT NOT NULL,event_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE training_model_rounds(attempt_id TEXT NOT NULL,request_id TEXT NOT NULL,project_id TEXT NOT NULL,model TEXT,usage_json TEXT,observed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(attempt_id,request_id));
CREATE TABLE knowledge_datasets(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'empty',published_version TEXT,ingest_started_at INTEGER,ingest_cursor INTEGER NOT NULL DEFAULT -1,claim_token TEXT,source_input TEXT,error TEXT,refresh_mode TEXT NOT NULL DEFAULT 'manual',unchanged_count INTEGER NOT NULL DEFAULT 0,next_refresh_at INTEGER,last_refreshed_at INTEGER,created_at INTEGER NOT NULL, url TEXT, excluded_urls TEXT NOT NULL DEFAULT '[]', max_crawl_depth INTEGER NOT NULL DEFAULT 3, max_crawl_pages INTEGER NOT NULL DEFAULT 100);
CREATE TABLE knowledge_versions(id TEXT PRIMARY KEY,dataset_id TEXT NOT NULL REFERENCES knowledge_datasets(id) ON DELETE CASCADE, fingerprint TEXT NOT NULL,created_at INTEGER NOT NULL,semantic INTEGER NOT NULL DEFAULT 0,embedding_model TEXT);
CREATE TABLE knowledge_documents(id TEXT PRIMARY KEY,version_id TEXT NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,url TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL);
CREATE TABLE knowledge_categories(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,parent_id TEXT REFERENCES knowledge_categories(id),name TEXT NOT NULL,slug TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', is_published INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0,UNIQUE(project_id,slug));
CREATE TABLE knowledge_articles(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,category_id TEXT REFERENCES knowledge_categories(id),slug TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,summary TEXT NOT NULL DEFAULT '',status TEXT NOT NULL CHECK(status IN ('draft','published')),updated_at INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, source_revision INTEGER NOT NULL DEFAULT 1, source_incarnation TEXT NOT NULL DEFAULT '',UNIQUE(project_id,slug));
INSERT INTO "knowledge_articles" ("id","project_id","category_id","slug","title","content","summary","status","updated_at","position","source_revision","source_incarnation") VALUES('c9ba0a4a-5916-4c17-b822-97fac2073e3e','aaf368da-0950-4ce4-aeed-331da0af5a37',NULL,'recovery-fixture','Recovery fixture knowledge','Retain the published knowledge and its scope.','','published',1791259995567,0,2,'bc81ea3ed87048fb9a4e15ac55ec90ce');
CREATE TABLE knowledge_article_categories(article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,category_id TEXT NOT NULL REFERENCES knowledge_categories(id) ON DELETE CASCADE,PRIMARY KEY(article_id,category_id));
CREATE TABLE knowledge_imports(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,platform TEXT NOT NULL,status TEXT NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,categories INTEGER NOT NULL DEFAULT 0,articles INTEGER NOT NULL DEFAULT 0,error TEXT,created_at INTEGER NOT NULL, processing_started_at INTEGER);
CREATE TABLE context_subjects(project_id TEXT NOT NULL,subject_id TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, help_types TEXT NOT NULL DEFAULT '[]', bot_enabled INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(project_id,subject_id));
CREATE TABLE context_evidence(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,source TEXT NOT NULL,content TEXT NOT NULL,visibility TEXT NOT NULL,occurred_at INTEGER NOT NULL,UNIQUE(project_id,subject_id,id));
CREATE TABLE context_profiles(project_id TEXT NOT NULL,subject_id TEXT NOT NULL,type TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}',evidence_fingerprint TEXT,generated_count INTEGER NOT NULL DEFAULT 0,started_at INTEGER,PRIMARY KEY(project_id,subject_id,type));
CREATE TABLE context_insights(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,help_type TEXT NOT NULL,content TEXT NOT NULL,buttons TEXT NOT NULL,evidence_ids TEXT NOT NULL,created_at INTEGER NOT NULL,dismissed_at INTEGER);
CREATE TABLE context_collectors(project_id TEXT NOT NULL,subject_id TEXT NOT NULL,actions_count INTEGER NOT NULL DEFAULT 0,analysis_actions INTEGER NOT NULL DEFAULT 0,analysis_count INTEGER NOT NULL DEFAULT 0,analysis_since_insight INTEGER NOT NULL DEFAULT 0,job_id TEXT,last_run_at INTEGER,PRIMARY KEY(project_id,subject_id));
CREATE TABLE context_actions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,local_id TEXT NOT NULL,action TEXT NOT NULL,occurred_at INTEGER NOT NULL,UNIQUE(project_id,subject_id,local_id));
CREATE TABLE context_summaries(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,summary TEXT NOT NULL,evidence_ids TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE context_tracked_events(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,local_id TEXT NOT NULL,type TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(project_id,subject_id,local_id));
CREATE TABLE context_jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,subject_id TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('queued','running','completed','no_op','failed','uncertain','superseded')),source_revision INTEGER NOT NULL,packet_json TEXT NOT NULL,model TEXT NOT NULL,created_at INTEGER NOT NULL,started_at INTEGER,finished_at INTEGER,result_json TEXT,error TEXT,provider_started INTEGER NOT NULL DEFAULT 0);
CREATE TABLE context_job_events(id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL REFERENCES context_jobs(id),kind TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE context_write_guards(id TEXT PRIMARY KEY,result TEXT NOT NULL CHECK(result='ok'));
CREATE TABLE project_settings(project_id TEXT PRIMARY KEY REFERENCES projects(id), settings_json TEXT NOT NULL DEFAULT '{}',updated_at INTEGER NOT NULL);
CREATE TABLE ai_profiles(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,role TEXT NOT NULL,prompt TEXT NOT NULL,model TEXT NOT NULL,is_enabled INTEGER NOT NULL DEFAULT 1,is_animated INTEGER NOT NULL DEFAULT 0,avatar_url TEXT,created_at INTEGER NOT NULL);
CREATE TABLE macros(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),title TEXT NOT NULL,content TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE plugins(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,url TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,is_enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
CREATE TABLE conversation_reads(conversation_id TEXT NOT NULL REFERENCES conversations(id),user_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(conversation_id,user_id));
CREATE TABLE conversation_notes(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),user_id TEXT NOT NULL REFERENCES users(id),content TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE conversation_participants(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),contact_id TEXT NOT NULL REFERENCES contacts(id),created_at INTEGER NOT NULL,UNIQUE(conversation_id,contact_id));
CREATE TABLE conversation_ai(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id),ai_id TEXT REFERENCES ai_profiles(id));
CREATE TABLE management_audit(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,subject_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE user_settings(user_id TEXT PRIMARY KEY REFERENCES users(id),timezone TEXT NOT NULL DEFAULT 'UTC',avatar_url TEXT,is_notifiable_on_conversation_assignment INTEGER NOT NULL DEFAULT 1, visual_inspiration TEXT, sidebar_artwork_id TEXT, sidebar_artwork_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sidebar_artwork_enabled IN (0,1)));
CREATE TABLE platform_admins(user_id TEXT PRIMARY KEY REFERENCES users(id));
CREATE TABLE ai_defaults(id TEXT PRIMARY KEY,role TEXT NOT NULL,name TEXT NOT NULL,prompt TEXT NOT NULL,model TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,website TEXT,created_at INTEGER NOT NULL, source TEXT NOT NULL DEFAULT 'happytohelp', status TEXT NOT NULL DEFAULT 'new', subject TEXT, content TEXT, website_html TEXT, error TEXT, sent_at INTEGER);
CREATE TABLE user_project_preferences(project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),is_primary INTEGER NOT NULL DEFAULT 0,is_notified_on_unassigned_activity INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,user_id));
CREATE TABLE email_settings(project_id TEXT PRIMARY KEY REFERENCES projects(id),from_name TEXT NOT NULL,from_address TEXT NOT NULL,inbound_address TEXT UNIQUE,is_enabled INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
CREATE TABLE email_deliveries(id TEXT PRIMARY KEY,project_id TEXT,recipient TEXT NOT NULL,subject TEXT NOT NULL,intent_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('sending','sent','failed','uncertain')),provider_id TEXT,error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE inbound_emails(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,conversation_id TEXT,intent_hash TEXT NOT NULL,state TEXT NOT NULL,error TEXT,created_at INTEGER NOT NULL, claim_token TEXT, automatic INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0,1)), evidence_json TEXT, local_id TEXT, message_id TEXT);
CREATE TABLE billing_accounts(project_id TEXT PRIMARY KEY REFERENCES projects(id),stripe_customer_id TEXT UNIQUE,currency TEXT NOT NULL DEFAULT 'usd',auto_top_up INTEGER NOT NULL DEFAULT 0,top_up_minor INTEGER,threshold_minor INTEGER, default_payment_method TEXT, auto_state TEXT NOT NULL DEFAULT 'idle', usd_conversion_rate REAL);
CREATE TABLE billing_ledger(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL,amount_minor INTEGER NOT NULL,currency TEXT NOT NULL,provider_id TEXT UNIQUE,created_at INTEGER NOT NULL, amount_micros INTEGER, receipt_url TEXT, invoice_url TEXT, provider_charge_id TEXT);
CREATE TABLE billing_operations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,response_json TEXT,error TEXT,created_at INTEGER NOT NULL, intent_hash TEXT, request_json TEXT, provider_id TEXT);
CREATE TABLE github_settings(project_id TEXT PRIMARY KEY REFERENCES projects(id),repositories_json TEXT NOT NULL DEFAULT '[]',allow_agents INTEGER NOT NULL DEFAULT 1,allow_contacts INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
CREATE TABLE integration_events(id TEXT PRIMARY KEY,provider TEXT NOT NULL,event_type TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE billing_webhook_receipts(id TEXT PRIMARY KEY,event_type TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE billing_usage_receipts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),attempt_id TEXT NOT NULL,request_id TEXT NOT NULL,state TEXT NOT NULL,provider_cost_micros INTEGER,currency TEXT NOT NULL,conversion_rate REAL,amount_micros INTEGER,usage_json TEXT,created_at INTEGER NOT NULL,UNIQUE(attempt_id,request_id));
CREATE TABLE github_oauth_states(state_hash TEXT PRIMARY KEY,project_id TEXT NOT NULL,user_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE github_connections(project_id TEXT PRIMARY KEY REFERENCES projects(id),github_user_id TEXT NOT NULL,github_login TEXT NOT NULL,token_cipher TEXT NOT NULL,scopes TEXT NOT NULL,connected_at INTEGER NOT NULL);
CREATE TABLE lead_jobs(id TEXT PRIMARY KEY,lead_id TEXT NOT NULL REFERENCES leads(id),state TEXT NOT NULL,provider_started INTEGER NOT NULL DEFAULT 0,usage_json TEXT,error TEXT,created_at INTEGER NOT NULL,started_at INTEGER,finished_at INTEGER);
CREATE TABLE billing_project_usage_checkpoints(source TEXT NOT NULL,source_id TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(source,source_id));
CREATE TABLE legacy_import_runs(id TEXT PRIMARY KEY,source_json TEXT NOT NULL,bundle_digest TEXT NOT NULL UNIQUE,state TEXT NOT NULL,created_at INTEGER NOT NULL,completed_at INTEGER);
CREATE TABLE legacy_import_rows(run_id TEXT NOT NULL REFERENCES legacy_import_runs(id),source_table TEXT NOT NULL,source_id TEXT NOT NULL,row_digest TEXT NOT NULL,source_json TEXT NOT NULL,target_table TEXT,target_key TEXT,status TEXT NOT NULL,PRIMARY KEY(run_id,source_table,source_id));
CREATE TABLE legacy_import_objects(run_id TEXT NOT NULL REFERENCES legacy_import_runs(id),object_key TEXT NOT NULL,sha256 TEXT NOT NULL,size INTEGER NOT NULL,PRIMARY KEY(run_id,object_key));
CREATE TABLE legacy_import_holds(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES legacy_import_runs(id),source_table TEXT NOT NULL,source_id TEXT NOT NULL,reason TEXT NOT NULL,resolved_at INTEGER);
CREATE TABLE billing_usage_history(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,model TEXT,input_tokens INTEGER,output_tokens INTEGER,cost_decimal TEXT,currency TEXT NOT NULL,created_at INTEGER NOT NULL,source_json TEXT NOT NULL);
CREATE TABLE public_waitlist (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 website_url TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 request_hash TEXT NOT NULL,
 notification_status TEXT NOT NULL DEFAULT 'not_configured'
);
CREATE TABLE public_project_aliases (
 slug TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE brand_generations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),actor_id TEXT NOT NULL,request_id TEXT NOT NULL,prompt TEXT NOT NULL,model TEXT NOT NULL,size TEXT NOT NULL,quality TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('queued','running','ready','failed','uncertain')),asset_id TEXT,provider_request_id TEXT,usage_json TEXT,revised_prompt TEXT,error TEXT,created_at INTEGER NOT NULL,started_at INTEGER,completed_at INTEGER,expires_at INTEGER NOT NULL,UNIQUE(project_id,request_id));
CREATE TABLE brand_assets(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),object_key TEXT NOT NULL UNIQUE,content_type TEXT NOT NULL,filename TEXT NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,published_at INTEGER);
CREATE TABLE preview_grants(token_hash TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),actor_id TEXT NOT NULL,target_origin TEXT NOT NULL,expires_at INTEGER NOT NULL,remaining_requests INTEGER NOT NULL DEFAULT 1000, public_demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE preview_limits(key TEXT PRIMARY KEY,requests INTEGER NOT NULL,window_start INTEGER NOT NULL);
CREATE TABLE owner_setup (singleton INTEGER PRIMARY KEY CHECK(singleton=1), claim_id TEXT NOT NULL);
INSERT INTO "owner_setup" ("singleton","claim_id") VALUES(1,'cb920b81-1605-47f3-a914-01a083781cbf');
CREATE TABLE abuse_counters(key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,used INTEGER NOT NULL CHECK(used>=0),expires_at INTEGER NOT NULL);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:widgetSessionsPerIpHour:9551a098788fcc08c6614130d61d190e022c2c8601cd8fb5003ef94f7d9e2236',1791259200000,1,1791262800000);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:widgetSessionsPerProjectHour:e41c842a1f502d5ca72a1a8cfb328151aed78f65b5d66d63cf45b7cfb850c20c',1791259200000,1,1791262800000);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:conversationsPerContactHour:2c79b1ffe19c3d2e233e31de48421f9aa421983345cbe62db87a7b56bd94f11c',1791259200000,1,1791262800000);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:conversationsPerIpHour:9551a098788fcc08c6614130d61d190e022c2c8601cd8fb5003ef94f7d9e2236',1791259200000,1,1791262800000);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:conversationsPerProjectHour:e41c842a1f502d5ca72a1a8cfb328151aed78f65b5d66d63cf45b7cfb850c20c',1791259200000,1,1791262800000);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:messagesPerConversationMinute:c6b9aec9e94c2afa0e70c69bd9bea5cd99f34f232e7c0a66054a0b60ed8a75a4',1791259980000,1,1791260040000);
INSERT INTO "abuse_counters" ("key","window_start","used","expires_at") VALUES('rate:messagesPerContactHour:2c79b1ffe19c3d2e233e31de48421f9aa421983345cbe62db87a7b56bd94f11c',1791259200000,1,1791262800000);
CREATE TABLE contact_erasures(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,erased_by TEXT NOT NULL,erased_at INTEGER NOT NULL,last_erased_at INTEGER NOT NULL,runs INTEGER NOT NULL DEFAULT 1,conversations INTEGER NOT NULL DEFAULT 0,messages INTEGER NOT NULL DEFAULT 0,attachments INTEGER NOT NULL DEFAULT 0,tracked_events INTEGER NOT NULL DEFAULT 0,context_records INTEGER NOT NULL DEFAULT 0,sessions INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,contact_id));
CREATE TABLE contact_erasure_objects(project_id TEXT NOT NULL,contact_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('media','local_attachment')),source_id TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(project_id,contact_id,kind,source_id));
CREATE TABLE edition_clients(id TEXT NOT NULL,project_id TEXT NOT NULL,origin TEXT NOT NULL,redirect_uri TEXT NOT NULL,allow_loopback INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(project_id,id));
CREATE TABLE edition_grants(id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,client_id TEXT NOT NULL,project_id TEXT NOT NULL,principal_id TEXT NOT NULL,scopes TEXT NOT NULL,targets TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,token_hash TEXT UNIQUE,created_at INTEGER NOT NULL);
CREATE TABLE edition_codes(code_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES edition_grants(id),challenge TEXT NOT NULL,redirect_uri TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE edition_consents(id TEXT PRIMARY KEY,session_hash TEXT NOT NULL,request_json TEXT NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);
CREATE TABLE edition_audiences(project_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 1);
INSERT INTO "edition_audiences" ("project_id","revision") VALUES('aaf368da-0950-4ce4-aeed-331da0af5a37',2);
CREATE TABLE edition_receipts(id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,project_id TEXT NOT NULL,client_id TEXT NOT NULL,principal_id TEXT NOT NULL,operation_key TEXT NOT NULL,request_hash TEXT NOT NULL,target TEXT NOT NULL,operation TEXT NOT NULL,before_revision TEXT NOT NULL,after_revision TEXT NOT NULL,committed_at INTEGER NOT NULL,UNIQUE(installation_id,project_id,client_id,principal_id,operation_key));
CREATE TABLE edition_effect_guards(id TEXT PRIMARY KEY,valid INTEGER NOT NULL CHECK(valid=1));
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',39);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('conversation_outbox',1);
CREATE INDEX conversations_project ON conversations(project_id,updated_at);
CREATE INDEX ai_generation_conversation ON ai_generations(project_id,conversation_id,state);
CREATE UNIQUE INDEX local_one_active_conversation ON local_jobs(project_id,conversation_id) WHERE status IN ('queued','running','needs_input');
CREATE INDEX training_model_event_attempt ON training_model_events(attempt_id,id);
CREATE INDEX knowledge_datasets_project ON knowledge_datasets(project_id);
CREATE INDEX knowledge_documents_version ON knowledge_documents(version_id);
CREATE INDEX context_evidence_subject ON context_evidence(project_id,subject_id,occurred_at);
CREATE INDEX context_actions_subject ON context_actions(project_id,subject_id,occurred_at);
CREATE UNIQUE INDEX context_one_job ON context_jobs(project_id,subject_id,kind) WHERE state IN ('queued','running','uncertain');
CREATE UNIQUE INDEX user_primary_project ON user_project_preferences(user_id) WHERE is_primary=1;
CREATE INDEX billing_usage_project_time ON billing_usage_receipts(project_id,created_at);
CREATE UNIQUE INDEX lead_one_job ON lead_jobs(lead_id) WHERE state IN ('queued','running','uncertain');
CREATE INDEX public_waitlist_admission ON public_waitlist(request_hash,created_at);
CREATE UNIQUE INDEX brand_one_active ON brand_generations(project_id) WHERE state IN('queued','running','uncertain');
CREATE UNIQUE INDEX email_settings_active_inbound_ci
ON email_settings(lower(inbound_address))
WHERE is_enabled=1 AND inbound_address IS NOT NULL;
CREATE INDEX abuse_counters_expiry ON abuse_counters(expires_at);
CREATE INDEX inbound_emails_local ON inbound_emails(project_id,local_id);
CREATE TRIGGER context_evidence_added AFTER INSERT ON context_evidence BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_evidence_changed AFTER UPDATE ON context_evidence BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_evidence_removed AFTER DELETE ON context_evidence BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id AND subject_id=OLD.subject_id; END;
CREATE TRIGGER context_action_added AFTER INSERT ON context_actions BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; UPDATE context_collectors SET actions_count=actions_count+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_consent_changed AFTER UPDATE OF consent,help_types,bot_enabled ON context_subjects BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_message_added AFTER INSERT ON messages BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND (subject_id IN (SELECT contact_id FROM conversations WHERE id=NEW.conversation_id AND project_id=NEW.project_id) OR subject_id=NEW.actor_id); END;
CREATE TRIGGER context_profile_changed AFTER UPDATE OF profile ON context_profiles BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_summary_added AFTER INSERT ON context_summaries BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_insight_dismissed AFTER UPDATE OF dismissed_at ON context_insights BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_project_changed AFTER UPDATE OF name ON projects BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.id; END;
CREATE TRIGGER context_knowledge_published AFTER UPDATE OF published_version ON knowledge_datasets BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER context_message_changed AFTER UPDATE OF content ON messages BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER context_message_removed AFTER DELETE ON messages BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER context_insight_added AFTER INSERT ON context_insights BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_dataset_removed BEFORE DELETE ON knowledge_datasets BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER context_document_changed AFTER UPDATE ON knowledge_documents BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id IN (SELECT project_id FROM knowledge_datasets WHERE published_version IN (OLD.version_id,NEW.version_id)); END;
CREATE TRIGGER context_document_removed BEFORE DELETE ON knowledge_documents BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id IN (SELECT project_id FROM knowledge_datasets WHERE published_version=OLD.version_id); END;
CREATE TRIGGER context_document_added AFTER INSERT ON knowledge_documents BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id IN (SELECT project_id FROM knowledge_datasets WHERE published_version=NEW.version_id); END;
CREATE TRIGGER context_action_changed AFTER UPDATE ON context_actions BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_action_removed AFTER DELETE ON context_actions BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id AND subject_id=OLD.subject_id; END;
CREATE TRIGGER context_summary_changed AFTER UPDATE ON context_summaries BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.subject_id; END;
CREATE TRIGGER context_summary_removed AFTER DELETE ON context_summaries BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id AND subject_id=OLD.subject_id; END;
CREATE TRIGGER ai_note_added AFTER INSERT ON conversation_notes BEGIN UPDATE context_subjects SET revision=revision+1 WHERE (project_id,subject_id) IN (SELECT project_id,contact_id FROM conversations WHERE id=NEW.conversation_id); END;
CREATE TRIGGER ai_note_changed AFTER UPDATE ON conversation_notes BEGIN UPDATE context_subjects SET revision=revision+1 WHERE (project_id,subject_id) IN (SELECT project_id,contact_id FROM conversations WHERE id IN (OLD.conversation_id,NEW.conversation_id)); END;
CREATE TRIGGER ai_note_removed AFTER DELETE ON conversation_notes BEGIN UPDATE context_subjects SET revision=revision+1 WHERE (project_id,subject_id) IN (SELECT project_id,contact_id FROM conversations WHERE id=OLD.conversation_id); END;
CREATE TRIGGER ai_contact_changed AFTER UPDATE OF name,email ON contacts BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id AND subject_id=NEW.id; END;
CREATE TRIGGER ai_profile_configuration_changed AFTER UPDATE ON ai_profiles BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id IN (OLD.project_id,NEW.project_id); END;
CREATE TRIGGER ai_project_settings_changed AFTER UPDATE ON project_settings BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER ai_repository_settings_changed AFTER UPDATE ON github_settings BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER ai_project_settings_added AFTER INSERT ON project_settings BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER ai_project_settings_removed AFTER DELETE ON project_settings BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER ai_repository_settings_added AFTER INSERT ON github_settings BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER ai_repository_settings_removed AFTER DELETE ON github_settings BEGIN UPDATE context_subjects SET revision=revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER owner_setup_on_user AFTER INSERT ON users BEGIN
 INSERT INTO owner_setup(singleton,claim_id) VALUES(1,'existing-installation') ON CONFLICT(singleton) DO NOTHING;
END;
CREATE TRIGGER owner_setup_on_project AFTER INSERT ON projects BEGIN
 INSERT INTO owner_setup(singleton,claim_id) VALUES(1,'existing-installation') ON CONFLICT(singleton) DO NOTHING;
END;
CREATE TRIGGER edition_new_project AFTER INSERT ON projects BEGIN INSERT INTO edition_audiences(project_id) VALUES(NEW.id); END;
CREATE TRIGGER edition_member_insert AFTER INSERT ON memberships BEGIN UPDATE edition_audiences SET revision=revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER edition_member_update AFTER UPDATE ON memberships BEGIN UPDATE edition_audiences SET revision=revision+1 WHERE project_id IN (OLD.project_id,NEW.project_id); END;
CREATE TRIGGER edition_member_delete AFTER DELETE ON memberships BEGIN UPDATE edition_audiences SET revision=revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER edition_article_incarnation AFTER INSERT ON knowledge_articles BEGIN UPDATE knowledge_articles SET source_incarnation=lower(hex(randomblob(16))) WHERE id=NEW.id; END;
CREATE TRIGGER edition_article_revision AFTER UPDATE ON knowledge_articles WHEN NEW.source_revision=OLD.source_revision BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id=NEW.id; END;
CREATE TRIGGER edition_category_update AFTER UPDATE ON knowledge_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id IN (OLD.project_id,NEW.project_id); END;
CREATE TRIGGER edition_category_delete BEFORE DELETE ON knowledge_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id=OLD.project_id; END;
CREATE TRIGGER edition_category_insert AFTER INSERT ON knowledge_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE project_id=NEW.project_id; END;
CREATE TRIGGER edition_article_category_insert AFTER INSERT ON knowledge_article_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id=NEW.article_id; END;
CREATE TRIGGER edition_article_category_delete AFTER DELETE ON knowledge_article_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id=OLD.article_id; END;
CREATE TRIGGER edition_article_category_update AFTER UPDATE ON knowledge_article_categories BEGIN UPDATE knowledge_articles SET source_revision=source_revision+1 WHERE id IN (OLD.article_id,NEW.article_id); END;