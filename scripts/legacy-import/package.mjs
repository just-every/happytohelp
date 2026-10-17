import {open,readFile,stat} from 'node:fs/promises';
import {constants,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

// The chunked package written by scripts/export-legacy.mjs: manifest.json, 4 MiB
// row chunks, the context parts native mapping reads across tables, and one file
// per attachment. Every file is checked against the manifest's size and SHA-256.
export const PACKAGE_FORMAT='happytohelp-legacy-chunks-v1';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function packageFile(root,file){if(typeof file!=='string'||!/^\w[\w.-]*$/.test(file))throw Error('Invalid package filename');return path.join(root,file);}

export async function readManifest(root,expectedSha256){
  const bytes=await readFile(path.join(root,'manifest.json')),digest=sha(bytes);
  if(expectedSha256&&digest!==expectedSha256)throw Error('Package manifest digest differs from --expect-manifest-sha256');
  const manifest=JSON.parse(bytes);
  if(manifest.format!==PACKAGE_FORMAT||!Array.isArray(manifest.chunks)||!Array.isArray(manifest.context)||!Array.isArray(manifest.objects)||!manifest.source?.rowCounts)throw Error('Invalid chunked legacy package');
  return {manifest,digest};
}

export async function readPart(root,part){
  if(!Number.isSafeInteger(part.bytes)||part.bytes<2||part.bytes>32*1024*1024)throw Error('Invalid package chunk size');
  const file=await open(packageFile(root,part.file),constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const info=await file.stat();if(!info.isFile()||info.size!==part.bytes)throw Error(`Package chunk size mismatch: ${part.file}`);
    const bytes=Buffer.alloc(part.bytes);let offset=0;
    while(offset<bytes.length){const read=await file.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)throw Error('Package chunk changed during read');offset+=read.bytesRead;}
    if(sha(bytes)!==part.sha256)throw Error(`Package chunk digest mismatch: ${part.file}`);
    const rows=JSON.parse(bytes);if(!Array.isArray(rows)||rows.length!==part.count)throw Error(`Package chunk row count mismatch: ${part.file}`);
    return rows;
  }finally{await file.close();}
}

export async function fileSha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}

/** Check every file before the first write, one chunk in memory at a time. */
export async function verifyPackage(root,manifest){
  const counts={};
  for(const part of [...manifest.chunks,...manifest.context]){const rows=await readPart(root,part);if(manifest.chunks.includes(part))counts[part.table]=(counts[part.table]||0)+rows.length;}
  for(const [table,count]of Object.entries(manifest.source.rowCounts))if((counts[table]||0)!==count)throw Error(`Package table count mismatch: ${table}`);
  for(const table of Object.keys(counts))if(!Object.hasOwn(manifest.source.rowCounts,table))throw Error(`Unexpected source table in package: ${table}`);
  if(!manifest.attachmentsComplete)throw Error('Package requires its exported attachment bytes');
  const keys=new Set(),media=new Set();
  for(const object of manifest.objects){
    if(keys.has(object.key)||media.has(String(object.mediaId))||!object.key.startsWith('legacy/')||object.key.split('/').includes('..'))throw Error('Invalid package object identity');
    keys.add(object.key);media.add(String(object.mediaId));
    const file=packageFile(root,object.file),size=(await stat(file)).size;
    if(size!==object.size||await fileSha256(file)!==object.sha256)throw Error(`Package object size or digest mismatch: ${object.file}`);
  }
  const entries=manifest.source.attachments||[];
  if(entries.length!==manifest.objects.length||entries.some(e=>!manifest.objects.some(o=>o.key===e.key&&String(o.mediaId)===String(e.mediaId))))throw Error('Package attachment manifest mismatch');
  return counts;
}
