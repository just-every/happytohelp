import type {Env} from '../../platform/env'
import type {Run} from './types'
import type {D1Sql} from '../import-kit/src/d1/types'
/** A source-owned contact/tag can be used later by a native or another import's
 * conversation. Those references are never part of this job's undo authority. */
export function undoReferencesClear(run:Run,jobId?:string):D1Sql {
 const owned="EXISTS(SELECT 1 FROM ik_provenance owned WHERE owned.job_id IN (SELECT sibling.kit_job_id FROM move_in_batches sibling JOIN move_in_batches original ON original.run_id=sibling.run_id WHERE original.kit_job_id=p.job_id) AND owned.destination=p.destination AND owned.target_kind='conversation' AND owned.target_id=c.id AND owned.reversed=0)"
 const references=[
  `SELECT 1 FROM conversations c WHERE c.project_id=p.destination AND c.contact_id=p.target_id AND NOT ${owned}`,
  `SELECT 1 FROM conversation_participants participant JOIN conversations c ON c.id=participant.conversation_id WHERE participant.contact_id=p.target_id AND c.project_id=p.destination AND NOT ${owned}`,
  `SELECT 1 FROM messages authored JOIN conversations c ON c.id=authored.conversation_id WHERE authored.actor_role='contact' AND authored.actor_id=p.target_id AND c.project_id=p.destination AND NOT ${owned}`,
  `SELECT 1 FROM conversation_tags tagged JOIN conversations c ON c.id=tagged.conversation_id WHERE tagged.tag_id=p.target_id AND tagged.project_id=p.destination AND NOT ${owned}`
 ]
 return {sql:`NOT EXISTS(SELECT 1 FROM ik_provenance p WHERE ${jobId?'p.job_id=?':'p.job_id IN (SELECT kit_job_id FROM move_in_batches WHERE run_id=?)'} AND p.destination=? AND p.reversed=0 AND ((p.target_kind='contact' AND (EXISTS(${references[0]}) OR EXISTS(${references[1]}) OR EXISTS(${references[2]}))) OR (p.target_kind='tag' AND EXISTS(${references[3]}))))`,params:[jobId??run.id,run.project_id]}
}
export async function assertUndoReferences(env:Env,run:Run,jobId?:string){const guard=undoReferencesClear(run,jobId),row=await env.DB.prepare(`SELECT (${guard.sql}) clear`).bind(...guard.params!).first<{clear:number}>();if(!row?.clear)throw new Error('NATIVE_EDIT_CONFLICT')}
