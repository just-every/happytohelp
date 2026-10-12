import type {Env} from '../../platform/env'
import {objectKey} from './run-store'
import {putPrivate} from './private-custody'
import type {Run} from './types'
const WIDTH=16
/** Sorted fixed-width digest prefixes: membership by merge, never a parsed set. */
function encode(digests:Iterable<string>){
 const prefixes=[...new Set([...digests].map(digest=>digest.slice(0,WIDTH*2)))].sort(),bytes=new Uint8Array(prefixes.length*WIDTH)
 prefixes.forEach((prefix,row)=>{for(let i=0;i<WIDTH;i++)bytes[row*WIDTH+i]=parseInt(prefix.slice(i*2,i*2+2),16)})
 return bytes
}
function compare(a:Uint8Array,i:number,b:Uint8Array,j:number){for(let k=0;k<WIDTH;k++){const d=a[i*WIDTH+k]-b[j*WIDTH+k];if(d)return d}return 0}
function intersects(a:Uint8Array,b:Uint8Array){
 for(let i=0,j=0;i<a.length/WIDTH&&j<b.length/WIDTH;){const d=compare(a,i,b,j);if(!d)return true;if(d<0)i++;else j++}
 return false
}
const indexKey=(run:Pick<Run,'project_id'|'id'>)=>objectKey(run as Run,'uninterpreted-identities')
export async function putUninterpretedIndex(env:Env,run:Run,digests:string[]){
 await putPrivate(env,run,indexKey(run),encode(digests),{httpMetadata:{contentType:'application/octet-stream'}})
}
/** Incomplete runs whose stored index holds no erased digest. A run without an
 * index (older custody, or an upload interrupted before its index was stored)
 * stays conservatively in scope, as does any run not listed here. */
export async function clearedIncompleteRuns(env:Env,projectId:string){
 const erased:string[]=[];let after=''
 for(;;){const rows=(await env.DB.prepare('SELECT digest FROM move_in_erased_identities WHERE project_id=? AND digest>? ORDER BY digest LIMIT 5000').bind(projectId,after).all<{digest:string}>()).results;if(!rows.length)break;erased.push(...rows.map(row=>row.digest));after=rows.at(-1)!.digest}
 const fence=encode(erased),cleared:string[]=[];after=''
 for(;;){const runs=(await env.DB.prepare("SELECT id,project_id FROM move_in_runs WHERE project_id=? AND identity_complete=0 AND state<>'erased' AND id>? ORDER BY id LIMIT 10").bind(projectId,after).all<{id:string;project_id:string}>()).results;if(!runs.length)break
  for(const run of runs){const index=await env.FILES.get(indexKey(run));if(index&&!intersects(fence,new Uint8Array(await index.arrayBuffer())))cleared.push(run.id)}
  after=runs.at(-1)!.id
 }
 return cleared
}
