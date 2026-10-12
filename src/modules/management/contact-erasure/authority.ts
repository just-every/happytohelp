import type {Env} from '../../../platform/env'
import {authority} from '../../move-in/context'
/** Carry the route's authenticated session through every irreversible stage.
 * Native SQL checks current authority before and after the same atomic batch. */
export function erasureEnvironment(env:Env,projectId:string,actorId:string,sessionHash:string):Env {
 const predicate=authority({project_id:projectId,actor_id:actorId,session_hash:sessionHash})
 const guard=()=>env.DB.prepare(`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN (${predicate.sql}) THEN 1 ELSE 0 END`).bind(...predicate.params!)
 const check=async()=>{const row=await env.DB.prepare(`SELECT (${predicate.sql}) allowed`).bind(...predicate.params!).first<{allowed:number}>();if(!row?.allowed)throw new Error('erasure_authority_revoked')}
 return {...env,DB:new Proxy(env.DB,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{const result=await target.batch([guard(),...statements,guard(),target.prepare('DELETE FROM ik_d1_assertions')]);return result.slice(1,-2)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}}),FILES:new Proxy(env.FILES,{get(target,key){if(key==='delete')return async(keys:string|string[])=>{await check();return target.delete(keys)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})}
}
