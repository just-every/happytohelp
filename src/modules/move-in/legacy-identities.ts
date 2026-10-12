import {guarded} from './context'
import {LIMITS,type Run} from './types'
import type {Env} from '../../platform/env'
import {sha256} from '../import-kit/src/provenance/identity'
import {uploadIdentities,identityStatements} from './identities'
import {AdmissionError} from './readers/admission-error'
/** Compatibility for the unreleased original import schema only. Never trust an
 * old completeness claim: recover aliases from the actual owned original before
 * removing it. Unprocessable originals still yield to native erasure, but cannot
 * authorize future imports for that vendor after their evidence has been erased. */
export async function auditLegacyCustody(env:Env,project:string,actor?:Run){
 const persist=(statements:D1PreparedStatement[])=>actor?guarded(env,actor,statements):env.DB.batch(statements)
 const runs=(await env.DB.prepare("SELECT id,vendor,filename,object_key,artifact_hash FROM move_in_runs WHERE project_id=? AND identity_audited=0 AND state<>'erased' ORDER BY id LIMIT 2").bind(project).all<{id:string;vendor:'zendesk'|'intercom';filename:string;object_key:string;artifact_hash:string}>()).results
 for(const run of runs){
  let indexed
  try{const object=await env.FILES.get(run.object_key);if(!object)throw new AdmissionError('original_upload_missing',run.filename);if(object.size>LIMITS.inputBytes)throw new AdmissionError('upload_limit',run.filename);const bytes=new Uint8Array(await object.arrayBuffer());if(sha256(bytes)!==run.artifact_hash)throw new AdmissionError('original_upload_changed',run.filename);indexed=await uploadIdentities(project,run.vendor,run.filename,bytes)}catch(error){if(!(error instanceof AdmissionError))throw error;await persist([env.DB.prepare('UPDATE move_in_runs SET identity_audited=-1 WHERE id=? AND identity_audited=0').bind(run.id)]);continue}
  // These aliases may already match an erasure fence. Retain them rather than
  // using new-upload admission assertions, then recompute closure at erasure.
  const inserts=identityStatements(env,project,run.id,indexed.links).filter((_,index)=>index%3===1)
  await persist([...inserts,env.DB.prepare(`WITH RECURSIVE aliases(digest) AS (
   SELECT e.digest FROM move_in_identity_links l JOIN move_in_erased_identities e ON e.project_id=l.project_id AND (e.digest=l.digest OR e.digest=l.source_digest) WHERE l.project_id=?1 AND l.run_id=?2
   UNION SELECT l.source_digest FROM move_in_identity_links l JOIN aliases a ON a.digest=l.digest WHERE l.project_id=?1
   UNION SELECT l.digest FROM move_in_identity_links l JOIN aliases a ON a.digest=l.source_digest WHERE l.project_id=?1
  ) INSERT OR IGNORE INTO move_in_erased_identities(project_id,digest) SELECT ?1,digest FROM aliases`).bind(project,run.id),env.DB.prepare('UPDATE move_in_runs SET identity_audited=1 WHERE id=? AND identity_audited=0').bind(run.id)])
 }
 return !await env.DB.prepare("SELECT 1 FROM move_in_runs WHERE project_id=? AND identity_audited=0 AND state<>'erased' LIMIT 1").bind(project).first()
}

export async function requireAuditedCustody(env:Env,run:Run){
 if(run.identity_audited===1)return
 await auditLegacyCustody(env,run.project_id,run)
 const current=await env.DB.prepare('SELECT identity_audited FROM move_in_runs WHERE id=?').bind(run.id).first<{identity_audited:number}>()
 if(current?.identity_audited!==1)throw new Error('older_export_identity_audit_incomplete')
}
