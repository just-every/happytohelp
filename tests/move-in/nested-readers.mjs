import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nestedRecord,nestedCases} from './nested-inputs.mjs';
import {archive} from './archive-inputs.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {indexFile,parseFile}=await import('../../src/modules/move-in/readers/records.ts');
const {uploadIdentities,identityDigest}=await import('../../src/modules/move-in/identities.ts');
const {indexUpload}=await import('../../src/modules/move-in/readers/identity-index.ts');
const encode=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
const read=(name,body,vendor='intercom')=>[...parseFile({name,bytes:encode(body)},vendor,0,5000)];
async function refused(name,body,row,pointer,vendor='intercom',code='unsupported_nested_envelope'){
 await assert.rejects(()=>uploadIdentities('p',vendor,name,encode(body)),error=>{assert.deepEqual(error.diagnostic,{code,location:{artifact:name,row,pointer}});return true});
 const result=read(name,body,vendor);assert.equal(result.length,1);assert.equal(result[0].record,undefined);assert.deepEqual(result[0].diagnostic.location,{artifact:name,row,...(pointer?{pointer}:{})});assert.equal(result[0].diagnostic.code,code);
}
test('untyped nested containers have precisely located whole-input refusal at every depth and discriminator',async()=>{
 for(const kind of ['contact','conversation','macro','article','user','lead','tag','tag-name','company','admin','unknown'])for(const discriminator of [{type:kind},{kind},{type:kind,kind}])for(const reverse of [false,true]){
  const original={id:'nested-81',...discriminator,email:'imani@example.test'},record=reverse?Object.fromEntries(Object.entries(original).reverse()):original;
  for(const [name,body,row,pointer] of nestedCases(record))await refused(name,body,row,pointer);
 }
 for(const depth of [1,2,7,31,120]){
  let wrapper=nestedRecord;for(let i=0;i<depth;i++)wrapper=i%2?[wrapper]:{'a/b~c':wrapper};
  await refused('depth.json',JSON.stringify({type:'list',unknown:wrapper}),1,Array.isArray(wrapper)?'/unknown/0':'/unknown');
 }
});
test('unknown containers cannot bypass refusal through valid siblings, ZIP entries or later physical lines',async()=>{
 for(const [name,body,row,pointer] of nestedCases()){
  const bytes=archive([{name:'safe.json',body:JSON.stringify(nestedRecord)},{name:'inner/'+name,body}]);
  await assert.rejects(()=>uploadIdentities('p','intercom','multi.zip',bytes),error=>{assert.deepEqual(error.diagnostic,{code:'unsupported_nested_envelope',location:{artifact:'inner/'+name,row,pointer}});return true});
 }
 const body=JSON.stringify(nestedRecord)+'\n\n'+JSON.stringify({type:'list',unknown:{wrapper:nestedRecord}});
 await assert.rejects(()=>uploadIdentities('p','intercom','mixed.jsonl',encode(body)),error=>error.row===3&&error.pointer==='/unknown'&&error.code==='unsupported_nested_envelope');
});
test('unknown Zendesk wrappers cannot conceal source records under an invented outer kind',async()=>{
 for(const kind of ['user','ticket','macro','article','organization','group','ticket_form','ticket_field','ticket_event','tag','unknown']){
  const original={[kind]:{id:81,name:'Imani'}};
  await refused('wrapped.ndjson','\n'+JSON.stringify({box:{deeper:[original]}}),2,'/box','zendesk','unsupported_wrapper_requires_record_id');
 }
 for(const [payload,id] of [[{id:81,name:'Named tag'},'81'],[{name:'Named tag'},'Named tag']]){const body=JSON.stringify({tag:payload}),rows=read('tag.ndjson',body,'zendesk');assert.equal(rows[0].record.kind,'tag');assert.equal(rows[0].record.sourceId,id);assert.deepEqual(rows[0].record.payload,payload);assert.equal((await uploadIdentities('p','zendesk','tag.ndjson',encode(body))).complete,false)}
 await refused('tag.ndjson',JSON.stringify({tag:{wrapper:{user:{id:81}}}}),1,'/tag','zendesk','invalid_source_id');
});
test('identified records retain their payload boundary and aliases; opaque leaf content remains accounted',async()=>{
 for(const discriminator of [{type:'contact'},{kind:'contact'},{type:'contact',kind:'contact'}]){
  const record={...nestedRecord,...discriminator,details:{wrapper:{type:'article',id:'payload-only',body:'ordinary@example.test'}}};if(!Object.hasOwn(discriminator,'type'))delete record.type;
  for(const [name,body,pointer] of [['root.json',JSON.stringify(record),''],['known.json',JSON.stringify({contacts:[record]}),'/contacts/0'],['unknown.json',JSON.stringify({type:'list',unknown:record}),'/unknown']]){
   const rows=read(name,body);assert.equal(rows.length,1);assert.equal(rows[0].record.kind,'contact');assert.equal(rows[0].record.sourceId,'nested-81');assert.deepEqual(rows[0].record.payload,record);assert.deepEqual(rows[0].record.location,{artifact:name,row:1,...(pointer?{pointer}:{})});
   const audit=await uploadIdentities('p','intercom',name,encode(body));assert.equal(audit.complete,false);assert.ok(audit.links.some(link=>link.digest===identityDigest('p','email','imani@example.test')));assert.ok(!audit.links.some(link=>link.digest===identityDigest('p','email','ordinary@example.test')));
  }
 }
 for(const value of [null,false,42,'ordinary@example.test',{},[],{id:'opaque',note:'ordinary@example.test'}]){
  const body={type:'list',unknown:value},rows=read('opaque.json',body);assert.equal(rows.length,1);assert.equal(rows[0].record.kind,'unsupported-field:unknown');assert.deepEqual(rows[0].record.payload,value);const audit=await uploadIdentities('p','intercom','opaque.json',encode(body));assert.equal(audit.complete,false);assert.deepEqual(audit.links,[]);
 }
});
test('saved source offsets and bounded queue slices agree with admission for records and refusals',async()=>{
 const body='\n'+JSON.stringify(nestedRecord)+'\n\n'+JSON.stringify({type:'list',unknown:{box:nestedRecord}}),file={name:'resume.jsonl',bytes:encode(body)},positions=indexFile(file,'intercom');
 assert.equal(positions.length,2);assert.equal(positions[1].row,4);assert.equal(positions[1].pointer,'/unknown');assert.equal(body.slice(positions[0].start,positions[0].end),JSON.stringify(nestedRecord));
 const first=[...parseFile(file,'intercom',0,1,positions)],second=[...parseFile(file,'intercom',1,1,positions)];assert.equal(first[0].record.sourceId,'nested-81');assert.equal(second[0].record,undefined);assert.equal(second[0].diagnostic.code,'unsupported_nested_envelope');assert.equal(second[0].ordinal,1);
 let callbacks=0;await assert.rejects(()=>indexUpload('intercom','bad.json',encode({type:'list',unknown:{box:nestedRecord}}),()=>callbacks++),/unsupported_nested_envelope/);assert.equal(callbacks,0);
});
test('opaque structural work has independent record and upload budgets without hiding supported aliases',async()=>{
 const leaf={values:Array(4094).fill(0)},small=JSON.stringify({type:'list',unknown:leaf});assert.equal((await uploadIdentities('p','intercom','bounded.json',encode(small))).complete,false);
 await refused('over.json',JSON.stringify({type:'list',unknown:{values:Array(4095).fill(0)}}),1,'/unknown','intercom','opaque_structure_node_limit');
 const allowed={type:'list',unknown:Array(48).fill(leaf),contacts:[nestedRecord]},index=await uploadIdentities('p','intercom','allowed.json',encode(allowed));assert.equal(index.complete,false);assert.ok(index.links.some(link=>link.digest===identityDigest('p','email','imani@example.test')));
 const excess={type:'list',unknown:Array(49).fill(leaf)};await assert.rejects(()=>uploadIdentities('p','intercom','excess.json',encode(excess)),error=>error.code==='upload_opaque_structure_node_limit'&&error.pointer==='/unknown/48'&&error.row===1);
 // Nonempty unknown metadata without a discriminator is still a located,
 // incomplete omission. No arbitrary identity is inferred from its text.
 const metadata={type:'list',pages:{next:{email:'ordinary@example.test'}},contacts:[nestedRecord]},parsed=read('metadata.json',metadata);assert.deepEqual(parsed.map(row=>row.record.kind),['unsupported-field:pages','contact']);const audit=await uploadIdentities('p','intercom','metadata.json',encode(metadata));assert.equal(audit.complete,false);assert.ok(!audit.links.some(link=>link.digest===identityDigest('p','email','ordinary@example.test')));
});
