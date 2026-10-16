import {open,realpath,writeFile} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {publishDirectory,readManifest,packageContext,copyPackageRows,safeFile} from './package.mjs';
import {s3Environment,relativeKey,mediaSize} from './attachments.mjs';

async function copyObject(entry,row,output,options,environment){
  const expected=mediaSize(row),hash=createHash('sha256');let size=0,child;
  let stream;
  if(options.directory){const root=await realpath(options.directory),target=await realpath(path.join(root,relativeKey(entry.sourceKey)));const rel=path.relative(root,target);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Attachment path escapes directory');const file=await open(target,'r');const stat=await file.stat();if(!stat.isFile()||stat.size!==expected){await file.close();throw Error('Attachment file type or size mismatch');}stream=file.createReadStream();}
  else{
    if(entry.disk!=='s3')throw Error('The public media disk requires a local directory');
    child=spawn('aws',['--no-cli-pager','--no-cli-auto-prompt','--region',options.region,'--endpoint-url',`https://s3.${options.region}.amazonaws.com`,'--cli-connect-timeout','30','--cli-read-timeout','60','s3api','get-object','--bucket',options.bucket,'--key',entry.sourceKey,'/dev/fd/3'],{env:environment,stdio:['ignore','ignore','ignore','pipe']});stream=child.stdio[3];
  }
  const completion=child?new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('S3 attachment process failed')));child.on('close',code=>code===0?resolve():reject(Error('S3 attachment read failed (diagnostics suppressed)')));}):Promise.resolve();completion.catch(()=>{});
  const timer=child?setTimeout(()=>child.kill('SIGKILL'),300000):undefined;
  try{await pipeline(stream,new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>expected)return callback(Error('Attachment exceeds declared size'));hash.update(chunk);callback(null,chunk);}}),createWriteStream(output,{flags:'wx',mode:0o600}));await completion;if(size!==expected)throw Error('Attachment byte size mismatch');const sha256=hash.digest('hex');if(row.sha256&&row.sha256!==sha256)throw Error('Attachment SHA-256 differs from media row');return {sha256,size};}
  finally{clearTimeout(timer);if(child&&child.exitCode===null)child.kill('SIGKILL');}
}
export async function attachmentsPackage(input,output,options){return publishDirectory(output,async root=>{
  const manifest=await readManifest(input),context=await packageContext(input,manifest);await copyPackageRows(input,root,manifest);
  const entries=manifest.source.attachments||[],media=new Map((context.tables.media||[]).map(r=>[String(r.id),r]));
  const env=options.directory?undefined:s3Environment(options.bucket,options.region);const objects=[];let failure;
  // Bounded concurrency keeps a single object's bytes out of the JS heap and
  // avoids serial AWS CLI startup dominating thousands of small attachments.
  let next=0;await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{for(;;){const i=next++;if(failure||i>=entries.length)return;const entry=entries[i],file=`object-${String(i).padStart(6,'0')}.bin`;try{const result=await copyObject(entry,media.get(String(entry.mediaId)),safeFile(root,file),options,env);objects[i]={key:entry.key,mediaId:entry.mediaId,file,...result};}catch(error){failure=error;return;}}}));
  if(failure)throw failure;
  const result={...manifest,objects,mediaBytes:objects.reduce((n,o)=>n+o.size,0),attachmentsComplete:true};await writeFile(path.join(root,'manifest.json'),JSON.stringify(result),{mode:0o600,flag:'wx'});return result;
});}
