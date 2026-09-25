import {conversations,generations,localJobs,media,messages,notes,projectConversations,subject} from './scope'

const first = (column: string) => `CASE WHEN instr(${column},',')>0 THEN substr(${column},1,instr(${column},',')-1) ELSE ${column} END`
const ids = (table: string, where: string) => `SELECT id FROM ${table} WHERE ${where}`

/** Legacy rows record their first mapped target as (table, key); key formats follow the importer. */
const erasedTargets: [string, string][] = [
  ['contacts', "key=?2"],
  ['conversations', `key IN (${conversations})`],
  ['conversation_buckets', `key IN (${ids('conversation_buckets', `conversation_id IN (${conversations})`)})`],
  ['messages', `key IN (${ids('messages', messages)})`],
  ['media', `key IN (${ids('media', media)})`],
  ['conversation_notes', `key IN (${notes})`],
  ['conversation_participants', `key IN (${ids('conversation_participants', `contact_id=?2 AND conversation_id IN (${projectConversations})`)})`],
  ['context_subjects', "key=?1||':'||?2"],
  ['context_collectors', "key=?1||':'||?2"],
  ['context_profiles', `key IN (SELECT project_id||':'||subject_id||':'||type FROM context_profiles WHERE ${subject})`],
  ...['context_evidence', 'context_insights', 'context_summaries', 'context_actions', 'context_tracked_events'].map(table => [table, `key IN (${ids(table, subject)})`] as [string, string]),
  ['ai_generations', `key IN (${generations})`],
  ['local_jobs', `key IN (${localJobs})`],
  ['local_events', `key IN (SELECT job_id||':'||event_id FROM local_events WHERE job_id IN (${localJobs}))`],
]

/**
 * Legacy import keeps each imported source row verbatim for replay custody. Replay
 * compares row_digest only, so erasure clears the verbatim copy of every row that
 * mapped to this contact's data while keeping the digest: replaying the same bundle
 * still skips those rows instead of restoring them. Must run before rows are deleted.
 */
export const legacyArchiveRedaction = `UPDATE legacy_import_rows SET source_json='{}' WHERE rowid IN (
 SELECT legacy_rowid FROM (SELECT rowid legacy_rowid,${first('target_table')} target,${first('target_key')} key FROM legacy_import_rows
  WHERE source_json<>'{}' AND target_table IS NOT NULL AND target_key IS NOT NULL)
 WHERE ${erasedTargets.map(([table, match]) => `(target='${table}' AND ${match})`).join('\n  OR ')})`
