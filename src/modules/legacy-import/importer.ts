import type { Env } from '../../platform/env'
import { type LegacyBundle,type Row,type MappedRow,stable,digest,text } from './types'
import {mapLegacy,tableOrder} from './mapping'
const sqlName=(value:string)=>{if(!/^[a-z][a-z0-9_]*$/.test(value))throw new Error('Unsafe table or column name');return '"'+value+'"'}
export async function planImport(bundle:LegacyBundle){
 if(bundle.format!=='happytohelp-legacy-v1'||!bundle.tables||!bundle.source?.revision||!bundle.source.repository||!Number.isFinite(Date.parse(bundle.source.exportedAt)))throw new Error('Invalid legacy bundle provenance')
 const bundleDigest=await digest(stable(bundle)),rows=[]
 for(const table of Object.keys(bundle.tables).sort((a,b)=>{const ia=tableOrder.indexOf(a),ib=tableOrder.indexOf(b);return (ia<0?1000:ia)-(ib<0?1000:ib)||a.localeCompare(b)})){
 if(!Array.isArray(bundle.tables[table]))throw new Error(`Expected row array for ${table}`)
 let sourceRows=[...bundle.tables[table]]
 if(table==='categories'||table==='knowledge_categories'){const depth=(r:Row,seen=new Set<string>()):number=>{if(!r.parent_id)return 0;const key=String(r.id);if(seen.has(key))throw new Error('Category parent cycle');seen.add(key);const parent=sourceRows.find(p=>String(p.id)===String(r.parent_id));return parent?1+depth(parent,seen):1};sourceRows.sort((a,b)=>depth(a)-depth(b))}
 const seen=new Set<string>();for(const row of sourceRows){if(!row||Array.isArray(row)||typeof row!=='object')throw new Error(`Invalid ${table} row`);const rowDigest=await digest(stable(row)),sourceId=String(row.id??row.event_id??row.token_hash??rowDigest);if(seen.has(sourceId))throw new Error(`Duplicate source identity ${table}:${sourceId}`);seen.add(sourceId);rows.push({table,sourceId,row,rowDigest,mapped:mapLegacy(table,row,bundle)})}
 }
 const mappedRows=rows.flatMap(row=>row.mapped);const conversationScopes=new Map(mappedRows.filter(m=>m.table==='conversations').map(m=>[String(m.row.id),m.row]));const contacts=new Map(mappedRows.filter(m=>m.table==='contacts').map(m=>[String(m.row.id),m.row]));for(const mapped of mappedRows){const r=mapped.row;if(r.conversation_id&&r.project_id){const conv=conversationScopes.get(String(r.conversation_id));if(conv&&conv.project_id!==r.project_id)throw new Error(`Cross-project legacy reference in ${mapped.table}:${r.id}`)}if(mapped.table==='conversations'){const contact=contacts.get(String(r.contact_id));if(contact&&contact.project_id!==r.project_id)throw new Error(`Cross-project legacy conversation contact: ${r.id}`)}}
 const keys=new Set<string>();for(const object of bundle.objects||[]){if(!object.key||object.key.startsWith('/')||object.key.split('/').includes('..')||keys.has(object.key))throw new Error('Invalid or duplicate object key');keys.add(object.key);const bytes=Uint8Array.from(atob(object.dataBase64),c=>c.charCodeAt(0));if(await digest(bytes)!==object.sha256)throw new Error(`Object digest mismatch: ${object.key}`)}
 const mediaRows=rows.flatMap(row=>row.mapped.filter(m=>m.table==='media'));for(const media of mediaRows){if(!keys.has(String(media.row.object_key)))throw new Error(`Media ${media.row.id} requires exported bytes for ${media.row.object_key}`)}
 return {id:`legacy:${bundleDigest}`,bundleDigest,source:bundle.source,rows,objects:bundle.objects||[],summary:{sourceRows:rows.length,mappedRows:rows.reduce((n,r)=>n+r.mapped.length,0),archivedOnly:rows.filter(r=>!r.mapped.length).map(r=>`${r.table}:${r.sourceId}`),holds:rows.flatMap(r=>r.mapped.filter(m=>m.hold).map(m=>`${r.table}:${r.sourceId}: ${m.hold}`)),objects:keys.size}}
}
export async function importLegacy(env:Pick<Env,'DB'|'FILES'>,bundle:LegacyBundle){
 const plan=await planImport(bundle),existing=await env.DB.prepare('SELECT id,bundle_digest,state FROM legacy_import_runs WHERE id=?').bind(plan.id).first<{id:string;bundle_digest:string;state:string}>();if(existing&&existing.bundle_digest!==plan.bundleDigest)throw new Error('Import digest conflict')
 await env.DB.prepare("INSERT OR IGNORE INTO legacy_import_runs VALUES(?,?,?,'running',?,NULL)").bind(plan.id,stable(plan.source),plan.bundleDigest,Date.now()).run()
 const schemas=new Map<string,Set<string>>();let applied=0,replayed=0
 for(const object of plan.objects){const bytes=Uint8Array.from(atob(object.dataBase64),c=>c.charCodeAt(0)),current=await env.FILES.get(object.key);if(current&&await digest(new Uint8Array(await current.arrayBuffer()))!==object.sha256)throw new Error(`Existing R2 object differs: ${object.key}`);if(!current){const stored=await env.FILES.put(object.key,bytes,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{sha256:object.sha256,legacyImport:plan.id}});if(!stored){const raced=await env.FILES.get(object.key);if(!raced||await digest(new Uint8Array(await raced.arrayBuffer()))!==object.sha256)throw new Error(`Concurrent R2 object conflict: ${object.key}`)}};await env.DB.prepare('INSERT OR IGNORE INTO legacy_import_objects VALUES(?,?,?,?)').bind(plan.id,object.key,object.sha256,bytes.length).run()}
 for(const source of plan.rows){const prior=await env.DB.prepare('SELECT row_digest FROM legacy_import_rows WHERE run_id=? AND source_table=? AND source_id=?').bind(plan.id,source.table,source.sourceId).first<{row_digest:string}>();if(prior){if(prior.row_digest!==source.rowDigest)throw new Error('Source row replay differs');replayed++;continue}
 const statements:D1PreparedStatement[]=[]
 for(const mapped of source.mapped){if(!schemas.has(mapped.table)){const schema=await env.DB.prepare(`PRAGMA table_info(${sqlName(mapped.table)})`).all<{name:string}>();if(!schema.results.length)throw new Error(`Target migration missing: ${mapped.table}`);schemas.set(mapped.table,new Set(schema.results.map(c=>c.name)))}
 const row=Object.fromEntries(Object.entries(mapped.row).filter(([key,value])=>schemas.get(mapped.table)!.has(key)&&value!==undefined).map(([key,value])=>[key,typeof value==='object'&&value!==null?stable(value):value]))
 for(const key of mapped.key)text(row[key],`${mapped.table}.${key}`)
 const predicate=mapped.key.map(k=>`${sqlName(k)} IS ?`).join(' AND '),keyValues=mapped.key.map(k=>row[k]);const current=await env.DB.prepare(`SELECT * FROM ${sqlName(mapped.table)} WHERE ${predicate}`).bind(...keyValues).first<Row>()
 if(current){for(const [key,value]of Object.entries(row))if(current[key]!==value)throw new Error(`Existing data conflict ${mapped.table}:${keyValues.join(':')} column ${key}; no rows overwritten`)}
 else{const names=Object.keys(row);statements.push(env.DB.prepare(`INSERT INTO ${sqlName(mapped.table)} (${names.map(sqlName).join(',')}) VALUES(${names.map(()=>'?').join(',')})`).bind(...names.map(k=>row[k])))}
 if(mapped.hold)statements.push(env.DB.prepare('INSERT OR IGNORE INTO legacy_import_holds VALUES(?,?,?,?,?,NULL)').bind(`${plan.id}:${source.table}:${source.sourceId}`,plan.id,source.table,source.sourceId,mapped.hold))
 }
 if(source.table==='conversations'&&source.mapped.some(m=>m.table==='conversations')){const mapped=source.mapped.find(m=>m.table==='conversations')!;statements.push(env.DB.prepare('INSERT OR IGNORE INTO reporting_legacy_conversations(project_id,conversation_id,run_id) VALUES(?,?,?)').bind(mapped.row.project_id,mapped.row.id,plan.id))}
 statements.push(env.DB.prepare('INSERT INTO legacy_import_rows VALUES(?,?,?,?,?,?,?,?)').bind(plan.id,source.table,source.sourceId,source.rowDigest,stable(source.row),source.mapped.map(m=>m.table).join(',')||null,source.mapped.map(m=>m.key.map(k=>m.row[k]).join(':')).join(',')||null,source.mapped.length?'mapped':'archived_only'))
 await env.DB.batch(statements);applied++
 }
 await env.DB.prepare("UPDATE legacy_import_runs SET state='complete',completed_at=? WHERE id=?").bind(Date.now(),plan.id).run();return {id:plan.id,...plan.summary,applied,replayed}
}
