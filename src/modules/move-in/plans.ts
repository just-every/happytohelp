import {putPrivate} from './private-custody'
import {Buffer} from 'node:buffer'
import type {Env} from '../../platform/env'
import {planD1Import,canonicalJson,sha256,type SourceBundle} from '../import-kit/src/d1/index'
import {importContext} from './context'
import {nativeStatementCount} from './targets'
import {publicationContact,type PublicationContact} from './publication'
import {objectKey,updateRun} from './run-store'
import {LIMITS,MAPPING_VERSION,recordKey,type Run,type PreparedMapping} from './types'
export interface ChildPlan {ordinal:number;key:string;fingerprint:string;total:number;bytes:number}
export interface ReviewManifest {version:1;projectId:string;actorId:string;vendor:string;mappingVersion:string;batches:ChildPlan[];contacts?:PublicationContact[];original:{key:string;sha256:string;size:number};artifacts:{key:string;sha256:string;size:number}[];diagnostics:any[];fingerprint:string}
export function reviewFingerprint(manifest:Omit<ReviewManifest,'fingerprint'>|ReviewManifest){const {fingerprint:_,...content}=manifest as ReviewManifest;return sha256(canonicalJson(content))}
/** One review binds all ordered child plans. A child owns a bounded set of
 * source decisions; exact original file custody remains in the reviewed group R2 manifest. */
export async function retainReview(env:Env,run:Run,source:SourceBundle,prepared:PreparedMapping,duplicates:number){
 const batches:ChildPlan[]=[],contacts:PublicationContact[]=[],decisions:any[]=[],diagnostics=[...source.diagnostics],counts:any={input:0,unique:0,duplicates:0,mapped:0,unmapped:0,rejected:0,effects:0,byKind:{}}
 const map=(record:any)=>{const key=recordKey(record);return {effects:prepared.rejections.has(key)?[]:prepared.effects.get(key)??[],...(prepared.rejections.has(key)?{rejection:prepared.rejections.get(key)}:{}),unmapped:(prepared.omissions.get(key)??[]).map(reason=>({reason}))}}
 let cursor=0
 do{if(batches.length>=LIMITS.planChildren)throw new Error('review_partition_limit');const records:typeof source.records=[];let size=0,nativeTotal=0
  while(cursor<source.records.length&&records.length<LIMITS.planBatch){const record=source.records[cursor],nativeStatements=map(record).effects.reduce((n,effect)=>n+nativeStatementCount(effect.targetKind,effect.value as any),0),cost=Buffer.byteLength(canonicalJson(record))*2+Buffer.byteLength(canonicalJson(map(record)))+2048;if(cost>LIMITS.planContentBytes)throw new Error('record_review_size_limit');if(records.length&&(size+cost>LIMITS.planContentBytes||nativeTotal+nativeStatements>LIMITS.nativeStatements||nativeStatements>40))break;records.push(record);size+=cost;nativeTotal+=nativeStatements;cursor++;if(nativeStatements>40)break}
  const plan=await planD1Import({records,artifacts:source.artifacts,diagnostics:[]},{version:MAPPING_VERSION,map},importContext(env,run)),body=canonicalJson(plan),bytes=Buffer.byteLength(body);if(bytes>LIMITS.planBytes)throw new Error('review_plan_size_limit')
  const child={ordinal:batches.length,key:objectKey(run,`plans/${plan.fingerprint}`),fingerprint:plan.fingerprint,total:plan.entries.length,bytes};await putPrivate(env,run,child.key,body,{httpMetadata:{contentType:'application/json'}});batches.push(child)
  for(const key of Object.keys(counts).filter(key=>key!=='byKind'))counts[key]+=plan.counts[key as keyof typeof plan.counts] as number
  for(const [kind,n] of Object.entries(plan.counts.byKind))counts.byKind[kind]=(counts.byKind[kind]??0)+n
  diagnostics.push(...plan.diagnostics.filter(d=>d.code!=='ORIGINAL_UNAVAILABLE')); decisions.push(...plan.entries.map(e=>({kind:e.source.kind,sourceId:e.source.sourceId,location:e.source.location,rejection:e.rejection,omissions:e.unmapped,targets:e.effects.map(effect=>({kind:effect.targetKind,id:effect.targetId,status:(effect.value as any).tables.knowledge_articles?.[0]?.status}))})))
  for(const entry of plan.entries)for(const effect of entry.effects)if(effect.targetKind==='contact')contacts.push(publicationContact(run.project_id,effect.targetId,effect.value))
 }while(cursor<source.records.length)
 // A malformed physical position is an input/rejection, but has no source ID,
 // kit journal entry or fabricated native effect. Keep unique as the number of
 // identified source decisions processed by the resumable apply cursor.
 const invalid=source.diagnostics.filter(d=>d.kind==='invalid-record')
 counts.input+=invalid.length+duplicates;counts.duplicates+=duplicates;counts.rejected+=invalid.length
 if(invalid.length)counts.byKind['invalid-record']=invalid.length
 decisions.push(...invalid.map(d=>({kind:'invalid-record',location:d.location,rejection:d.code,omissions:[],targets:[]})))
 const manifest:ReviewManifest={version:1,projectId:run.project_id,actorId:run.actor_id,vendor:run.vendor,mappingVersion:MAPPING_VERSION,batches,contacts,original:{key:run.object_key,sha256:run.artifact_hash,size:run.bytes},artifacts:JSON.parse(run.files_json).map((file:any)=>({key:file.key,sha256:file.sha256,size:file.size})),diagnostics:source.diagnostics,fingerprint:''};manifest.fingerprint=reviewFingerprint(manifest)
 const key=objectKey(run,`review/${manifest.fingerprint}`);await putPrivate(env,run,key,canonicalJson(manifest),{httpMetadata:{contentType:'application/json'}})
 await updateRun(env,run,{state:'ready',review_fingerprint:manifest.fingerprint,total:counts.unique,plan_json:JSON.stringify({fingerprint:manifest.fingerprint,counts,duplicateRecords:duplicates,diagnostics,decisions}),cursor:0})
}
