import {validateDestination} from '../../vendor/base/modules/integrations/core/destination.ts'
import type {WireRequest,WireResponse} from '../../vendor/base/modules/integrations/core/types.ts'

/** Edition override, owner decision 2026-10-09: ordinary platform HTTPS fetch.
 * This implements Base's wire shape, not its DNS-pinning security guarantee.
 * CONTRACT.md defines the narrower destination, redirect and resource policy. */
export const httpsTransport={
 async send(wire:WireRequest):Promise<WireResponse>{
  validateDestination(wire.url)
  if(new TextEncoder().encode(wire.body).byteLength>1048576)throw Error('request_size_exceeded')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000)
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
  try{
   const response=await fetch(wire.url,{method:'POST',headers:wire.headers,body:wire.body,redirect:'manual',signal:controller.signal})
   if(response.status>=300&&response.status<400){await response.body?.cancel();throw Error('redirect_refused')}
   const length=response.headers.get('content-length')
   if(length!==null&&Number(length)>65536){await response.body?.cancel();throw Error('response_size_exceeded')}
   reader=response.body?.getReader()
   const chunks:Uint8Array[]=[];let size=0
   if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error('response_size_exceeded');chunks.push(value)}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   return {status:response.status,headers:Object.fromEntries(response.headers),body:new TextDecoder().decode(bytes)}
  }finally{clearTimeout(timer);if(reader){await reader.cancel().catch(()=>{});reader.releaseLock()}}
 }
}
