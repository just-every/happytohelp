import type {Env} from '../../platform/env'
import type {Run} from './types'
import {assertAuthority} from './context'
/** An opaque unique nonce reserves the exact key before content is written. Erasure can
 * delete either the placeholder or content; an in-flight conditional replacement
 * cannot recreate deleted content, even if the writer crashes before its check. */
export async function putPrivate(env:Env,run:Run,key:string,body:string|Uint8Array,options:R2PutOptions={}){
 const prior=await env.FILES.head(key),reservation=prior??await env.FILES.put(key,crypto.randomUUID(),{onlyIf:{etagDoesNotMatch:'*'}})
 if(!reservation)throw new Error('source_custody_race')
 try{
  await assertAuthority(env,run)
  const written=await env.FILES.put(key,body,{...options,onlyIf:{etagMatches:reservation.etag}})
  if(!written)throw new Error('source_custody_erased')
  await assertAuthority(env,run)
 }catch(error){
  // A conditional-write loser does not own the winner's bytes. Only erasure
  // authorizes deleting whatever currently occupies the group's private key.
  const erased=await env.DB.prepare("SELECT 1 FROM move_in_runs WHERE id=? AND state='erased'").bind(run.id).first()
  if(erased)await env.FILES.delete(key)
  throw error
 }
}
