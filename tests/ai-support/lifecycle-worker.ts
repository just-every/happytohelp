import {requestGeneration} from '../../src/modules/ai-support/repository'
import {handleGeneration} from '../../src/modules/ai-support/service'
export {ConversationSocket} from '../../src/modules/conversations/socket'
export default {async fetch(request:Request,env:any){const job=await request.json();if(new URL(request.url).pathname==='/request')return Response.json(await requestGeneration({...env,JOBS:{send:async()=>{}}},job as any));await handleGeneration(env,job as any);return Response.json({ok:true})}}
