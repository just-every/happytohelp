import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {assertUnchangedTable} from './equality.mjs';
export async function retainComparison(before,after,label){
 if(!process.env.H2H_EVIDENCE_DIR)return;
 const directory=join(process.env.H2H_EVIDENCE_DIR,'complete-table-comparisons');await mkdir(directory,{recursive:true});
 const values={before:JSON.stringify(before),after:JSON.stringify(after)},id=createHash('sha256').update(values.before+values.after).digest('hex').slice(0,16),paths={};
 for(const [phase,content] of Object.entries(values)){paths[phase]=join(directory,`${label}-${id}-${phase}.json.gz`);await writeFile(paths[phase],gzipSync(content))}return paths;
}
export async function unchanged(h,before,label){const after=await h.snapshot();assert.deepEqual(Object.keys(after),Object.keys(before));let sequence;for(const table of Object.keys(before)){const delta=assertUnchangedTable(table,before[table],after[table]);if(delta)sequence=delta}console.log(JSON.stringify({proof:label,completeTables:Object.keys(after).length,sequence,literalEquality:sequence?.delta==='0'?'FULFILLED':'UNFULFILLED',applicationEquality:'FULFILLED',snapshots:await retainComparison(before,after,label)}));}
