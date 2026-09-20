import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {scope,text} from '../management/common'
import {releaseInterruptedInbound} from './inbound-recovery'
import {scopedInboundId} from './inbound-identity'
export const inboundRecoveryRoutes=new Hono<AppEnv>()
inboundRecoveryRoutes.get('/projects/:projectId/inbound-emails/:messageId',async c=>{
 const actor=await scope(c,true)
 const messageId=c.req.param('messageId'),scopedId=await scopedInboundId(actor.projectId,messageId),receipt=await c.env.DB.prepare('SELECT * FROM inbound_emails WHERE project_id=? AND id IN (?,?)').bind(actor.projectId,messageId,scopedId).first()
 if(!receipt)throw new HTTPException(404)
 return c.json({data:receipt})
})
inboundRecoveryRoutes.post('/projects/:projectId/inbound-emails/:messageId/reconcile',async c=>{
 const actor=await scope(c,true),body=await c.req.json()
 if(!Number.isSafeInteger(body.createdAt))throw new HTTPException(400)
 return c.json(await releaseInterruptedInbound(c.env,{
  projectId:actor.projectId,messageId:c.req.param('messageId'),intentHash:text(body.intentHash,200),createdAt:body.createdAt,
  conversationId:body.conversationId===null?null:text(body.conversationId,200),claimToken:body.claimToken===null?null:text(body.claimToken,200),
  priorExecutionEnded:body.priorExecutionEnded===true,
 }))
})
