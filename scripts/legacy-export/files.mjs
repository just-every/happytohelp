import {open, rm, stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export const defaultJsonLimit = 512 * 1024 * 1024;
export async function readBundle(path, maxBytes = defaultJsonLimit) {
  if ((await stat(path)).size > maxBytes) throw Error('JSON input exceeds --max-json-bytes');
  const file = await open(path,'r');
  try { return JSON.parse(await file.readFile('utf8')); } finally {await file.close();}
}
export async function writeBundle(path,bundle,maxBytes=defaultJsonLimit) {
  // Never replace an earlier completed snapshot: that artifact is the resume token.
  const output=JSON.stringify(bundle)+'\n';
  if(Buffer.byteLength(output)>maxBytes)throw Error('JSON output exceeds --max-json-bytes');
  const temporary=path+'.partial-'+randomUUID();
  const file=await open(temporary,'wx',0o600);
  try {await file.writeFile(output);await file.sync();} finally {await file.close();}
  try {
    // link rather than rename supplies exclusive final publication on local filesystems.
    const {link}=await import('node:fs/promises');await link(temporary,path);
  } finally {await rm(temporary,{force:true});}
}
