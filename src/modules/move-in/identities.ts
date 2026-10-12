import {sha256,canonicalJson} from '../import-kit/src/provenance/identity'
import type {Env} from '../../platform/env'
import {sourceId} from './readers/common'
import {LIMITS,type Vendor} from './types'
import {indexUpload} from './readers/identity-index'
import {AdmissionError} from './readers/admission-error'
export interface IdentityLink {digest:string;source:string}
export const identityDigest=(project:string,kind:string,value:string)=>sha256(canonicalJson(['move-in-erasure',project,kind,value]))
export const sourceDigest=(project:string,vendor:Vendor,value:string)=>identityDigest(project,`source:${vendor}`,value)
export function contactDigests(project:string,contact:{email?:unknown;external_id?:unknown;metadata_json?:string|null}){
 let metadata:any={};try{metadata=JSON.parse(contact.metadata_json||'{}')}catch{}
 const values=[contact.email,metadata.provided_email].filter((value):value is string=>typeof value==='string'&&!!value.trim()).map(value=>identityDigest(project,'email',value.trim().toLowerCase()))
 if(typeof contact.external_id==='string'&&contact.external_id)values.push(identityDigest(project,'external',contact.external_id))
 return [...new Set(values)]
}
/** Index only identity hashes, before raw custody is admitted. This includes
 * rejected and not-yet-reviewed records, and never depends on native origins. */
export async function uploadIdentities(project:string,vendor:Vendor,name:string,bytes:Uint8Array):Promise<{links:IdentityLink[];complete:boolean;uninterpreted:string[]}>{
 const links=new Map<string,IdentityLink>(),retained:unknown[]=[];let hashes=0,aliasComplete=true
 const complete=await indexUpload(vendor,name,bytes,(people,references,location,uninterpreted)=>{
  retained.push(...uninterpreted)
  const refuse=(code:string):never=>{throw new AdmissionError(code,location.artifact,location.row,location.pointer)}
  const digest=(kind:string,value:string)=>{if(++hashes>LIMITS.identityHashes)refuse('upload_identity_hash_limit');return identityDigest(project,kind,value)}
  const add=(source:string,value=source)=>{const key=`${source}/${value}`;if(!links.has(key)&&links.size>=LIMITS.identityLinks)refuse('upload_identity_link_limit');links.set(key,{source,digest:value})}
  const ref=(id:unknown)=>{let value:string;try{value=sourceId(id,vendor)}catch{aliasComplete=false;retained.push(id);return null}const hash=digest(`source:${vendor}`,value);add(hash);return {hash,value}}
  for(const reference of references)ref(reference)
  for(const person of people){const source=ref(person.id)
   if(typeof person.email==='string'&&person.email.trim()){const email=digest('email',person.email.trim().toLowerCase());add(source?.hash??email,email)}
   if(typeof person.external_id==='string'&&person.external_id){const external=digest('external',person.external_id);add(source?.hash??external,external)}
   if(source)add(source.hash,digest('external',`import:${vendor}:${source.value}`))
  }
 })
 const whole=complete&&aliasComplete
 return {links:[...links.values()],complete:whole,uninterpreted:whole?[]:uninterpretedDigests(project,vendor,retained)}
}
/** Retained source content the readers do not interpret (opaque, unsupported and
 * malformed fields, unknown record kinds, invalid IDs) is never mapped, yet an
 * erased contact's address or ID can sit there whole. Every key and scalar in it
 * is digested as each identity kind erasure compares, so an incomplete run is
 * erased only for an exact erased value, never because another person was erased. */
function uninterpretedDigests(project:string,vendor:Vendor,values:unknown[]){
 const strings=new Set<string>(),numbers=new Set<number>(),stack=[...values]
 while(stack.length){const value=stack.pop()
  if(typeof value==='string')strings.add(value)
  else if(typeof value==='number')numbers.add(value)
  else if(Array.isArray(value))for(const item of value)stack.push(item)
  else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){strings.add(key);stack.push(child)}
 }
 const digests=new Set<string>(),source=(value:unknown)=>{try{digests.add(sourceDigest(project,vendor,sourceId(value,vendor)))}catch{}}
 for(const value of strings){if(value.trim())digests.add(identityDigest(project,'email',value.trim().toLowerCase()));if(value)digests.add(identityDigest(project,'external',value));source(value)}
 for(const value of numbers)source(value)
 return [...digests]
}

export async function erasedUpload(env:Env,project:string,links:IdentityLink[]){
 for(let start=0;start<links.length;start+=500){const row=await env.DB.prepare('SELECT 1 found FROM json_each(?2) x JOIN move_in_erased_identities e ON e.project_id=?1 AND e.digest=json_extract(x.value,\'$.digest\') LIMIT 1').bind(project,JSON.stringify(links.slice(start,start+500))).first();if(row)return true}
 return false
}
export function identityStatements(env:Env,project:string,runId:string,links:IdentityLink[]){
 const statements:D1PreparedStatement[]=[]
 for(let start=0;start<links.length;start+=500){const data=JSON.stringify(links.slice(start,start+500));statements.push(env.DB.prepare(`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(?2) x JOIN move_in_erased_identities e ON e.project_id=?1 AND e.digest=json_extract(x.value,'$.digest')) THEN 1 ELSE 0 END`).bind(project,data),env.DB.prepare(`INSERT OR IGNORE INTO move_in_identity_links(project_id,run_id,digest,source_digest) SELECT ?1,?2,json_extract(value,'$.digest'),json_extract(value,'$.source') FROM json_each(?3)`).bind(project,runId,data),env.DB.prepare(`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(?2) x JOIN move_in_erased_identities e ON e.project_id=?1 AND e.digest=json_extract(x.value,'$.digest')) THEN 1 ELSE 0 END`).bind(project,data))}
 return statements
}
