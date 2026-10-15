import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {archive} from './archive-inputs.mjs';
import {emptyReason,encode,emptyCases,emptyFiles,laterSource,person,sourceName} from './empty-inputs.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {uploadIdentities,identityDigest}=await import('../../src/modules/move-in/identities.ts');
const {indexUpload}=await import('../../src/modules/move-in/readers/identity-index.ts');
const {indexFile,parseFile}=await import('../../src/modules/move-in/readers/records.ts');
const {archiveChunk}=await import('../../src/modules/move-in/readers/archive.ts');
for(const vendor of ['zendesk','intercom']){
 for(const [name,body] of emptyCases(vendor))test(`${vendor}: ${name} refuses aggregate empty source with its upload location`,async()=>{
  let callbacks=0;
  await assert.rejects(()=>indexUpload(vendor,name,encode(body),()=>callbacks++),error=>{
   assert.deepEqual(error.diagnostic,{code:'empty_export',location:{artifact:name,row:1,pointer:''}});
   assert.equal(error.message,emptyReason);return true;
  });
  assert.equal(callbacks,0);
  await assert.rejects(()=>uploadIdentities('p',vendor,name,encode(body)),error=>error.code==='empty_export');
 });
 test(`${vendor}: empty auxiliary files have resumable zero-position indexes`,()=>{
  for(const [name,body] of emptyFiles(vendor)){
   const file={name,bytes:encode(body)},positions=indexFile(file,vendor);assert.deepEqual(positions,[]);
   for(const start of [0,1])assert.deepEqual([...parseFile(file,vendor,start,1,positions)],[]);
  }
 });
 test(`${vendor}: records after empty physical chunks and files retain identity, payload and location`,async()=>{
  for(const offset of [0,20,40]){
   const {body,record,entries}=laterSource(vendor,{offset}),audit=await uploadIdentities('p',vendor,'later.zip',body);
   assert.equal(audit.complete,true);assert.ok(audit.links.some(link=>link.digest===identityDigest('p','email','keira@example.test')));
   let cursor=0;const parsed=[];do{const chunk=await archiveChunk('later.zip',body,cursor);assert.equal(chunk.next,Math.min(entries.length,cursor+20));for(const file of chunk.files){const positions=indexFile(file,vendor);parsed.push(...parseFile(file,vendor,0,100,positions))}cursor=chunk.next;if(chunk.done)break}while(true);
   assert.equal(parsed.length,1);assert.equal(parsed[0].record.kind,vendor==='zendesk'?'user':'contact');assert.equal(parsed[0].record.sourceId,vendor==='zendesk'?'83':'person-83');assert.deepEqual(parsed[0].record.payload,vendor==='zendesk'?record.user:record);assert.deepEqual(parsed[0].record.location,{artifact:sourceName(vendor),row:2});
  }
 });
 test(`${vendor}: nonempty unsupported kinds remain reasoned source positions after blank chunks`,async()=>{
  const {body,record}=laterSource(vendor,{unsupported:true});assert.equal((await uploadIdentities('p',vendor,'unsupported.zip',body)).complete,false);
  const parsed=[...parseFile({name:sourceName(vendor),bytes:encode(JSON.stringify(record))},vendor)];
  assert.equal(parsed.length,1);assert.equal(parsed[0].record.kind,vendor==='zendesk'?'group':'company');assert.equal(parsed[0].record.sourceId,vendor==='zendesk'?'91':'company-91');assert.deepEqual(parsed[0].record.payload,vendor==='zendesk'?record.group:record);
 });
 test(`${vendor}: later malformed source or physical members keep the earlier precise refusal`,async()=>{
  const empty=Array.from({length:21},(_,i)=>({name:`empty-${i}/`}));
  for(const first of [[],[{name:sourceName(vendor),body:JSON.stringify(person(vendor))}]]){
   const body=archive([...first,...empty,{name:'late/bad.jsonl',body:'\r\n\r\n{"type":'}]);
   await assert.rejects(()=>uploadIdentities('p',vendor,'bad.zip',body),error=>{assert.deepEqual(error.diagnostic,{code:'invalid_json',location:{artifact:'late/bad.jsonl',row:3,pointer:'/type'}});return true});
   const broken=archive([...first,...empty,{name:'broken/',compressed:Buffer.from([3])}]);
   await assert.rejects(()=>uploadIdentities('p',vendor,'bad.zip',broken),error=>{assert.deepEqual(error.diagnostic,{code:'archive_integrity',location:{artifact:'broken/',row:1,pointer:''}});return true});
  }
 });
}
test('empty-looking invalid structures and ZIP metadata retain structural errors',async()=>{
 for(const [vendor,name,body,code,pointer] of [
  ['zendesk','array.ndjson','\n[]','record_must_be_object',''],
  ['zendesk','envelope.ndjson','\n{"users":[]}','singular_wrapper_required','/users'],
  ['intercom','object.json','\n{}','explicit_record_type_required',''],
  ['intercom','collection.json','\n{"contacts":null}','collection_must_be_array','/contacts'],
  ['intercom','unsupported.txt','\n ','unsupported_file_extension',''],
 ])await assert.rejects(()=>uploadIdentities('p',vendor,name,encode(body)),error=>{assert.equal(error.code,code);assert.equal(error.pointer,pointer);return true});
 for(const [options,code] of [[{prefix:'unclaimed'},'archive_unclaimed_bytes'],[{comment:'metadata'},'archive_unsupported_metadata'],[{suffix:'unclaimed'},'archive_footer']])await assert.rejects(()=>uploadIdentities('p','intercom','empty.zip',archive([],options)),error=>error.code===code);
 const opaque=encode('{"type":"list","unknown":[]}');assert.deepEqual(await uploadIdentities('p','intercom','opaque.json',opaque),{links:[],complete:false,uninterpreted:[],incomplete:{code:'unsupported_source_field',location:{artifact:'opaque.json',row:1,pointer:'/unknown'}}});assert.equal([...parseFile({name:'opaque.json',bytes:opaque},'intercom')][0].record.kind,'unsupported-field:unknown');
});
