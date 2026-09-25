import {requestGeneration} from '../../src/modules/ai-support/repository'
export {ConversationSocket} from '../../src/modules/conversations/socket'

let queueCalls = 0

export default {
 async fetch(request:Request,env:any){
  if(new URL(request.url).pathname!=='/request')return new Response('Not found',{status:404})
  try{
   const result=await requestGeneration({...env,JOBS:{send:async()=>{queueCalls++}}},await request.json() as any)
   return Response.json({result,queueCalls})
  }catch(error){
   return Response.json({error:String(error),queueCalls},{status:409})
  }
 }
}
