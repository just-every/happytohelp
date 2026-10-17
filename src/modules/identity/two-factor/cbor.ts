/** The CBOR subset WebAuthn uses (RFC 8949): integers, byte and text strings, arrays, maps, tags and simple values. */
export function decodeCbor(bytes:Uint8Array):{value:unknown;length:number}{
 let offset=0
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 const need=(count:number)=>{if(offset+count>bytes.length)throw new Error('cbor_truncated')}
 const argument=(info:number)=>{
  if(info<24)return info
  if(info===24){need(1);return bytes[offset++]}
  if(info===25){need(2);const value=view.getUint16(offset);offset+=2;return value}
  if(info===26){need(4);const value=view.getUint32(offset);offset+=4;return value}
  if(info===27){need(8);const value=Number(view.getBigUint64(offset));offset+=8;return value}
  throw new Error('cbor_indefinite')
 }
 const item=(depth:number):unknown=>{
  if(depth>16)throw new Error('cbor_depth')
  need(1)
  const first=bytes[offset++],major=first>>5,info=first&31
  if(major===7){
   if(info===20)return false
   if(info===21)return true
   if(info===22)return null
   if(info===23)return undefined
   if(info===25){need(2);offset+=2;return 0}
   if(info===26){need(4);const value=view.getFloat32(offset);offset+=4;return value}
   if(info===27){need(8);const value=view.getFloat64(offset);offset+=8;return value}
   throw new Error('cbor_simple')
  }
  const length=argument(info)
  if(major===0)return length
  if(major===1)return -1-length
  if(major===2){need(length);const value=bytes.slice(offset,offset+length);offset+=length;return value}
  if(major===3){need(length);const value=new TextDecoder().decode(bytes.subarray(offset,offset+length));offset+=length;return value}
  if(major===4)return Array.from({length},()=>item(depth+1))
  if(major===5){const map=new Map<unknown,unknown>();for(let i=0;i<length;i++){const key=item(depth+1);map.set(key,item(depth+1))}return map}
  return item(depth+1)
 }
 const value=item(0)
 return {value,length:offset}
}
