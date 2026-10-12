import {contactDigests} from '../move-in/identities'
import type {SqlGuard} from '../../platform/integration-authority'
/** Imported and API-supplied identities honor the same durable erasure registry. */
export function apiContactIdentityGuard(projectId:string,contact:{email?:unknown;external_id?:unknown;metadata_json?:string|null},guard:SqlGuard):SqlGuard{
 const digests=contactDigests(projectId,contact)
 return {sql:`SELECT 1 WHERE EXISTS(${guard.sql}) AND NOT EXISTS(SELECT 1 FROM move_in_erased_identities e WHERE e.project_id=? AND e.digest IN (SELECT value FROM json_each(?)))`,params:[...guard.params,projectId,JSON.stringify(digests)]}
}
