import type {Env} from '../../../platform/env'
import {localJobs,media} from './scope'

const R2_DELETE_LIMIT = 1000

/**
 * Stop new writes by the contact, then record every R2 object to remove. The ledger
 * survives a failed request, so a retried erasure deletes the same objects again.
 */
export async function fenceAndStage(env: Env, projectId: string, contactId: string, now: number) {
  const bound = (sql: string) => env.DB.prepare(sql).bind(projectId, contactId)
  await env.DB.batch([
    env.DB.prepare("UPDATE contacts SET metadata_json=CASE WHEN json_valid(metadata_json) THEN json_set(metadata_json,'$.is_blocked',1,'$.is_deleted',1) ELSE json_object('is_blocked',1,'is_deleted',1) END WHERE project_id=?1 AND id=?2").bind(projectId, contactId),
    env.DB.prepare('UPDATE sessions SET revoked_at=coalesce(revoked_at,?3) WHERE project_id=?1 AND contact_id=?2').bind(projectId, contactId, now),
    bound(`INSERT OR IGNORE INTO contact_erasure_objects(project_id,contact_id,kind,source_id,object_key) SELECT ?1,?2,'media',id,object_key FROM media WHERE ${media}`),
    bound(`INSERT OR IGNORE INTO contact_erasure_objects(project_id,contact_id,kind,source_id,object_key) SELECT ?1,?2,'local_attachment',id,storage_key FROM local_attachments WHERE job_id IN (${localJobs})`),
  ])
}

/** Delete staged objects from R2. Deleting an absent key succeeds, so retries are safe. */
export async function deleteStagedObjects(env: Env, projectId: string, contactId: string) {
  const rows = (await env.DB.prepare('SELECT DISTINCT object_key FROM contact_erasure_objects WHERE project_id=?1 AND contact_id=?2 ORDER BY object_key').bind(projectId, contactId).all<{object_key: string}>()).results
  const keys = rows.map(row => row.object_key)
  for (let index = 0; index < keys.length; index += R2_DELETE_LIMIT) await env.FILES.delete(keys.slice(index, index + R2_DELETE_LIMIT))
  return keys.length
}
