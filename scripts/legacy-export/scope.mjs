// Explicit project boundaries; unknown durable tables require a new scope rule.
export const directTables = ['projects','project_users','contacts','conversations','messages','buckets','ais',
  'categories','articles','macros','datasets','plugins','collectors','collector_actions','collector_summaries',
  'insights','ai_usages','ai_logs','project_optimizations','message_thinkings','leads','charges',
  'project_github_connections','connections'];
export const credentialColumns = {
  projects: ['verification_secret'], users: ['password','remember_token'],
  project_users: ['invitation_token'], contacts: ['key_hashes'],
  connections: ['shared_key','user_shared_key'], project_github_connections: ['access_token'],
};
export const skippedTables = ['migrations','password_resets','personal_access_tokens','asymmetric_keys',
  'contact_shared_keys','failed_jobs','jobs','job_batches','telescope_entries','telescope_entries_tags',
  'telescope_monitoring','waitlist'];
export const morphTables = {Message:'messages',Article:'articles',Project:'projects',User:'users',AI:'ais'};
export const childScopes = {
  events: ['conversation_id','conversations'], conversation_participants: ['conversation_id','conversations'],
  dataset_files: ['dataset_id','datasets'],
};
