import type {Env} from '../../platform/env'
import {inboundTarget} from './inbound-routing'

const enabledMailboxes=(count:number)=>`SELECT e.project_id,lower(e.inbound_address) inbound_address,lower(e.from_address) from_address FROM email_settings e WHERE lower(e.inbound_address) IN (${Array(count).fill('?').join(',')}) AND e.is_enabled=1 AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=e.project_id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL)`
/** The first candidate, in order, that names an enabled mailbox. One lookup: D1
 * binds at most 100 parameters and the candidates are bounded below that. */
export async function receivingMailbox(env:Env,candidates:string[]){
 const targets=candidates.map(inboundTarget).filter(target=>target!==null),mailboxes=[...new Set(targets.map(target=>target.mailbox))].slice(0,90)
 if(!mailboxes.length)return null
 const rows=(await env.DB.prepare(enabledMailboxes(mailboxes.length)).bind(...mailboxes).all<{project_id:string;inbound_address:string;from_address:string|null}>()).results
 for(const target of targets){
  const row=rows.find(entry=>entry.inbound_address===target.mailbox)
  if(row)return {project:{project_id:row.project_id,from_address:row.from_address},target}
 }
 return null
}
