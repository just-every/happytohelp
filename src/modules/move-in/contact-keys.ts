import type {Env} from '../../platform/env'
import type {Run} from './types'
import {guarded} from './context'
import {identityDigest} from './identities'
export const emailKey=(project:string,email:string)=>identityDigest(project,'email',email.trim().toLowerCase())
/** SQL cannot reproduce JavaScript Unicode lowercasing/trimming. Native writes
 * invalidate this small index; reconcile at most 100 entries per queue turn.
 * No prior workspace inventory is accumulated in the planner. */
export async function reconcileContactKeys(env:Env,run:Run){
 const rows=(await env.DB.prepare('SELECT k.contact_id,c.email FROM move_in_contact_keys k JOIN contacts c ON c.id=k.contact_id AND c.project_id=k.project_id WHERE k.project_id=? AND k.email_digest IS NULL ORDER BY k.contact_id LIMIT 100').bind(run.project_id).all<{contact_id:string;email:string}>()).results
 if(!rows.length)return true
 await guarded(env,run,rows.map(row=>env.DB.prepare('UPDATE move_in_contact_keys SET email_digest=? WHERE project_id=? AND contact_id=? AND EXISTS(SELECT 1 FROM contacts WHERE id=? AND project_id=? AND email IS ?)').bind(emailKey(run.project_id,row.email),run.project_id,row.contact_id,row.contact_id,run.project_id,row.email)))
 return false
}
