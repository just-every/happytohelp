import type {Env} from '../../platform/env'

const owned='SELECT id FROM conversations WHERE project_id=?1 AND contact_id=?2'
// View definitions can name the requester, subject or a custom value. Resolve
// those references while the source values still exist, before redacting them.
const affectedViews=`project_id=?1 AND EXISTS(SELECT 1 FROM json_tree(ticket_views.filters_json) filter WHERE filter.type='text' AND filter.atom<>'' AND (
 filter.atom=?2
 OR EXISTS(SELECT 1 FROM contacts c WHERE c.project_id=?1 AND c.id=?2 AND filter.atom IN (c.name,c.email,c.external_id))
 OR EXISTS(SELECT 1 FROM conversations c WHERE c.id IN (${owned}) AND c.subject=filter.atom)
 OR EXISTS(SELECT 1 FROM ticket_field_values f,json_tree(f.value_json) value WHERE f.project_id=?1 AND f.conversation_id IN (${owned}) AND value.type='text' AND value.atom=filter.atom)
 OR EXISTS(SELECT 1 FROM contacts c,json_tree(c.metadata_json) value WHERE c.project_id=?1 AND c.id=?2 AND value.type='text' AND value.atom=filter.atom)))`
export const ticketErasureCount=`(SELECT count(*) FROM ticket_field_values WHERE project_id=?1 AND conversation_id IN (${owned}))+(SELECT count(*) FROM ticket_history WHERE project_id=?1 AND (conversation_id IN (${owned}) AND changes_json<>'{"erased":true}' OR actor_type='contact' AND actor_id=?2))+(SELECT count(*) FROM ticket_views WHERE ${affectedViews})`

export function ticketErasureStatements(env:Env,projectId:string,contactId:string){
 const bound=(sql:string)=>env.DB.prepare(sql).bind(projectId,contactId)
 return [
  bound(`DELETE FROM ticket_views WHERE ${affectedViews}`),
  bound(`DELETE FROM ticket_field_values WHERE project_id=?1 AND conversation_id IN (${owned})`),
  bound(`UPDATE conversations SET subject='' WHERE project_id=?1 AND contact_id=?2`),
  bound(`UPDATE ticket_history SET changes_json='{"erased":true}',actor_id=CASE WHEN actor_type='contact' AND actor_id=?2 THEN NULL ELSE actor_id END WHERE project_id=?1 AND (conversation_id IN (${owned}) OR actor_type='contact' AND actor_id=?2 OR EXISTS(SELECT 1 FROM json_tree(changes_json) j WHERE j.type='text' AND j.atom=?2))`),
 ]
}
