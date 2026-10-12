// Hand-declared official Base 7e31 additive D1 evolution, separate from C.
export const importEvolutionMigrations=['116_import_kit_custody.sql'];
export const importEvolutionTables=['ik_d1_creation_plans','ik_d1_reversal_reports'];

// Additive runtime closure required by the official current import-kit entrypoint.
export const importRuntimeMigrations=['118_import_kit_runtime.sql'];
export const importRuntimeTables=["ik_d1_streams","ik_d1_stream_pages","ik_d1_erased_sources","ik_d1_erased_targets","ik_d1_indexed_jobs","ik_d1_plan_index","ik_d1_stream_origins","ik_d1_stream_revisions","ik_d1_publication_fences","ik_d1_staging","ik_d1_staging_pages","ik_d1_staging_chunks","ik_d1_staging_index","ik_d1_staging_originals","ik_d1_custody_revisions","ik_d1_native_staging","ik_d1_native_staging_index","ik_d1_native_staging_values","ik_d1_custody_states","ik_d1_preparation_receipts","ik_d1_staging_headers"];
