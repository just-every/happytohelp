import {createReadStream} from 'node:fs';
import {putObject} from './import-objects.mjs';
import {stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readManifest,readPart,packageContext,safeFile,sha} from './package.mjs';
import {skippedTables} from './scope.mjs';
import {classifySnapshot} from './secrets.mjs';

async function fileHash(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
async function bodyHash(body){const h=createHash('sha256');for await(const chunk of body)h.update(chunk);return h.digest('hex');}
/** Validate the entire package before the first write; then bounded row imports. */
export async function importPackage(root,env,{planImport,importLegacy,tableOrder}){
  const manifest=await readManifest(root);
  const context=await packageContext(root,manifest),counts={},keys=new Set(),media=new Map((context.tables.media||[]).map(r=>[String(r.id),r]));
  if(!manifest.attachmentsComplete)throw Error('Package requires exported attachment bytes');
  for(const object of manifest.objects){if(keys.has(object.key)||!media.has(String(object.mediaId)))throw Error('Invalid package object identity');keys.add(object.key);const file=safeFile(root,object.file),size=(await stat(file)).size;if(size!==object.size||size!==Number(media.get(String(object.mediaId)).size)||await fileHash(file)!==object.sha256)throw Error('Package object size or digest mismatch');}
  const entries=manifest.source.attachments||[];if(entries.length!==manifest.objects.length||entries.some(e=>!manifest.objects.some(o=>o.key===e.key&&String(o.mediaId)===String(e.mediaId))))throw Error('Package attachment manifest mismatch');
  for(const part of manifest.chunks){if(skippedTables.includes(part.table)||!Object.hasOwn(manifest.source.rowCounts,part.table))throw Error('Unexpected source table in package');const rows=await readPart(root,part);if(rows.length!==part.count)throw Error('Package row count mismatch');counts[part.table]=(counts[part.table]||0)+rows.length;classifySnapshot({tables:{[part.table]:rows}});}
  for(const table of Object.keys(counts))if(counts[table]!==manifest.source.rowCounts[table])throw Error('Package table count mismatch');
  for(const [table,n]of Object.entries(manifest.source.rowCounts))if((counts[table]||0)!==n)throw Error('Package table count mismatch');
  const packageId=sha(JSON.stringify(manifest));const options={context,objectKeys:keys};let sourceRows=0,mappedRows=0,applied=0,replayed=0;
  const chunks=[...manifest.chunks].sort((a,b)=>tableOrder.indexOf(a.table)-tableOrder.indexOf(b.table));
  // Object writes use streams, so aggregate or individual media size never
  // controls the row chunk's heap size or a JSON request limit.
  const runId=`legacy-package:${packageId}`;
  if(env)await env.DB.prepare("INSERT OR IGNORE INTO legacy_import_runs VALUES(?,?,?,'running',?,NULL)").bind(runId,JSON.stringify(manifest.source),packageId,Date.now()).run();
  if(env)for(const object of manifest.objects){const current=await env.FILES.get(object.key);if(current){if(current.size!==object.size||await bodyHash(current.body)!==object.sha256)throw Error('Existing R2 object differs');}else{await putObject(env.FILES,safeFile(root,object.file),object,runId);const verified=await env.FILES.get(object.key);if(!verified||verified.size!==object.size||await bodyHash(verified.body)!==object.sha256)throw Error('Imported R2 object digest mismatch');}await env.DB.prepare('INSERT OR IGNORE INTO legacy_import_objects VALUES(?,?,?,?)').bind(runId,object.key,object.sha256,object.size).run();}
  for(const [index,part]of chunks.entries()){
    const rows=await readPart(root,part);const bundle={format:'happytohelp-legacy-v1',source:{...manifest.source,packageId,chunk:index,chunkDigest:part.sha256},tables:{[part.table]:rows}};
    const result=env?await importLegacy(env,bundle,options):(await planImport(bundle,options)).summary;
    sourceRows+=result.sourceRows;mappedRows+=result.mappedRows;applied+=result.applied||0;replayed+=result.replayed||0;
  }
  if(env)await env.DB.prepare("UPDATE legacy_import_runs SET state='complete',completed_at=? WHERE id=?").bind(Date.now(),runId).run();
  return {id:runId,sourceRows,mappedRows,objects:keys.size,mediaBytes:manifest.mediaBytes,applied,replayed};
}
