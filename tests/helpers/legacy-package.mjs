import {mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
// Tables native mapping reads across rows, as the exporter's context parts carry them.
const contextTables=['projects','users','ais','ai_defaults','contacts','conversations','messages','mediables','datasets','dataset_files','media']

/** Write a legacy bundle in the exporter's chunked package format: `rowsPerChunk`
 * rows per chunk, context parts, and one file per attachment. */
export async function writeLegacyPackage(root,bundle,{rowsPerChunk=2}={}){
 await mkdir(root,{recursive:true})
 const chunks=[],context=[],objects=[],write=async(file,rows,table,list)=>{const bytes=JSON.stringify(rows);await writeFile(join(root,file),bytes);list.push({table,count:rows.length,file,bytes:Buffer.byteLength(bytes),sha256:sha(bytes)})}
 for(const [table,rows] of Object.entries(bundle.tables))for(let i=0;i<rows.length;i+=rowsPerChunk)await write(`rows-${String(chunks.length).padStart(6,'0')}.json`,rows.slice(i,i+rowsPerChunk),table,chunks)
 for(const table of contextTables)if(bundle.tables[table]?.length)await write(`context-${String(context.length).padStart(6,'0')}.json`,bundle.tables[table],table,context)
 for(const object of bundle.objects||[]){const bytes=Buffer.from(object.dataBase64,'base64'),media=bundle.tables.media.find(row=>row.object_key===object.key),file=`object-${String(objects.length).padStart(6,'0')}.bin`;await writeFile(join(root,file),bytes);objects.push({key:object.key,mediaId:media.id,file,sha256:sha(bytes),size:bytes.length})}
 const rowCounts=Object.fromEntries(Object.entries(bundle.tables).map(([table,rows])=>[table,rows.length]))
 const manifest={format:'happytohelp-legacy-chunks-v1',source:{...bundle.source,rowCounts,attachments:objects.map(o=>({key:o.key,mediaId:o.mediaId}))},chunks,context,objects,mediaBytes:objects.reduce((n,o)=>n+o.size,0),attachmentsComplete:true}
 await writeFile(join(root,'manifest.json'),JSON.stringify(manifest))
 return {manifest,manifestSha256:sha(JSON.stringify(manifest))}
}
