import {createHash} from 'node:crypto'
/** Recheck the complete R2 content every batch without buffering the complete
 * upload again. The descriptor bounds both streamed bytes and the final hash. */
export async function custodyHash(body:ReadableStream<Uint8Array>,expectedBytes:number){
 const reader=body.getReader(),hash=createHash('sha256');let bytes=0,complete=false
 try{
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>expectedBytes)throw new Error('source_custody_changed');hash.update(value)}
  if(bytes!==expectedBytes)throw new Error('source_custody_changed')
  complete=true;return hash.digest('hex')
 }finally{if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock()}
}
