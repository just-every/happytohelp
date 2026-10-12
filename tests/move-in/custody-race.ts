import type {Env} from '../../src/platform/env'
import {putPrivate} from '../../src/modules/move-in/private-custody'
import {getRun} from '../../src/modules/move-in/run-store'
/** Real R2 conditional-write race at the last asynchronous boundary. */
export async function custodyRace(env:Env,id:string){
 const run=(await getRun(env,id))!,key=`move-in/${run.project_id}/${id}/files/late-writer`
 const files=new Proxy(env.FILES,{get(target,property){if(property==='put')return async(k:string,value:any,options:any)=>{if(value==='Private late content'){await env.DB.prepare("UPDATE move_in_runs SET state='erased' WHERE id=?").bind(id).run();await target.delete(k)}return target.put(k,value,options)};const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value}})
 let reason='';try{await putPrivate({...env,FILES:files},run,key,'Private late content')}catch(error){reason=(error as Error).message}
 return {reason,retained:!!await env.FILES.head(key)}
}
/** Two real conditional R2 writes share a reservation. A losing writer must not
 * delete bytes published by the winner. Only scheduling is intercepted. */
export async function custodyWriters(env:Env,id:string){
 const run=(await getRun(env,id))!,key=`move-in/${run.project_id}/${id}/files/concurrent`,body='Concurrent private content'
 let ready!:()=>void,release!:()=>void
 const waiting=new Promise<void>(resolve=>ready=resolve),released=new Promise<void>(resolve=>release=resolve)
 const files=new Proxy(env.FILES,{get(target,property){if(property==='put')return async(k:string,value:any,options:any)=>{if(value===body){ready();await released}return target.put(k,value,options)};const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value}})
 const first=putPrivate({...env,FILES:files},run,key,body).catch(error=>(error as Error).message)
 await waiting;await putPrivate(env,run,key,body);release();const loser=await first
 return {loser,retained:await (await env.FILES.get(key))?.text()===body}
}
/** Delete the first reservation while a second writer is paused immediately
 * after creating a replacement. The stale first writer must never publish. */
export async function custodyReservationABA(env:Env,id:string){
 const run=(await getRun(env,id))!,key=`move-in/${run.project_id}/${id}/files/reservation-race`,body='Private late content'
 let paused!:()=>void,release!:()=>void,lateWriteAccepted=false
 const waiting=new Promise<void>(resolve=>paused=resolve),released=new Promise<void>(resolve=>release=resolve)
 const replacement=new Proxy(env.FILES,{get(target,property){if(property==='put')return async(k:string,value:any,options:any)=>{const result=await target.put(k,value,options);if(value!==body){paused();await released}return result};const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value}})
 let second:Promise<unknown>|undefined
 const firstFiles=new Proxy(env.FILES,{get(target,property){if(property==='put')return async(k:string,value:any,options:any)=>{if(value===body){await env.DB.prepare("UPDATE move_in_runs SET state='erased' WHERE id=?").bind(id).run();await target.delete(k);second=putPrivate({...env,FILES:replacement},run,key,body).catch(()=>null);await waiting;const result=await target.put(k,value,options);lateWriteAccepted=!!result;release();return result}return target.put(k,value,options)};const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value}})
 try{await putPrivate({...env,FILES:firstFiles},run,key,body)}catch{}finally{release?.();await second}
 return {lateWriteAccepted,retained:!!await env.FILES.head(key)}
}
