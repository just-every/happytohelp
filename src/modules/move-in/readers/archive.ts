// Worker port of Beacon's bounded ZIP reader; entries remain inert source bytes.
import {AdmissionError} from './admission-error'
import {archiveEntries} from './archive-structure'
import { LIMITS } from '../types'
import {inflateRawSync} from 'node:zlib'
export interface ExportFile {name:string;bytes:Uint8Array}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^0xffffffff)>>>0}
async function inflate(bytes:Uint8Array,method:number,limit:number){
 if(method===0)return bytes.slice()
 try{
  // DecompressionStream can silently ignore bytes after a raw DEFLATE stream.
  // The native codec exposes consumed input as well as bounded output. Its
  // output allowance must be positive even for an empty directory member.
  const result=inflateRawSync(bytes,{info:true,maxOutputLength:Math.max(1,limit)}) as unknown as {buffer:Uint8Array;engine:{bytesWritten:number}}
  if(result.buffer.length>limit)throw new Error('archive_expansion_limit')
  if(result.engine.bytesWritten!==bytes.length)throw new Error('archive_integrity')
  return result.buffer
 }catch(error){
  const value=error as {code?:string;message?:string}
  throw new Error(value.code==='ERR_BUFFER_TOO_LARGE'||value.message==='archive_expansion_limit'?'archive_expansion_limit':'archive_integrity')
 }
}
export async function archiveChunk(name:string,bytes:Uint8Array,startEntry=0,limit=20):Promise<{files:ExportFile[];next:number;done:boolean}> {
 if(bytes.length>LIMITS.inputBytes)throw new Error('upload_limit')
 if(!Number.isSafeInteger(startEntry)||startEntry<0||!Number.isSafeInteger(limit)||limit<1||limit>LIMITS.archiveEntries)throw new Error('archive_cursor')
 if(!name.toLowerCase().endsWith('.zip')){if(startEntry>1)throw new Error('archive_cursor');return {files:startEntry?[]:[{name,bytes}],next:1,done:true}}
 const entries=archiveEntries(name,bytes),files:ExportFile[]=[];if(startEntry>entries.length)throw new Error('archive_cursor')
 // Physical members, including directories, consume the bounded chunk budget.
 // All metadata is validated above; admission consumes every decompression/CRC
 // chunk before private custody. No directory bypasses body verification.
 const next=Math.min(entries.length,startEntry+limit)
 for(const entry of entries.slice(startEntry,next)){
  try{
   const data=await inflate(bytes.subarray(entry.body,entry.body+entry.compressed),entry.method,entry.uncompressed)
   if(data.length!==entry.uncompressed||crc32(data)!==entry.crc)throw new Error('archive_integrity')
   if(entry.directory){if(data.length)throw new Error('archive_directory_not_empty');continue}
   files.push({name:entry.name,bytes:data})
  }catch(error){throw new AdmissionError(error instanceof Error?error.message:'invalid_archive',entry.name)}
 }
 return {files,next,done:next===entries.length}
}
