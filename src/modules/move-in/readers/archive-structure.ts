import {AdmissionError} from './admission-error'
import {LIMITS} from '../types'
const u16=(b:Uint8Array,p:number)=>b[p]|b[p+1]<<8
const u32=(b:Uint8Array,p:number)=>(b[p]|b[p+1]<<8|b[p+2]<<16|b[p+3]*0x1000000)>>>0
function range(b:Uint8Array,p:number,n:number){if(!Number.isSafeInteger(p)||!Number.isSafeInteger(n)||p<0||n<0||p+n>b.length)throw new Error('archive_truncated')}
function nameOf(bytes:Uint8Array){const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!name||name.length>1024||/^[A-Za-z]:/.test(name)||name.includes('\\')||name.startsWith('/')||name.includes('\0')||name.split('/').some((p,i,a)=>p==='.'||p==='..'||!p&&i<a.length-1))throw new Error('archive_unsafe_path');return name}
export interface ArchiveEntry {name:string;method:number;crc:number;compressed:number;uncompressed:number;body:number;directory:boolean}
/** ZIP32 only. Every physical byte must belong to a validated member,
 * descriptor, central directory or footer. Opaque extras/comments and preambles
 * are refused instead of claiming a complete source identity audit. */
export function archiveEntries(artifact:string,bytes:Uint8Array):ArchiveEntry[]{
 let footer=-1
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(bytes,p)===0x06054b50&&p+22+u16(bytes,p+20)===bytes.length){footer=p;break}
 if(footer<0)throw new Error('archive_footer')
 const count=u16(bytes,footer+10),size=u32(bytes,footer+12),start=u32(bytes,footer+16)
 if(u16(bytes,footer+4)||u16(bytes,footer+6)||u16(bytes,footer+8)!==count)throw new Error('archive_multidisk')
 if(count>LIMITS.archiveEntries||start===0xffffffff||size===0xffffffff)throw new Error('archive_limit_or_zip64')
 if(u16(bytes,footer+20))throw new Error('archive_unsupported_metadata')
 range(bytes,start,size);if(start+size!==footer)throw new Error('archive_directory')
 let position=start,expanded=0;const entries:ArchiveEntry[]=[],seen=new Set<string>(),ranges:{start:number;end:number;name:string}[]=[]
 for(let i=0;i<count;i++){
  let name:string|undefined
  try{
   range(bytes,position,46);if(position+46>footer||u32(bytes,position)!==0x02014b50)throw new Error('archive_directory')
   const version=u16(bytes,position+6),flags=u16(bytes,position+8),method=u16(bytes,position+10),crc=u32(bytes,position+16),compressed=u32(bytes,position+20),uncompressed=u32(bytes,position+24),nameSize=u16(bytes,position+28),extra=u16(bytes,position+30),comment=u16(bytes,position+32),local=u32(bytes,position+42),attributes=u32(bytes,position+38),time=u32(bytes,position+12)
   range(bytes,position+46,nameSize+extra+comment);if(position+46+nameSize+extra+comment>footer)throw new Error('archive_directory')
   name=nameOf(bytes.subarray(position+46,position+46+nameSize))
   if(flags&0x41)throw new Error('archive_encrypted')
   if(flags&~0x80e||method===0&&(flags&6))throw new Error('archive_unsupported_flags')
   if(method!==0&&method!==8)throw new Error('archive_unsupported_compression')
   if(version<10||version>20||method===8&&version<20)throw new Error('archive_unsupported_version')
   if(u16(bytes,position+34))throw new Error('archive_multidisk')
   if(extra||comment)throw new Error('archive_unsupported_metadata')
   if(seen.has(name))throw new Error('archive_duplicate_path');seen.add(name)
   const directory=name.endsWith('/'),unixType=(attributes>>>16)&0xf000
   if(unixType&&unixType!==0x8000&&unixType!==0x4000)throw new Error('archive_unsupported_entry_type')
   if(unixType===0x4000&&!directory||unixType===0x8000&&directory||attributes&0x10&&!directory)throw new Error('archive_entry_type_mismatch')
   if(uncompressed>LIMITS.expandedBytes||expanded+uncompressed>LIMITS.expandedBytes)throw new Error('archive_expansion_limit')
   if(directory&&uncompressed!==0)throw new Error('archive_directory_not_empty')
   if(method===0&&compressed!==uncompressed)throw new Error('archive_integrity')
   range(bytes,local,30);if(local+30>start||u32(bytes,local)!==0x04034b50||u16(bytes,local+4)!==version||u16(bytes,local+6)!==flags||u16(bytes,local+8)!==method||u32(bytes,local+10)!==time)throw new Error('archive_local_header')
   const localName=u16(bytes,local+26),localExtra=u16(bytes,local+28);range(bytes,local+30,localName+localExtra)
   if(localExtra)throw new Error('archive_unsupported_metadata')
   if(nameOf(bytes.subarray(local+30,local+30+localName))!==name)throw new Error('archive_name_mismatch')
   const expected=[crc,compressed,uncompressed];for(let j=0;j<3;j++){const value=u32(bytes,local+14+j*4);if(value!==expected[j]&&(!(flags&8)||value!==0))throw new Error('archive_integrity')}
   const body=local+30+localName+localExtra;range(bytes,body,compressed);let end=body+compressed
   if(flags&8){
    range(bytes,end,12)
    const matches=(offset:number)=>offset+12<=start&&expected.every((value,j)=>u32(bytes,offset+j*4)===value)
    // The optional signature can itself be the CRC of an unsigned descriptor.
    // Validate the complete tuple and range before selecting either layout.
    if(matches(end))end+=12
    else if(u32(bytes,end)===0x08074b50&&matches(end+4))end+=16
    else throw new Error('archive_integrity')
   }
   if(end>start||ranges.some(r=>local<r.end&&end>r.start))throw new Error('archive_entry_overlap')
   ranges.push({start:local,end,name});expanded+=uncompressed;entries.push({name,method,crc,compressed,uncompressed,body,directory});position+=46+nameSize+extra+comment
  }catch(error){throw new AdmissionError(error instanceof TypeError?'archive_invalid_utf8':error instanceof Error?error.message:'invalid_archive',name??artifact,1,name?'':`/entries/${i}`)}
 }
 if(position!==footer)throw new Error('archive_directory_size')
 let end=0;for(const member of ranges.sort((a,b)=>a.start-b.start)){if(member.start!==end)throw new AdmissionError('archive_unclaimed_bytes',member.name);end=member.end}
 if(end!==start)throw new Error('archive_unclaimed_bytes')
 return entries
}
