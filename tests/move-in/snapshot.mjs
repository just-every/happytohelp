import {DatabaseSync} from 'node:sqlite';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {validateSearchIndex,markSearchShadows} from '../helpers/search-index.mjs';
const probes=new WeakMap();
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const scalar=value=>typeof value==='bigint'?{sqliteInteger:value.toString()}:value instanceof Uint8Array?{sqliteBlob:Buffer.from(value).toString('hex')}:value;
/** Caller awaits all Worker/Queue work before this consistent WAL snapshot.
 * FTS integrity validation requires its SQL command door; it changes no rows.
 * Raw snapshots still include protected D1 metadata and SQLite's own tables. */
export async function snapshotDatabase(directory,api){
 const files=await readdir(join(directory,'state'),{recursive:true});let native;
 for(const file of files.filter(name=>name.endsWith('.sqlite'))){const candidate=new DatabaseSync(join(directory,'state',file),{readOnly:false});if(candidate.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects'").get()){native=candidate;break}candidate.close()}
 if(!native)throw new Error('Native D1 persistence file not found');
 try{const tables=native.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all(),result={};let protectedTables=probes.get(api);if(!protectedTables){protectedTables=[];for(const {name} of tables){
  // Probe actual API access, recording exact platform refusal instead of omitting
  // a prefix. Row contents always come from the same underlying native snapshot.
  try{await api.prepare(`SELECT * FROM ${quote(name)} LIMIT 1`).all()}catch(error){protectedTables.push({name,refusal:String(error.message)})}}probes.set(api,protectedTables)}
 native.exec('BEGIN');const searchShadows=validateSearchIndex(native);for(const {name} of tables){
  const columns=native.prepare(`PRAGMA table_info(${quote(name)})`).all().map(row=>quote(row.name)),statement=native.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${columns.join(',')}`);statement.setReadBigInts(true);result[name]=statement.all().map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,scalar(value)])));
 }
 native.exec('COMMIT');markSearchShadows(result,searchShadows);return {tables:result,protectedTables};
 }finally{native.close()}
}
