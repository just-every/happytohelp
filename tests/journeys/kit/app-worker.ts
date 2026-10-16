import {app} from '../../../src/app'
import {consumeQueue} from '../../../src/queue'
import {runScheduled} from '../../../src/jobs'
import {dispatchOperatorNotifications} from '../../../src/modules/integrations/notifications'
import type {Env} from '../../../src/platform/env'
export {ConversationSocket} from '../../../src/modules/conversations/socket'

// The real application router over real D1/R2/Durable Objects. With
// H2H_TEST_CAPTURE_QUEUE, queued jobs wait for the test to run them, so a test
// controls when background work happens; otherwise the Miniflare queue runs them.
const captured:unknown[]=[]
const bindings=(env:Env):Env=>env.H2H_TEST_CAPTURE_QUEUE?{...env,JOBS:{send:async(job:unknown)=>{captured.push(job)},sendBatch:async(batch:{body:unknown}[])=>{captured.push(...batch.map(item=>item.body))}} as unknown as Env['JOBS']}:env
export default {
 async fetch(request:Request,env:Env,context:ExecutionContext){
  const path=new URL(request.url).pathname
  if(path==='/_test/queue/take')return Response.json(captured.splice(0))
  if(path==='/_test/queue/run'){
   const jobs=await request.json<any[]>(),acked:number[]=[],retried:number[]=[]
   await consumeQueue({messages:jobs.map((body,index)=>({id:String(index),body,ack(){acked.push(index)},retry(){retried.push(index)}}))} as any,bindings(env))
   return Response.json({acked,retried})
  }
  if(path==='/_test/scheduled'){await Promise.all([runScheduled(bindings(env)),dispatchOperatorNotifications(bindings(env))]);return Response.json({ran:true})}
  return app.fetch(request,bindings(env),context)
 },
 async queue(batch:MessageBatch<any>,env:Env){await consumeQueue(batch,env)},
}
