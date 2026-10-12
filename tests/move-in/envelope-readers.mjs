import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {records,encode,positions} from './envelope-inputs.mjs';
import {archive,invalidMembers} from './archive-inputs.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {parseFile,indexFile}=await import('../../src/modules/move-in/readers/records.ts');
const {uploadIdentities,identityDigest}=await import('../../src/modules/move-in/identities.ts');
const {archiveChunk}=await import('../../src/modules/move-in/readers/archive.ts');
const read=(name,body,start=0,limit=5000)=>[...parseFile({name,bytes:encode(body)},'intercom',start,limit)];
test('unknown envelope parents retain explicit record kinds and IDs',async()=>{
 for(const original of Object.values(records()))for(const [name,body,pointer] of positions(original)){
  const rows=read(name,body);assert.equal(rows.length,1);assert.equal(rows[0].record?.kind,original.type,name);assert.equal(rows[0].record.sourceId,original.id);assert.deepEqual(rows[0].record.payload,original);assert.deepEqual(rows[0].record.location,{artifact:name,row:2,...(pointer?{pointer}:{})});
  if(name.startsWith('foreign')){assert.equal(rows[0].diagnostic.code,'unsupported_source_field');assert.equal(rows[0].diagnostic.severity,'warning');assert.equal(rows[0].diagnostic.location.pointer,pointer)}
  const index=await uploadIdentities('p','intercom',name,encode(body));assert.equal(index.complete,!name.startsWith('foreign'));if(original.type==='contact')assert.ok(index.links.some(link=>link.digest===identityDigest('p','email','nadia@example.test')));
 }
});
test('nonempty directory bytes are refused before skip',async()=>{
 const body=archive([{name:'hidden/',body:'private bytes'},{name:'contact.json',body:JSON.stringify(records().contact)}]);
 await assert.rejects(()=>uploadIdentities('p','intercom','hidden.zip',body),error=>error.code==='archive_directory_not_empty'&&error.artifact==='hidden/');
});
test('all explicit kinds and discriminator orders share lowering across unknown fields, arrays, files and chunks',async()=>{
 for(const kind of ['contact','conversation','macro','article','user','lead','tag','tag-name','company','admin','unknown'])for(const discriminator of [{type:kind},{kind},{type:kind,kind}])for(const reverse of [false,true]){
  const payload={...(records()[kind]??{id:'opaque',email:'opaque@example.test'}),...discriminator};if(!Object.hasOwn(discriminator,'type'))delete payload.type;
  const value=reverse?Object.fromEntries(Object.entries(payload).reverse()):payload;
  for(const key of ['contacts','data','arbitrary','a/b~c',''])for(const singular of [false,true]){
   if(singular&&['contacts','data'].includes(key))continue;
   const pointer='/'+key.replace(/~/g,'~0').replace(/\//g,'~1')+(singular?'':'/0'),document={type:'list',[key]:singular?value:[value]},body='\n'+JSON.stringify(document);
   for(const name of ['positions.json','positions.jsonl']){const rows=read(name,body);assert.equal(rows[0].record.kind,kind);assert.equal(rows[0].record.sourceId,payload.id);assert.equal(rows[0].record.location.pointer,pointer);assert.deepEqual(rows[0].record.payload,value);const audit=await uploadIdentities('p','intercom',name,encode(body));if(['contact','user','lead'].includes(kind))assert.ok(audit.links.some(link=>link.digest===identityDigest('p','email',payload.email)))}
  }
 }
 const values=Object.values(records()),body=JSON.stringify({type:'list',arbitrary:values,unknown:null}),file={name:'bounded.json',bytes:encode(body)},index=indexFile(file,'intercom');assert.equal(index.length,5);assert.deepEqual([...parseFile(file,'intercom',1,2,index)].map(row=>row.record.kind),['conversation','macro']);
 const packaged=archive(positions(records().contact).map(([name,body])=>({name:'nested/'+name,body}))),audit=await uploadIdentities('p','intercom','multi.zip',packaged);assert.equal(audit.complete,false);assert.ok(audit.links.some(link=>link.digest===identityDigest('p','external','customer-archive')));
});
test('unknown untyped values stay reasoned omissions without guessed aliases, and typed ambiguity refuses every parent',async()=>{
 for(const value of [null,false,3,'arbitrary@example.test',{},[],{id:'untyped',email:'arbitrary@example.test'},[{type:'contact',id:'nested',email:'arbitrary@example.test'}]]){
  const body={type:'list',unknown:value},rows=read('opaque.json',body),audit=await uploadIdentities('p','intercom','opaque.json',encode(body));assert.equal(audit.complete,false);
  if(Array.isArray(value)&&value.length){assert.equal(rows[0].record.kind,'contact');assert.ok(audit.links.length)}else{assert.equal(rows[0].record.kind,'unsupported-field:unknown');assert.deepEqual(audit.links,[])}
 }
 for(const key of ['data','unknown'])for(const [record,code,suffix] of [[{type:null},'invalid_record_discriminator','/type'],[{type:'contact',kind:'macro'},'conflicting_record_discriminator','/kind'],[{type:'list',data:[records().contact]},'record_required_inside_collection','']]){
  for(const [field,pointer] of [[{[key]:[record]},`/${key}/0`],...(key==='unknown'?[[{[key]:record},`/${key}`]]:[])])await assert.rejects(()=>uploadIdentities('p','intercom','refused.json',encode({type:'list',...field})),error=>error.code===code&&error.pointer===pointer+suffix);
 }
 const body={type:'list',unknown:{wrapper:records().contact}};await assert.rejects(()=>uploadIdentities('p','intercom','opaque.json',encode(body)),error=>error.code==='unsupported_nested_envelope'&&error.artifact==='opaque.json'&&error.row===1&&error.pointer==='/unknown');const rows=read('opaque.json',body);assert.equal(rows.length,1);assert.equal(rows[0].record,undefined);assert.equal(rows[0].diagnostic.code,'unsupported_nested_envelope');
});
test('every malformed directory member is located, including later physical chunks',async()=>{
 for(const [label,change,code] of invalidMembers())for(const before of [0,21]){
  const body=archive([...Array.from({length:before},(_,i)=>({name:`empty-${i}/`})),{name:'bad/',...change},{name:'safe.json',body:JSON.stringify(records().contact)}]);
  await assert.rejects(()=>uploadIdentities('p','intercom','invalid.zip',body),error=>{assert.equal(error.code,code,label);assert.equal(error.artifact,'bad/',label);assert.equal(error.row,1);assert.equal(error.pointer,'');return true});
 }
});
test('stored, deflated, signed and unsigned descriptor members preserve physical bounded cursors',async()=>{
 for(const method of [0,8])for(const descriptor of [false,true,'unsigned']){
  const entries=Array.from({length:44},(_,i)=>i%3?{name:`empty-${i}/`,method,descriptor,flags:descriptor?8:0}:{name:`record-${i}.json`,body:JSON.stringify(records().contact),method,descriptor,flags:descriptor?8:0}),body=archive(entries);let cursor=0,total=0;
  do{const chunk=await archiveChunk('valid.zip',body,cursor);assert.equal(chunk.next,Math.min(44,cursor+20));assert.deepEqual(chunk.files.map(file=>file.name),entries.slice(cursor,cursor+20).filter(entry=>!entry.name.endsWith('/')).map(entry=>entry.name));for(const file of chunk.files)assert.deepEqual(JSON.parse(new TextDecoder().decode(file.bytes)),records().contact);total+=chunk.files.length;cursor=chunk.next;if(chunk.done)break}while(true);
  assert.equal(total,15);assert.equal((await uploadIdentities('p','intercom','valid.zip',body)).complete,true);
 }
});
test('no unaccounted ZIP bytes, range overlap or invalid cursor can bypass member checks',async()=>{
 const entry={name:'safe.json',body:JSON.stringify(records().contact)};
 for(const options of [{prefix:'private'},{gap:'private'},{comment:'private'}])await assert.rejects(()=>uploadIdentities('p','intercom','opaque.zip',archive([entry],options)),error=>['archive_unclaimed_bytes','archive_unsupported_metadata'].includes(error.code));
 for(const name of ['empty/','safe.json']){
  const body=archive([{name:'first/',method:0},{name,method:0,central:h=>h.writeUInt32LE(0,42)}]);await assert.rejects(()=>uploadIdentities('p','intercom','overlap.zip',body),error=>['archive_entry_overlap','archive_name_mismatch'].includes(error.code));
 }
 const body=archive([entry]);for(const [start,limit] of [[-1,20],[0,0],[0,65],[0,1.5],[0,NaN],[2,20]])await assert.rejects(()=>archiveChunk('cursor.zip',body,start,limit),/archive_cursor/);
 const terminal=await archiveChunk('cursor.zip',body,1);assert.deepEqual(terminal,{files:[],next:1,done:true});
});
test('an unsigned descriptor whose CRC equals the optional signature is still unambiguous',async()=>{
 // CRC32 of these four independently computed bytes is 0x08074b50. A matching
 // signature word alone cannot select the longer descriptor layout.
 const plain=Buffer.from([172,10,122,213]);
 for(const method of [0,8])for(const descriptor of [true,'unsigned']){
  const input=archive([{name:'source.json',body:plain,method,flags:8,descriptor}]);
  const result=await archiveChunk('descriptor.zip',input);assert.equal(result.files.length,1);assert.deepEqual(Buffer.from(result.files[0].bytes),plain);
 }
});
