import type {ErasureRequest} from './statements'
import {conversations,messages} from './scope'

/**
 * Inbound email claims whose stored evidence belongs to the erased contact: claims on
 * its conversations or its messages (by committed id, or by the `email:` local id the
 * claim records before admission), and claims whose envelope sender or header From is
 * one of its addresses. Binds ?1 project, ?2 contact, ?3 lowercase address array.
 */
const envelope = "lower(json_extract(evidence_json,'$.envelope_from'))"
const header = "lower(json_extract(evidence_json,'$.header_from'))"
const sentBy = (address: string) => `(${address}<>'' AND (${envelope}=${address} OR ${header}=${address} OR instr(${header},'<'||${address}||'>')>0))`
const claims = `project_id=?1 AND evidence_json IS NOT NULL AND (
 conversation_id IN (${conversations})
 OR message_id IN (SELECT id FROM messages WHERE ${messages})
 OR local_id IN (SELECT local_id FROM messages WHERE ${messages})
 OR CASE WHEN json_valid(evidence_json) THEN EXISTS(SELECT 1 FROM json_each(?3) address WHERE ${sentBy('address.value')}) ELSE 0 END)`

/** Only the classifier's rule names remain: the transcript's message.origin reads `reasons`. */
const redacted = `CASE WHEN json_valid(evidence_json) AND json_type(evidence_json,'$.reasons')='array'
 THEN json_object('reasons',json(json_extract(evidence_json,'$.reasons'))) ELSE NULL END`

/**
 * Redacts inbound_emails.evidence_json (envelope sender, header From, subject and
 * retained headers) for the erased contact. The columns come from migration
 * 0104_inbound_email_classification.sql; erasureStatements runs this in the erasure batch.
 */
export function erasureInboundEvidenceStatements(db: D1Database, request: Pick<ErasureRequest,'projectId'|'contactId'|'emails'>) {
  return [
    db.prepare(`UPDATE inbound_emails SET evidence_json=${redacted} WHERE ${claims}`)
      .bind(request.projectId, request.contactId, JSON.stringify(request.emails)),
  ]
}
