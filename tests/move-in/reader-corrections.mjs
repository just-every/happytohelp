import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {parseFile}=await import('../../src/modules/move-in/readers/records.ts');
const {prepareMapping}=await import('../../src/modules/move-in/readers/normalise.ts');
const read=(body,name='source.json')=>[...parseFile({name,bytes:new TextEncoder().encode(body)},'intercom',0,100)];
const map=records=>prepareMapping({projectId:'p',actorId:'owner',vendor:'intercom',tagIds:new Map(),source:{records,artifacts:[],diagnostics:[]}});
const contact={type:'contact',id:'c',email:'person@example.test',created_at:1704067200};
const macro={type:'macro',id:'m',name:'Reply',body:'Hello',body_text:'Hello',visible_to:'everyone',available_on:['inbox'],created_at:'2024-01-01T00:00:00Z',updated_at:'2024-01-01T00:00:00Z'};
const conversation={type:'conversation',id:'v',state:'open',channel:{initial:'messenger'},created_at:1704067200,updated_at:1704067200,contacts:{type:'contact.list',contacts:[{id:'c'}]},source:{id:'s',body:'First',author:{type:'contact',id:'c'}},conversation_parts:{type:'conversation_part.list',conversation_parts:[]}};
const mapped=async rows=>map(read(rows.map(JSON.stringify).join('\n'),'source.jsonl').map(x=>x.record));
test('macro dynamic markup and alternate representations are rejected before conversion',async()=>{
 for(const change of [{body:'Hi',body_text:'Hi {{user.name|fallback:"there"}}'},{body:'<p>Hi <attribute key="user.name" default="there"/></p>'},{body:'<p>Hi <attribute key="company.custom" default="friend"></attribute></p>'},{body:'<p>Hi</p>',body_text:'Hi {{user.name|fallback:"there"}}'},{body:'{% if user %}Hello{% endif %}'},{body:'<p>Hi <attribute key="any.field"/></p>',body_text:'Hi'}])assert.equal((await mapped([{...macro,...change}])).rejections.get('macro/m'),'macro_placeholders_not_supported');
 const staticResult=await mapped([macro]);assert.equal(staticResult.effects.get('macro/m')[0].value.tables.macros[0].content,'Hello');
});
test('supplied conversation part counts must be exact nonnegative safe integers',async()=>{
 for(const count of ['0',null,false,-1,0.5,Number.MAX_SAFE_INTEGER+1,1])assert.equal((await mapped([contact,{...conversation,conversation_parts:{...conversation.conversation_parts,total_count:count}}])).rejections.get('conversation/v'),'conversation_parts_count_invalid_or_incomplete');
 for(const parts of [conversation.conversation_parts,{...conversation.conversation_parts,total_count:0}])assert.equal((await mapped([contact,{...conversation,conversation_parts:parts}])).rejections.has('conversation/v'),false);
 // JSON numeric overflow is a valid JSON number with a non-finite JS representation.
 const overflow=read(JSON.stringify(contact)+'\n'+JSON.stringify(conversation).replace('"conversation_parts":[]','"conversation_parts":[],"total_count":1e400'),'source.jsonl');assert.equal(overflow[1].diagnostic.code,'conversation_parts_count_invalid_or_incomplete');assert.deepEqual(overflow[1].diagnostic.location,{artifact:'source.jsonl',row:2});
});
test('unsupported envelope siblings become located counted omissions, including empty collections and fields',async()=>{
 const parsed=read('{\n"contacts":['+JSON.stringify(contact)+'],\n"companies":[{"type":"company","id":"co"},{"id":"co2"}],\n"segments":[],\n"unknown_metadata":{"secret":"retained only"},\n"type":"list","total_count":1,"pages":{}\n}');
 const result=await map(parsed.filter(x=>x.record).map(x=>x.record));assert.equal(parsed.filter(x=>x.record).length,5);assert.equal(result.effects.get('contact/c').length,1);
 const omitted=[...result.omissions];assert.equal(omitted.length,4);assert.ok(omitted.every(([,reasons])=>reasons.some(x=>x.startsWith('unsupported_record_kind:'))));
 assert.deepEqual(parsed.slice(1).map(x=>x.record.location),[{artifact:'source.json',row:3,pointer:'/companies/0'},{artifact:'source.json',row:3,pointer:'/companies/1'},{artifact:'source.json',row:4,pointer:'/segments'},{artifact:'source.json',row:5,pointer:'/unknown_metadata'}]);
});
test('malformed envelopes report the physical bad token and path rather than the last record',()=>{
 for(const [body,row,pointer] of [
  [' \n {\n "contacts":['+JSON.stringify(contact)+'],\n "later": nope\n }',4,'/later'],
  ['{\n"contacts":['+JSON.stringify(contact)+'],\n"conversations":[\n {"type":"conversation","id":"a"},\n nope\n]}',5,'/conversations/1'],
  ['{\n"contacts":['+JSON.stringify(contact)+'],\n"later": [1,\n]\n}',4,'/later/1'],
  [' \n {"type":"contact",\n "id": nope}',3,'/id'],
  ['{\n"contacts":['+JSON.stringify(contact)+'],\n invalid: 1}',3,'']
 ]){const diagnostic=read(body).find(x=>x.diagnostic)?.diagnostic;assert.ok(diagnostic);assert.equal(diagnostic.location.row,row);assert.equal(diagnostic.location.pointer??'',pointer)}
});
test('unknown-only and escaped list envelopes retain every omission and escaped-newline errors retain their row',async()=>{
 const parsed=read('{"type":"li\\u0073t","companies":[{"id":"one"}],"unknown":null}');assert.equal(parsed.length,2);assert.equal(parsed[0].record.kind,'unsupported-field:companies');assert.equal((await map(parsed.map(x=>x.record))).omissions.size,2);
 const invalid=read('{\n"type":"contact",\n"id":"bad\\\nvalue"\n}');assert.deepEqual(invalid[0].diagnostic.location,{artifact:'source.json',row:3,pointer:'/id'});
 const extension=await mapped([{...contact,unknown_feature:{private:'kept only in original'}}]);assert.deepEqual(extension.omissions.get('contact/c'),['unsupported_source_field:unknown_feature']);
});

const {jsonPositions}=await import('../../src/modules/move-in/readers/json-index.ts');
test('structural indexing stops at the configured position budget before retaining an oversized envelope',()=>{
 for(const body of ['[0,0,0]', '{"contacts":[0,0,0]}'])assert.throws(()=>jsonPositions(body,2),/export_record_limit/);
});
