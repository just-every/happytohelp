// Measurement-only wrapper: never selected by application builds/deployments.
import worker, {ConversationSocket as OriginalSocket} from '__EMITTED__'
globalThis.fetch = async () => { throw new Error('Outbound network prohibited during usage measurement') }
const record = value => console.log('H2H_USAGE '+JSON.stringify(value))
const methodProxy=(target,overrides)=>new Proxy(target,{get(t,k){if(k in overrides)return overrides[k];const value=Reflect.get(t,k,t);return typeof value==='function'?value.bind(t):value}})
function instrument(env,scope){
 const stmt=s=>methodProxy(s,{
  bind:(...args)=>stmt(s.bind(...args)),
  ...Object.fromEntries(['all','run','first','raw'].map(method=>[method,async(...args)=>{const t=performance.now();const result=await s[method](...args);record({kind:'d1',scope,method,meta:result?.meta??null,wall_ms:performance.now()-t});return result}]))
 })
 const DB=methodProxy(env.DB,{
  prepare:sql=>stmt(env.DB.prepare(sql)),
  batch:async statements=>{const result=await env.DB.batch(statements);for(const r of result)record({kind:'d1',scope,method:'batch',meta:r.meta??null});return result}
 })
 const FILES=methodProxy(env.FILES,Object.fromEntries(['put','get','head','list','delete'].map(method=>[method,async(...args)=>{const result=await env.FILES[method](...args);record({kind:'r2',scope,method,size:result?.size??null,metadata_bytes:result?new TextEncoder().encode(JSON.stringify({httpMetadata:result.httpMetadata,customMetadata:result.customMetadata})).length:null,key:typeof args[0]==='string'?args[0]:null});return result}])) )
 const names=new Map();const CONVERSATIONS=methodProxy(env.CONVERSATIONS,{idFromName:name=>{const id=env.CONVERSATIONS.idFromName(name);names.set(String(id),name.startsWith('project:')?'project':'conversation');return id},get:id=>{const stub=env.CONVERSATIONS.get(id);return methodProxy(stub,{fetch:async(...args)=>{record({kind:'do_request',scope,object:String(id),object_kind:names.get(String(id))??'unknown',path:new URL(typeof args[0]==='string'?args[0]:args[0].url).pathname});return stub.fetch(...args)}})}})
 const JOBS=methodProxy(env.JOBS,{send:async(...args)=>{record({kind:'queue_send',scope,bytes:new TextEncoder().encode(JSON.stringify(args[0])).length});return env.JOBS.send(...args)},sendBatch:async(...args)=>{record({kind:'queue_batch',scope,count:args[0].length});return env.JOBS.sendBatch(...args)}})
 return {...env,DB,FILES,CONVERSATIONS,JOBS}
}
export class ConversationSocket extends OriginalSocket{
 constructor(ctx,env){super(ctx,instrument(env,'do'));this.meterCtx=ctx}
 async fetch(request){const t=performance.now();try{return await super.fetch(request)}finally{record({kind:'do_handler',method:'fetch',wall_ms:performance.now()-t,attachments:this.meterCtx.getWebSockets().map(ws=>JSON.stringify(ws.deserializeAttachment()).length)})}}
 async webSocketMessage(ws,message){record({kind:'do_frame_in',bytes:typeof message==='string'?new TextEncoder().encode(message).length:message.byteLength});return super.webSocketMessage(ws,message)}
}
export default {
 async fetch(request,env,ctx){const t=performance.now();const path=new URL(request.url).pathname;if(path==='/__usage/storage'){const transcript=await env.DB.prepare('SELECT count(*) messages,coalesce(sum(length(content)),0) content_characters FROM messages').all();return Response.json({local_size_after:transcript.meta.size_after,transcript:transcript.results[0],ai_rounds:(await env.DB.prepare('SELECT count(*) n FROM ai_round_usage').first()).n})}try{return await worker.fetch(request,instrument(env,'worker'),ctx)}finally{record({kind:'worker',path,wall_ms:performance.now()-t})}},
 async queue(batch,env,ctx){record({kind:'queue_consume',count:batch.messages.length});return worker.queue(batch,instrument(env,'queue'),ctx)},
 async scheduled(event,env,ctx){record({kind:'cron'});return worker.scheduled(event,instrument(env,'cron'),ctx)}
}
