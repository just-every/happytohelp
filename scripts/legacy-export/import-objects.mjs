import {open,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';

const partBytes=8*1024*1024;
// Local imports own the legacy object namespace for the entire apply. R2
// multipart completion has no conditional-write option, so parallel applies to
// the same persistence directory must be excluded before any writes begin.
export async function withImportLock(directory,apply){
  await mkdir(directory,{recursive:true});
  const filename=path.join(path.resolve(directory),'.legacy-import.lock');let lock;
  try{lock=await open(filename,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Another legacy import holds the local persistence lock; finish it before applying again');throw e;}
  try{await lock.writeFile(String(process.pid));return await apply();}
  finally{await lock.close();await unlink(filename);}
}

export async function putObject(bucket,filename,object,runId){
  const file=await open(filename,'r');let upload;
  const options={customMetadata:{sha256:object.sha256,legacyImport:runId}};
  try{
    const parts=Math.ceil(object.size/partBytes);
    if(parts>10000)throw Error('Attachment exceeds the multipart part limit');
    // Buffers are bounded even across the local binding RPC, which buffers Blob
    // values and rejects an ordinary Node stream without a known runtime length.
    if(parts<=1){const bytes=Buffer.alloc(object.size);await readExact(file,bytes,0);const stored=await bucket.put(object.key,bytes,{...options,onlyIf:{etagDoesNotMatch:'*'}});if(!stored)throw Error('Concurrent R2 object write');return;}
    upload=await bucket.createMultipartUpload(object.key,options);const completed=[];
    for(let offset=0,index=1;offset<object.size;offset+=partBytes,index++){
      const bytes=Buffer.alloc(Math.min(partBytes,object.size-offset));await readExact(file,bytes,offset);
      completed.push(await upload.uploadPart(index,bytes));
    }
    await upload.complete(completed);upload=undefined;
  }finally{if(upload)await upload.abort();await file.close();}
}
async function readExact(file,bytes,position){
  let n=0;while(n<bytes.length){const read=await file.read(bytes,n,bytes.length-n,position+n);if(!read.bytesRead)throw Error('Attachment changed during import');n+=read.bytesRead;}
}
