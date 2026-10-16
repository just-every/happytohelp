import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import {inboundLocalId,legacyInboundLocalId,scopedInboundId} from './inbound-identity'

/** Operator reconciliation for a receipt whose sender never retries (a sender's
 * retry reclaims a stale claim itself): the prior Worker invocation must be confirmed
 * ended. An observed receipt is required so an operator cannot release a different
 * claim by Message-ID alone.
 */
export async function releaseInterruptedInbound(env:Env,input:{projectId:string;messageId:string;intentHash:string;createdAt:number;conversationId:string|null;claimToken:string|null;priorExecutionEnded:boolean}){
 if(input.priorExecutionEnded!==true)throw new HTTPException(409,{message:'Confirm the prior inbound execution has ended before reconciliation'})
 const localId=await inboundLocalId(input.projectId,input.messageId),legacyLocalId=await legacyInboundLocalId(input.messageId),scopedId=await scopedInboundId(input.projectId,input.messageId)
 const result=await env.DB.prepare(`UPDATE inbound_emails SET state='failed',error='Operator confirmed prior execution ended before admission'
  WHERE id IN (?,?) AND project_id=? AND intent_hash=? AND created_at=? AND conversation_id IS ? AND claim_token IS ? AND state='processing'
  AND NOT EXISTS(SELECT 1 FROM messages WHERE project_id=? AND local_id IN (?,?))`)
  .bind(input.messageId,scopedId,input.projectId,input.intentHash,input.createdAt,input.conversationId,input.claimToken,input.projectId,localId,legacyLocalId).run()
 if(!result.meta.changes)throw new HTTPException(409,{message:'Inbound receipt changed, already admitted, or is outside the selected project'})
 return {id:input.messageId,state:'failed',retryable:true}
}
