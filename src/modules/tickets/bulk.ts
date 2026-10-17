import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {Actor,AppEnv} from '../../platform/env'
import {scope} from '../management/common'
import {memberAccess} from '../access/gate'
import {auditStatement,requestSource} from '../audit/record'
import {mutateTicket,previewTicket} from './mutate'

interface Selection {id:string;expected_version:number}
interface BulkInput {tickets:Selection[];changes:Record<string,unknown>}
function input(body:unknown):BulkInput{
 if(!body||typeof body!=='object')throw new HTTPException(400,{message:'A bulk selection and changes are required'})
 const {tickets,changes}=body as BulkInput
 if(!Array.isArray(tickets)||!tickets.length||tickets.length>100)throw new HTTPException(400,{message:'Select 1–100 tickets'})
 const seen=new Set<string>()
 for(const item of tickets){
  if(!item||typeof item.id!=='string'||!item.id||item.id.length>160||seen.has(item.id)||!Number.isSafeInteger(item.expected_version)||item.expected_version<0)throw new HTTPException(400,{message:'Each ticket needs a unique id and expected_version'})
  seen.add(item.id)
 }
 const allowed=['assigned_to','add_tags','remove_tags','priority','status_id']
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!allowed.includes(key)))throw new HTTPException(400,{message:'Bulk changes may only assign, tag or change priority/status'})
 return {tickets,changes}
}
export const bulkRoutes=new Hono<AppEnv>()
for(const action of ['preview','apply'] as const)bulkRoutes.post(`/projects/:projectId/tickets/bulk/${action}`,async c=>{
 const actor=await scope(c) as Actor,body=input(await c.req.json()),results:Record<string,unknown>[]=[],batchId=crypto.randomUUID()
 // Recheck current role on every record; previews never convey authority to apply.
 for(const selected of body.tickets){
  try{
   const access=await memberAccess(c.env.DB,actor.projectId,actor.id)
   if(!access?.permissions.has('conversations.manage'))throw new HTTPException(403,{message:'Your role cannot change tickets'})
   const change={...body.changes,expected_ticket_version:selected.expected_version},authority={sessionHash:c.get('sessionHash'),source:requestSource(c)}
   if(action==='preview'){
    const preview=await previewTicket(c.env,actor,selected.id,change,authority)
    results.push({id:selected.id,status:'ready',expected_version:selected.expected_version,changes:preview.changes})
   }else{
    const ticket=await mutateTicket(c.env,actor,selected.id,change,authority)
    results.push({id:selected.id,status:'applied',ticket_version:ticket.ticket_version})
   }
  }catch(error){
   const status=error instanceof HTTPException?error.status===409?'stale':[401,403,404].includes(error.status)?'forbidden':[400,422].includes(error.status)?'invalid':'failed':'failed'
   // Conceal other workspaces and report an unconfirmed operation without replaying it.
   const reason=status==='forbidden'?'Ticket is unavailable or your role cannot change it':status==='failed'?(action==='apply'?'The update outcome could not be confirmed. Reload this ticket before trying again.':'The preview could not be completed.'):(error as Error).message||'Ticket change refused'
   if(status==='failed')console.error('Ticket bulk operation failed',{batch_id:batchId,id:selected.id,action})
   results.push({id:selected.id,status,reason})
  }
  const result=results[results.length-1]
  await auditStatement(c.env.DB,{projectId:actor.projectId,category:'data',action:`ticket.bulk.${action}`,outcome:result.status==='failed'?'failed':['ready','applied'].includes(String(result.status))?'succeeded':'refused',actor:{type:'user',id:actor.id},source:requestSource(c),target:{type:'conversation',id:selected.id},detail:{batch_id:batchId,result:result.status,fields:Object.keys(body.changes)}}).run()
 }
 const counts:Record<string,number>={}
 for(const result of results){const status=String(result.status);counts[status]=(counts[status]||0)+1}
 return c.json({data:{batch_id:batchId,results,counts}})
})
