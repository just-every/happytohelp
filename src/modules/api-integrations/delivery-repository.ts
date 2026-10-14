import type {Env} from '../../platform/env'
import {D1SqlDatabase,IntegrationsRepository} from '../../vendor/base/modules/integrations/index.ts'

// Base's immutable four-attempt policy and attempt numbering stay intact. An
// exhausted delivery gets exactly one extra claim per explicit audited approval.
// Base classifies a subsequent 429 as terminal because its budget is exhausted.
const approved=`EXISTS(SELECT 1 FROM native_integration_audit a WHERE a.project_id=integration_deliveries.namespace AND a.resource_id=integration_deliveries.id AND a.action='delivery.resend.'||(integration_deliveries.attempts+1))`
export class NativeDeliveryRepository extends IntegrationsRepository {
 constructor(env:Env,projectId:string){super(new D1SqlDatabase(env.DB),projectId)}
 async due(now:number,limit=100){
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('Invalid delivery batch limit')
  return (await this.query(`SELECT id FROM integration_deliveries WHERE namespace=? AND state='queued' AND next_at<=? AND (attempts<max_attempts OR ${approved}) ORDER BY next_at,id LIMIT ?`,[now,limit])).map(row=>String(row.id))
 }
 async claim(id:string,now:number,leaseMs:number){
  const ordinary=await super.claim(id,now,leaseMs)
  if(ordinary)return ordinary
  const claim=crypto.randomUUID()
  const result=await this.sql.batch([
   {sql:`UPDATE integration_deliveries SET state='sending',attempts=attempts+1,claim=?,claim_until=? WHERE namespace=? AND id=? AND state='queued' AND next_at<=? AND attempts>=max_attempts AND ${approved} RETURNING id`,params:[claim,now+leaseMs,this.namespace,id,now]},
   {sql:'INSERT INTO integration_attempts(namespace,id,delivery_id,number,started_at) SELECT namespace,claim,id,attempts,? FROM integration_deliveries WHERE namespace=? AND id=? AND claim=?',params:[now,this.namespace,id,claim]}
  ])
  return result[0]!.length?claim:null
 }
}
