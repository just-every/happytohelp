import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {intercomRecords,zendeskRecords,collectionNames,collisionValues,recordPackages,ambiguousRecords} from './record-inputs.mjs';
import {zip} from './zip.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {parseFile}=await import('../../src/modules/move-in/readers/records.ts');
const {prepareMapping,withTags}=await import('../../src/modules/move-in/readers/normalise.ts');
const {uploadIdentities,sourceDigest,identityDigest}=await import('../../src/modules/move-in/identities.ts');
const bytes=body=>new TextEncoder().encode(body),read=(vendor,name,body)=>[...parseFile({name,bytes:bytes(body)},vendor,0,5000)];
const audit=(name,body)=>uploadIdentities('p','intercom',name,bytes(body));
const expectedAliases={contact:[['source:intercom','person-31'],['email','person31@example.test'],['external','external-31']],conversation:[['source:intercom','person-31'],['email','participant@example.test'],['external','participant-external'],['source:intercom','staff-34'],['email','staff34@example.test'],['external','staff-external'],['source:intercom','staff-36'],['email','staff36@example.test'],['external','note-external']],macro:[],article:[]};
function hasAliases(index,kind){for(const [category,value] of expectedAliases[kind]??[])assert.ok(index.links.some(link=>link.digest===identityDigest('p',category,value)),`${kind} ${category} ${value}`)}
for(const kind of ['contact','conversation','macro','article'])test(`${kind}: record discrimination preserves every typed payload and alias across collection names, values, order and packaging`,async()=>{
 for(const key of collectionNames)for(const value of collisionValues)for(const order of ['before','after']){
  // A real field such as conversation.contacts keeps its real shape in controls;
  // replacing it is separately audited as a malformed record, never an envelope.
  const original=intercomRecords()[kind],record=order==='before'?{[key]:value,...original}:{...original,[key]:value};
  for(const [name,body,pointer] of recordPackages(record)){
   const rows=read('intercom',name,body);assert.equal(rows.length,1,`${kind}/${key}/${order}/${name}`);assert.equal(rows[0].record?.kind,kind);assert.equal(rows[0].record.sourceId,original.id);assert.deepEqual(rows[0].record.payload,record);assert.deepEqual(rows[0].record.location,{artifact:name,row:2,...(pointer?{pointer}:{})});
   const index=await audit(name,body);if(!(kind==='conversation'&&key==='contacts'&&order==='after'))hasAliases(index,kind);else for(const value of ['staff-34','staff-36'])assert.ok(index.links.some(link=>link.digest===sourceDigest('p','intercom',value)));
  }
 }
});
test('every explicit record discriminator wins over collection inference; unsupported kinds remain counted',async()=>{
 for(const kind of ['contact','conversation','macro','article','user','lead','tag','tag-name','company','admin','unknown'])for(const field of ['type','kind','both'])for(const order of ['before','after']){
  const payload={id:'explicit',email:'explicit@example.test'},discriminator=field==='both'?{type:kind,kind}:{[field]:kind},record=order==='before'?{data:[],...payload,...discriminator}:{...payload,...discriminator,data:[]};
  for(const [name,body] of recordPackages(record)){const rows=read('intercom',name,body);assert.equal(rows.length,1);assert.equal(rows[0].record?.kind,kind);const index=await audit(name,body);if(['contact','user','lead'].includes(kind))assert.ok(index.links.some(link=>link.digest===identityDigest('p','email','explicit@example.test')))}
 }
});
test('ambiguous or malformed discriminators and collection documents refuse complete custody with exact locations',async()=>{
 for(const [input,code,pointer] of ambiguousRecords())for(const record of [input,Object.fromEntries(Object.entries(input).reverse())])for(const [name,body,prefix] of recordPackages(record).slice(0,4)){
  await assert.rejects(()=>audit(name,body),error=>error.code===code&&error.artifact===name&&error.row===2&&error.pointer===prefix+pointer,`${name}: ${JSON.stringify(record)}`);
 }
 for(const value of [null,false,0,[],{},''])for(const field of ['type','kind']){const record={...intercomRecords().contact,[field]:value};await assert.rejects(()=>audit('bad.json',JSON.stringify(record)),error=>error.code==='invalid_record_discriminator'&&error.pointer==='/'+field)}
 for(const type of ['list','contact.list','conversation.list','macro.list'])for(const key of collectionNames.slice(0,5))for(const value of [null,false,0,'ordinary text',{}])await assert.rejects(()=>audit('bad.json',JSON.stringify({type,[key]:value})),error=>error.code==='collection_must_be_array'&&error.pointer==='/'+key);
});
test('all singular Zendesk kinds preserve typed payloads with collection-named fields and locate ambiguous wrappers',async()=>{
 for(const [kind,record] of Object.entries(zendeskRecords()))for(const name of collectionNames)for(const value of collisionValues)for(const order of ['before','after']){
  const payload=order==='before'?{[name]:value,...record[kind]}:{...record[kind],[name]:value},body='\n'+JSON.stringify({[kind]:payload}),rows=read('zendesk','source.ndjson',body);assert.equal(rows.length,1);assert.equal(rows[0].record.kind,kind);assert.deepEqual(rows[0].record.payload,payload);const index=await uploadIdentities('p','zendesk','source.ndjson',bytes(body));if(kind==='user')assert.ok(index.links.some(link=>link.digest===identityDigest('p','email','person31@example.test')));
 }
 for(const [kind,record] of Object.entries(zendeskRecords()))for(const key of ['type','kind'])for(const value of [null,[],{},0,'different-kind']){const body='\n'+JSON.stringify({[kind]:{...record[kind],[key]:value}}),rows=read('zendesk','payload.ndjson',body),index=await uploadIdentities('p','zendesk','payload.ndjson',bytes(body));assert.equal(rows[0].record.kind,kind);assert.deepEqual(rows[0].record.payload[key],value);assert.equal(index.complete,kind==='ticket'&&key==='type'&&value===null);if(kind==='user')assert.ok(index.links.some(link=>link.digest===identityDigest('p','email','person31@example.test')));if(kind==='ticket')assert.ok(index.links.some(link=>link.digest===sourceDigest('p','zendesk','31')))}
 for(const body of ['\n {"unknown":null}','\n {"id":"untyped","contacts":[]}'])await assert.rejects(()=>audit('bad.json',body),error=>error.code==='explicit_record_type_required'&&error.row===2&&error.pointer==='');
});
test('Zendesk documented ticket type strings and null remain metadata under their singular wrapper',async()=>{
 for(const type of ['problem','incident','question','task',null]){
  const records=zendeskRecords(),ticket={ticket:{...records.ticket.ticket,type}},body=[records.user,ticket].map(JSON.stringify).join('\n'),index=await uploadIdentities('p','zendesk','typed.ndjson',bytes(body));assert.equal(index.complete,true);assert.ok(index.links.some(link=>link.digest===sourceDigest('p','zendesk','31')));
  const parsed=read('zendesk','typed.ndjson',body),source=withTags({records:parsed.map(row=>row.record),artifacts:[],diagnostics:[]},'zendesk'),mapping=await prepareMapping({projectId:'p',actorId:'owner',vendor:'zendesk',source,tagIds:new Map()});assert.deepEqual([...mapping.rejections],[]);assert.equal(source.records.length,3);assert.equal(mapping.effects.get('ticket/32')[0].value.tables.messages[0].content,'Opening message');
  const zipped=await uploadIdentities('p','zendesk','typed.zip',zip([{name:'user.ndjson',body:JSON.stringify(records.user)},{name:'ticket.ndjson',body:JSON.stringify(ticket)}]));assert.equal(zipped.complete,true);
 }
});
test('true envelopes, JSONL document collections and unsupported sibling decisions preserve known typed aliases',async()=>{
 const contact=intercomRecords().contact;
 for(const discriminator of [{},{type:'list'},{kind:'list'},{type:'list',kind:'list'},{type:'contact.list'}])for(const key of ['contacts','conversations','data','articles','macros'])for(const extension of ['json','jsonl']){
  const body='\n'+JSON.stringify({...discriminator,[key]:[contact],pages:null,total_count:1}),name='envelope.'+extension,rows=read('intercom',name,body),index=await audit(name,body);assert.equal(rows.length,1);assert.equal(rows[0].record.kind,'contact');assert.equal(rows[0].record.location.pointer,`/${key}/0`);assert.equal(index.complete,true);hasAliases(index,'contact');
 }
 for(const siblings of [{companies:[contact]},{unknown:contact},{companies:[contact],unknown_metadata:'ordinary text'}]){const body=JSON.stringify({type:'list',...siblings}),rows=read('intercom','unknown.json',body),index=await audit('unknown.json',body);assert.equal(rows.length,Object.keys(siblings).length);assert.deepEqual(rows.map(row=>row.record.kind),Object.entries(siblings).map(([key])=>key==='unknown_metadata'?'unsupported-field:unknown_metadata':'contact'));for(const row of rows.filter(row=>row.record.kind==='contact')){assert.equal(row.record.sourceId,contact.id);assert.deepEqual(row.record.payload,contact);assert.equal(row.diagnostic.code,'unsupported_source_field');assert.equal(row.diagnostic.severity,'warning')}assert.equal(index.complete,false);hasAliases(index,'contact')}
 for(const body of [JSON.stringify([{type:'list',data:[contact]}]),JSON.stringify({type:'list',data:[{type:'list',data:[contact]}]})])await assert.rejects(()=>audit('nested.json',body),error=>error.code==='record_required_inside_collection'&&['/0','/data/0'].includes(error.pointer));
});
test('Zendesk wrappers are singular across all record kinds and reject ambiguous/plural packaging before custody',async()=>{
 for(const [kind,record] of Object.entries(zendeskRecords()))for(const extension of ['ndjson','jsonl','json']){
  const name='source.'+extension,body='\n'+JSON.stringify(record),rows=read('zendesk',name,body);assert.equal(rows[0].record.kind,kind);assert.deepEqual(rows[0].record.payload,record[kind]);assert.deepEqual(rows[0].record.location,{artifact:name,row:2});
  const index=await uploadIdentities('p','zendesk',name,bytes(body));assert.equal(index.complete,true);if(kind==='user')assert.ok(index.links.some(link=>link.digest===identityDigest('p','email','person31@example.test')));
 }
 for(const kind of ['organization','group','ticket_form','ticket_field','ticket_event','tag','unknown']){const body=JSON.stringify({[kind]:{id:41,name:'Retained'}});assert.equal(read('zendesk','source.ndjson',body)[0].record.kind,kind);assert.equal((await uploadIdentities('p','zendesk','source.ndjson',bytes(body))).complete,false)}
 for(const record of [{user:zendeskRecords().user.user,ticket:zendeskRecords().ticket.ticket},{users:[zendeskRecords().user.user]},{user:null},[zendeskRecords().user],{User:zendeskRecords().user.user}])await assert.rejects(()=>uploadIdentities('p','zendesk','bad.ndjson',bytes('\n'+JSON.stringify(record))),error=>['singular_wrapper_required','record_must_be_object'].includes(error.code)&&error.artifact==='bad.ndjson'&&error.row===2);
});
test('handwritten mapping, exact counts and plain/null controls agree for root records, arrays, envelopes and ZIP files',async()=>{
 const records=intercomRecords(),values=Object.values(records),packages=[['separate.jsonl',values.map(JSON.stringify).join('\n')],['array.json',JSON.stringify(values)],['list.json',JSON.stringify({type:'list',data:values,total_count:4,pages:null})],['collections.json',JSON.stringify({contacts:[records.contact],conversations:[records.conversation],macros:[records.macro],articles:[records.article],pages:{}})]];
 for(const [name,body] of packages){const parsed=read('intercom',name,body),source=withTags({records:parsed.map(row=>row.record),artifacts:[],diagnostics:[]},'intercom'),mapping=await prepareMapping({projectId:'p',actorId:'owner',vendor:'intercom',source,tagIds:new Map()});assert.deepEqual([...mapping.rejections],[]);assert.equal(source.records.length,5);assert.deepEqual([...mapping.effects.keys()],['tag-name/returns','contact/person-31','conversation/conversation-32','macro/macro-38','article/article-39']);assert.equal(mapping.effects.get('contact/person-31')[0].value.tables.contacts[0].name,'Mara');assert.equal(mapping.effects.get('conversation/conversation-32')[0].value.tables.messages[0].content,'Opening message');assert.equal(mapping.effects.get('conversation/conversation-32')[0].value.tables.move_in_notes[0].content,'Private note');assert.equal(mapping.effects.get('macro/macro-38')[0].value.tables.macros[0].content,'Hello Mara');assert.equal(mapping.effects.get('article/article-39')[0].value.tables.knowledge_articles[0].status,'draft');const index=await audit(name,body);hasAliases(index,'contact');hasAliases(index,'conversation');assert.equal(index.complete,true)}
 const zipped=await uploadIdentities('p','intercom','multi.zip',zip(packages.map(([name,body])=>({name:'nested/'+name,body}))));hasAliases(zipped,'contact');hasAliases(zipped,'conversation');assert.equal(zipped.complete,true);
 for(const record of [{...records.contact,name:null,email:null,external_id:null,custom_attributes:null},{...records.article,body:'staff34@example.test is ordinary text',translated_content:null,parent_id:null}]){const index=await audit('control.json',JSON.stringify(record));assert.equal(index.complete,true);assert.ok(!index.links.some(link=>link.digest===identityDigest('p','email','staff34@example.test')))}
});

test('the final source position has identical admission and aliases across ZIP member packaging',async()=>{
 const prefix=Array(4999).fill(JSON.stringify(intercomRecords().contact)).join('\n');
 for(const [kind,record] of Object.entries(intercomRecords()))for(const [name,body] of recordPackages(record)){
  const index=await uploadIdentities('p','intercom','boundary.zip',zip([{name:'first.jsonl',body:prefix},{name:'last/'+name,body}]));assert.equal(index.complete,true,`${kind}/${name}`);hasAliases(index,'contact');hasAliases(index,kind);
 }
 const macro={...intercomRecords().macro,available_on:Array(50).fill('inbox')};
 assert.equal((await uploadIdentities('p','intercom','array-field.zip',zip([{name:'first.jsonl',body:prefix},{name:'last.json',body:JSON.stringify(macro)}]))).complete,true);
 for(const [name,body,pointer,row] of [['last.json',JSON.stringify([intercomRecords().contact,intercomRecords().contact]),'/1',1],['last.jsonl',[intercomRecords().contact,intercomRecords().contact].map(JSON.stringify).join('\n'),'',2]])await assert.rejects(()=>uploadIdentities('p','intercom','over.zip',zip([{name:'first.jsonl',body:prefix},{name,body}])),error=>error.code==='export_record_limit'&&error.artifact===name&&error.pointer===pointer&&error.row===row);
});
