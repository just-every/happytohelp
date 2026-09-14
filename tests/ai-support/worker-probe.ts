import {executeTrainingCase} from '../../src/modules/ai-support/training'
import { withWorkerRuntime, durableFiles } from '../../src/modules/ai-support/vendor/ensemble/worker-runtime.js'
import { runStream } from '../../src/modules/ai-support/llm/orchestrator.js'
export default {async fetch(request:Request,env:any){
 if(new URL(request.url).pathname==='/provider'){const model=new URL(request.url).searchParams.get('model');let usage:any;const result=await withWorkerRuntime({settings:env,files:env.FILES,scope:'provider'},()=>runStream({task:'user_reply',messages:[{role:'user',content:'Provider fixture'}],options:{model},trace:{onUsage:(u:any)=>{usage=u}}}));return Response.json({result,usage})}
 if(new URL(request.url).pathname==='/training')return Response.json(await executeTrainingCase(env,await request.json() as any))
 if(new URL(request.url).pathname==='/sdk') {
 const events:any[]=[];let usage:any
 const result=await withWorkerRuntime({apiKey:'sk-fixture',files:env.FILES,scope:'sdk'},()=>runStream({task:'user_reply',messages:[{role:'user',content:'Fixture request'}],options:{model:'gpt-5.6-luna'},trace:{onEvent:(e:any)=>events.push(e.type),onUsage:(u:any)=>{usage=u}}}))
 return Response.json({result,events,usage})
 }
 const events:any[]=[],rounds:any[]=[];let calls=0,toolCalls=0
 const provider={provider_id:'openai',async *createResponseStream(messages:any,model:any,agent:any,id:string){
 calls++
 if(calls===1)yield {type:'tool_start',tool_call:{id:'call_1',type:'function',function:{name:'lookup',arguments:'{"query":"policy"}'}},request_id:id}
 else {yield {type:'message_delta',content:'Answer grounded in the policy',request_id:id};yield {type:'message_complete',content:'Answer grounded in the policy',request_id:id}}
 yield {type:'cost_update',request_id:id,usage:{model,input_tokens:10,output_tokens:2,total_tokens:12}}
 }}
 const runtime={apiKey:'sk-test',provider,files:env.FILES,scope:'probe'}
 const output=await withWorkerRuntime(runtime,async()=>{
 await durableFiles.writeFile('summaries/source.txt','retained source');const retained=await durableFiles.readFile('summaries/source.txt')
 const result=await runStream({task:'user_reply',messages:[{role:'user',content:'Policy?'}],tools:[{definition:{type:'function',function:{name:'lookup',description:'Read policy',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},function:async(query:string)=>{toolCalls++;return {policy:query}}}],options:{model:'gpt-5.6-luna',maxToolCalls:2,maxToolCallRoundsPerTurn:2},trace:{onEvent:(event:any)=>events.push(event.type),onUsage:(usage:any)=>rounds.push(...usage.rounds)}})
 return {result,retained}
 })
 return Response.json({...output,events,rounds,calls,toolCalls})
}}
