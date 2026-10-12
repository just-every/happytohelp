// Hand-declared M9 additions. Historical launch/candidate profiles are unchanged.
export const m9Migrations = ['0110_move_in.sql','111_move_in_identity_audit.sql','112_conversation_outcomes.sql','113_outcomes_history.sql'];
export const m9Tables = [
  'ik_jobs','ik_original_sets','ik_originals','ik_sources','ik_provenance','ik_stages',
  'ik_batches','ik_targets','ik_d1_plan_chunks','ik_d1_original_chunks','ik_d1_history',
  'ik_d1_entries','ik_d1_assertions','workspace_tags','conversation_tags','move_in_runs',
  'move_in_records','move_in_batches','move_in_origins','move_in_notes','move_in_message_sources',
  'move_in_conversations','move_in_native_fences','move_in_erasure_runs','move_in_erasure_objects',
  'move_in_identity_links','move_in_erased_identities','move_in_contact_keys',
];
