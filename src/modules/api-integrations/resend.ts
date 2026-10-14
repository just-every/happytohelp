import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import {issuerGuard,type Issuer} from '../../platform/integration-authority'
import {validateDestination} from '../../vendor/base/modules/integrations/index.ts'
import {destination} from './destinations'

/** One explicit approval names the observed attempt, so an old click cannot
 * approve another send after a newer uncertain outcome. No transport runs here. */
export async function resendDelivery(env:Env,who:Issuer,id:string,attempt:number){
 if(!Number.isSafeInteger(attempt)||attempt<1)throw new HTTPException(400,{message:'The observed delivery attempt is required'})
 const project=who.actor.projectId,guard=await issuerGuard(env,who)
 const row=await env.DB.prepare('SELECT * FROM integration_deliveries WHERE namespace=? AND id=?').bind(project,id).first<any>()
 if(!row)throw new HTTPException(404,{message:'Delivery unavailable'})
 if(row.state!=='uncertain'||row.attempts!==attempt)throw new HTTPException(409,{message:'Delivery changed. Refresh before deciding whether to resend.'})
 const envelope=JSON.parse(row.envelope)
 if(envelope.protocol!=='webhook'||envelope.id!==id||envelope.tenant!==project)throw new HTTPException(409,{message:'Webhook delivery unavailable'})
 let target:any
 try{
  target=await destination(env,project,envelope.destinationId)
  validateDestination(target.secret.url)
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(target.secret.url))),b=>b.toString(16).padStart(2,'0')).join('')
  if(target.kind!=='webhook'||digest!==row.destination_hash)throw Error()
 }catch{throw new HTTPException(409,{message:'The original destination is unavailable or changed'})}
 const auditId=crypto.randomUUID(),now=Date.now()
 const result=await env.DB.batch([
  env.DB.prepare(`INSERT INTO native_integration_audit(id,project_id,actor_id,action,resource_id,created_at)
   SELECT ?,v.namespace,?, 'delivery.resend.'||(v.attempts+1),v.id,? FROM integration_deliveries v
   JOIN native_integration_intents i ON i.id=v.id AND i.project_id=v.namespace
   JOIN native_integration_events e ON e.id=i.event_id AND e.project_id=i.project_id
   JOIN native_integration_destinations d ON d.id=i.destination_id AND d.project_id=i.project_id
   WHERE v.namespace=? AND v.id=? AND v.state='uncertain' AND v.attempts=? AND v.envelope=? AND v.destination_hash=?
   AND d.id=? AND d.kind='webhook' AND d.enabled=1 AND d.secret_ciphertext=?
   AND e.event=? AND e.erased_at IS NULL AND i.error_code IS NULL
   AND (e.contact_id IS NULL OR EXISTS(SELECT 1 FROM contacts ct WHERE ct.id=e.contact_id AND ct.project_id=e.project_id AND COALESCE(json_extract(ct.metadata_json,'$.is_erasing'),0)!=1 AND COALESCE(json_extract(ct.metadata_json,'$.is_erased'),0)!=1))
   AND EXISTS(${guard.sql})`).bind(auditId,who.actor.id,now,project,id,attempt,row.envelope,row.destination_hash,envelope.destinationId,target.secret_ciphertext,envelope.event,...guard.params),
  env.DB.prepare(`UPDATE integration_deliveries SET state='queued',next_at=?,claim=NULL,claim_until=NULL WHERE namespace=? AND id=? AND EXISTS(SELECT 1 FROM native_integration_audit WHERE id=?)`).bind(now,project,id,auditId)
 ])
 if(!result[0].meta.changes)throw new HTTPException(409,{message:'Delivery, destination or authority changed. Refresh before deciding whether to resend.'})
 return {id,state:'queued',attempts:attempt}
}
