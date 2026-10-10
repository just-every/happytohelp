// Exact table inventory: the public v0.2.1 schema plus the named additions.
export const baselineTables = [
  'abuse_counters', 'ai_attempt_events', 'ai_attempts', 'ai_defaults',
  'ai_generations', 'ai_profiles', 'ai_round_usage', 'billing_accounts',
  'billing_ledger', 'billing_operations', 'billing_project_usage_checkpoints', 'billing_usage_history',
  'billing_usage_receipts', 'billing_webhook_receipts', 'brand_assets', 'brand_generations',
  'contact_erasure_objects', 'contact_erasures', 'contacts', 'context_actions',
  'context_collectors', 'context_evidence', 'context_insights', 'context_job_events',
  'context_jobs', 'context_profiles', 'context_subjects', 'context_summaries',
  'context_tracked_events', 'context_write_guards', 'conversation_ai', 'conversation_buckets',
  'conversation_notes', 'conversation_outbox', 'conversation_participants', 'conversation_reads',
  'conversations', 'credentials', 'd1_migrations', 'email_deliveries',
  'email_settings', 'github_connections', 'github_oauth_states', 'github_settings',
  'identity_tokens', 'inbound_emails', 'integration_events', 'knowledge_article_categories',
  'knowledge_articles', 'knowledge_categories', 'knowledge_datasets', 'knowledge_documents',
  'knowledge_imports', 'knowledge_versions', 'lead_jobs', 'leads',
  'legacy_import_holds', 'legacy_import_objects', 'legacy_import_rows', 'legacy_import_runs',
  'local_attachment_grants', 'local_attachments', 'local_authorizations', 'local_device_settings',
  'local_devices', 'local_events', 'local_grants', 'local_jobs',
  'local_pairings', 'local_receipts', 'local_result_effects', 'login_attempts',
  'macros', 'management_audit', 'media', 'memberships',
  'messages', 'owner_setup', 'platform_admins', 'plugins',
  'preview_grants', 'preview_limits', 'project_settings', 'projects',
  'public_project_aliases', 'public_waitlist', 'registrations', 'sessions',
  'sqlite_sequence', 'training_cases', 'training_model_events', 'training_model_rounds',
  'training_runs', 'training_workspaces', 'user_project_preferences', 'user_settings',
  'users',
];
export const addedTables = [
  // 0105_edition_delegation.sql
  'edition_clients', 'edition_grants', 'edition_codes', 'edition_consents', 'edition_audiences', 'edition_receipts', 'edition_effect_guards',
  // 0107_activation_receipts.sql
  'activation_receipts', 'activation_widget_pings', 'activation_inbound_receipts',
  // 0108_public_answer_citations.sql
  'ai_generation_sources',
  // 0109_magic_signins.sql
  'magic_signins',
];
