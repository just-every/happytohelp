import {crc32,deflateRawSync} from 'node:zlib';
// ZIP32 fixture writer, independent of the application. Overrides construct
// contradictory headers without consulting the reader's output.
export function archive(entries,{comment='',prefix='',gap='',suffix=''}={}){
 let offset=Buffer.byteLength(prefix);const local=[Buffer.from(prefix)],central=[];
 for(const entry of entries){
  const name=Buffer.from(entry.name),plain=Buffer.from(entry.body??''),method=entry.method??8,compressed=entry.compressed??(method===8?deflateRawSync(plain):plain),crc=crc32(plain),flags=entry.flags??0,extra=Buffer.from(entry.extra??''),localExtra=Buffer.from(entry.localExtra??entry.extra??''),entryComment=Buffer.from(entry.comment??''),localName=Buffer.from(entry.localName??entry.name);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(flags,6);header.writeUInt16LE(method,8);header.writeUInt32LE(entry.descriptor?0:crc,14);header.writeUInt32LE(entry.descriptor?0:compressed.length,18);header.writeUInt32LE(entry.descriptor?0:plain.length,22);header.writeUInt16LE(localName.length,26);header.writeUInt16LE(localExtra.length,28);entry.local?.(header);
  const descriptor=entry.descriptor?Buffer.alloc(entry.descriptor==='unsigned'?12:16):Buffer.alloc(0);if(descriptor.length){const at=descriptor.length===16?4:0;if(at)descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,at);descriptor.writeUInt32LE(compressed.length,at+4);descriptor.writeUInt32LE(plain.length,at+8);entry.changeDescriptor?.(descriptor)}
  local.push(header,localName,localExtra,compressed,descriptor,Buffer.from(gap));
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(flags,8);record.writeUInt16LE(method,10);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(plain.length,24);record.writeUInt16LE(name.length,28);record.writeUInt16LE(extra.length,30);record.writeUInt16LE(entryComment.length,32);record.writeUInt32LE(offset,42);entry.central?.(record);
  central.push(record,name,extra,entryComment);offset+=header.length+localName.length+localExtra.length+compressed.length+descriptor.length+Buffer.byteLength(gap);
 }
 const directory=Buffer.concat(central),footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50);footer.writeUInt16LE(entries.length,8);footer.writeUInt16LE(entries.length,10);footer.writeUInt32LE(directory.length,12);footer.writeUInt32LE(offset,16);footer.writeUInt16LE(Buffer.byteLength(comment),20);
 return Buffer.concat([...local,directory,footer,Buffer.from(comment),Buffer.from(suffix)]);
}
export function invalidMembers(){return [
 ['nonempty', {body:'private bytes'}, 'archive_directory_not_empty'],
 ['local signature', {local:h=>h.writeUInt32LE(0,0)}, 'archive_local_header'],
 ['unsupported method', {method:99}, 'archive_unsupported_compression'],
 ['central CRC', {central:h=>h.writeUInt32LE(12,16)}, 'archive_integrity'],
 ['local CRC', {local:h=>h.writeUInt32LE(12,14)}, 'archive_integrity'],
 ['expanded size', {central:h=>h.writeUInt32LE(2097153,24)}, 'archive_expansion_limit'],
 ['local size', {local:h=>h.writeUInt32LE(1,22)}, 'archive_integrity'],
 ['compressed size', {local:h=>h.writeUInt32LE(999,18)}, 'archive_integrity'],
 ['header flags', {local:h=>h.writeUInt16LE(8,6)}, 'archive_local_header'],
 ['header method', {local:h=>h.writeUInt16LE(0,8)}, 'archive_local_header'],
 ['header name', {localName:'other/'}, 'archive_name_mismatch'],
 ['encryption', {flags:1}, 'archive_encrypted'],
 ['unknown flags', {flags:32}, 'archive_unsupported_flags'],
 ['disk', {central:h=>h.writeUInt16LE(1,34)}, 'archive_multidisk'],
 ['central extra', {extra:'private'}, 'archive_unsupported_metadata'],
 ['local extra', {localExtra:'private'}, 'archive_unsupported_metadata'],
 ['comment', {comment:'private'}, 'archive_unsupported_metadata'],
 ['symlink', {central:h=>h.writeUInt32LE(0xa0000000,38)}, 'archive_unsupported_entry_type'],
 ['truncated stream', {compressed:Buffer.from([3])}, 'archive_integrity'],
 ['hidden expanded body', {compressed:deflateRawSync(Buffer.from('hidden'))}, 'archive_expansion_limit'],
 ['trailing compressed bytes', {compressed:Buffer.concat([deflateRawSync(Buffer.alloc(0)),Buffer.from('hidden')])}, 'archive_integrity'],
 ['descriptor CRC', {flags:8,descriptor:true,changeDescriptor:h=>h.writeUInt32LE(4,4)}, 'archive_integrity'],
 ];}
