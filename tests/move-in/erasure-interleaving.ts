import {app} from '../../src/app'
import {eraseContact} from '../../src/modules/management/contact-erasure'
import type {Env} from '../../src/platform/env'
/** Real route and D1, paused after native validation but before its write. */
export async function nativeUpdateDuringErasure(request:Request,env:Env,context:ExecutionContext){
 let fired=false
 const db=new Proxy(env.DB,{get(target,key){if(key==='prepare')return (sql:string)=>{
  const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>new Proxy(statement,{get(target,key){if(key==='bind')return (...args:any[])=>wrap(target.bind(...args));if(key==='run')return async()=>{if(!fired&&/^UPDATE contacts SET/.test(sql)){fired=true;await eraseContact(env,'p','native','owner')}return target.run()};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
  return wrap(target.prepare(sql))
 };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const route=new URL(request.url).searchParams.get('route'),path=route==='widget'?'/api/conversations/own/widget-events':route==='session'?'/api/identity/widget/session':'/api/management/projects/p/contacts/native'
 const response=await app.fetch(new Request('https://app.example'+path,{method:route?'POST':'PUT',headers:request.headers,body:await request.text()}),{...env,DB:db},context)
 return Response.json({status:response.status,fired})
}
export async function interruptFirstFence(request:Request,env:Env,context:ExecutionContext){
 const {id,change}=await request.json<{id:string;change?:Record<string,unknown>}>();let fired=false,injected=false
 const db=new Proxy(env.DB,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{if(change&&!injected){injected=true;const update=await app.fetch(new Request(`https://app.example/api/management/projects/p/contacts/${id}`,{method:'PUT',headers:request.headers,body:JSON.stringify(change)}),env,context);if(update.status!==200)throw new Error('fixture native update failed')}const result=await target.batch(statements);if(!fired){fired=true;throw new Error('test interruption after first fence')}return result};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const response=await app.fetch(new Request(`https://app.example/api/management/projects/p/contacts/${id}/erase`,{method:'POST',headers:request.headers,body:'{}'}),{...env,DB:db},context)
 return Response.json({status:response.status,fired})
}
