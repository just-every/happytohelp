import assert from 'node:assert/strict'
import {json} from './harness.mjs'

/** The same solved outcome stays in the denominator through custom/Closed
 * categories, while customer waiting categories reopen the current cycle. */
export async function statusCategories(h,id){
 const pending=(await h.call('/api/dashboard/projects/p/ticket-statuses',json({name:'Waiting for return label',category:'pending'}))).data
 const solved=(await h.call('/api/dashboard/projects/p/ticket-statuses',json({name:'Replacement delivered',category:'solved'}))).data
 const patch=body=>h.call(`/api/dashboard/projects/p/conversations/${id}/ticket`,{...json(body),method:'PATCH'})
 const report=()=>h.call('/api/dashboard/projects/p/reports?period=7')
 const before=await report()
 await patch({status_id:pending.id})
 const waiting=await report();assert.equal(waiting.aiResolution.total,before.aiResolution.total-1);assert.deepEqual(waiting.firstResolution,before.firstResolution)
 const customer=await h.call('/api/conversations/'+id,{actor:'visitor'});assert.equal(customer.status_id,'open');assert.ok(!JSON.stringify(customer).includes(pending.name))
 await patch({status_id:solved.id})
 const complete=await report();assert.equal(complete.aiResolution.total,before.aiResolution.total)
 await patch({status_id:'closed'})
 const closed=await report();assert.deepEqual(closed.aiResolution,complete.aiResolution);assert.equal((await h.call('/api/conversations/'+id,{actor:'visitor'})).status_id,'solved')
}
