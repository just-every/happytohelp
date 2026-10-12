import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {parseFile}=await import('../../src/modules/move-in/readers/records.ts');
const {prepareMapping,withTags}=await import('../../src/modules/move-in/readers/normalise.ts');
const {archiveChunk}=await import('../../src/modules/move-in/readers/archive.ts');
const filesFromUpload=async(name,bytes)=>(await archiveChunk(name,bytes,0,64)).files;
const file=(text,name='export.jsonl')=>({name,bytes:new TextEncoder().encode(text)});
const read=(text,vendor,name)=>[...parseFile(file(text,name),vendor,0,100)];
function map(text,vendor){const records=read(text,vendor).filter(r=>r.record).map(r=>r.record),source=withTags({records,artifacts:[],diagnostics:[]},vendor);return prepareMapping({projectId:'workspace',actorId:'reviewer',vendor,source,tagIds:new Map()})}
const user={user:{id:1,role:'end-user',name:'Ada',email:'ada@example.test',created_at:'2024-01-01T00:00:00Z'}};
const staff={user:{id:2,role:'agent',name:'Teammate',email:'staff@example.test',created_at:'2024-01-01T00:00:00Z'}};
const ticket={ticket:{id:42,requester_id:1,subject:'Quoted "subject" مرحبا',created_at:'2024-01-02T00:00:00Z',updated_at:'2024-01-02T00:02:00Z',status:'open',tags:[' Billing ','billing'],comments:[{id:9,author_id:1,body:'Customer <script>inert</script>',public:true,created_at:'2024-01-02T00:00:00Z'},{id:10,author_id:2,body:'Private note',public:false,created_at:'2024-01-02T00:01:00Z'},{id:11,author_id:2,body:'Public reply',public:true,created_at:'2024-01-02T00:02:00Z'}]}};
const ndjson=(...records)=>records.map(r=>JSON.stringify(r)).join('\n');
test('Zendesk singular wrappers preserve IDs, exact source location, roles, original times and note visibility',async()=>{
 const parsed=read('\n'+ndjson(user,staff,ticket)+'\n{broken\n','zendesk');assert.equal(parsed[0].record.sourceId,'1');assert.deepEqual(parsed[0].record.location,{artifact:'export.jsonl',row:2});assert.equal(parsed[3].diagnostic.location.row,5);
 const result=await map(ndjson(user,staff,ticket),'zendesk');assert.deepEqual([...result.rejections],[]);assert.deepEqual(result.omissions.get('user/2'),['historical_staff_retained_as_authors_no_access_created']);
 const conversation=result.effects.get('ticket/42')[0].value.tables;assert.deepEqual(conversation.messages.toSorted((a,b)=>a.revision-b.revision).map(m=>[m.content,m.actor_role,m.created_at]),[['Customer <script>inert</script>','contact',1704153600000],['Public reply','operator',1704153720000]]);assert.deepEqual(conversation.move_in_notes.map(n=>[n.content,n.created_at]),[['Private note',1704153660000]]);assert.equal(conversation.conversation_tags.length,1);assert.equal(conversation.conversations[0].assigned_to,null);
 assert.equal(result.effects.get('user/1')[0].value.tables.contacts[0].is_verified,0);assert.equal(result.effects.get('user/1')[0].value.tables.context_subjects[0].bot_enabled,0);
});
test('Zendesk refuses incomplete comments, implicit visibility, absent author roles, unsafe IDs and restricted content',async()=>{
 for(const [change,reason] of [[{comments:[]},'ticket_comments_required'],[{comments:[{id:9,author_id:1,body:'Body',created_at:'2024-01-02T00:00:00Z'}]},'comment_visibility_required'],[{comments:[{id:9,author_id:99,body:'Body',public:true,created_at:'2024-01-02T00:00:00Z'}]},'comment_author_role_missing']])assert.equal((await map(ndjson(user,{ticket:{...ticket.ticket,...change}}),'zendesk')).rejections.get('ticket/42'),reason);
 assert.equal(read('{"ticket":{"id":0}}','zendesk')[0].diagnostic.code,'invalid_source_id');assert.equal(read('{"tickets":[]}','zendesk')[0].diagnostic.code,'singular_wrapper_required');
 const result=await map(ndjson({article:{id:8,title:'Restricted',body:'Private',draft:false,user_segment_id:123,created_at:'2024-01-01T00:00:00Z',updated_at:'2024-01-01T00:00:00Z'}},{macro:{id:7,restriction:{type:'Group',id:1},actions:[]}}),'zendesk');assert.equal(result.rejections.get('article/8'),'restricted_article_not_imported');assert.equal(result.rejections.get('macro/7'),'restricted_macro_not_imported');
});
test('Intercom JSON lists, multi-collection envelopes and JSONL preserve path and refuse unsupported formats',async()=>{
 const contact={type:'contact',id:'c',name:'A',email:'a@example.test',created_at:1704067200},macro={type:'macro',id:'m',name:'Reply',body:'Hello',visible_to:'everyone',available_on:['inbox'],created_at:'2024-01-01T00:00:00Z',updated_at:'2024-01-02T00:00:00Z'};
 const parsed=read(JSON.stringify({contacts:[contact],conversations:[{type:'conversation',id:'x'}]}),'intercom','group.json');assert.equal(parsed.length,2);assert.deepEqual(parsed.map(r=>r.record.location.pointer),['/contacts/0','/conversations/0']);assert.equal(read(JSON.stringify({type:'list',data:[macro]}),'intercom','macro.json')[0].record.kind,'macro');assert.equal(read('{}','intercom','report.csv')[0].diagnostic.code,'unsupported_file_extension');
 const result=await map(ndjson(contact,macro),'intercom');assert.equal(result.effects.get('macro/m')[0].value.tables.macros[0].updated_at,1704153600000);
});
test('Intercom initial message is explicitly conversation-created context, parts keep original Unix time and private notes',async()=>{
 const contact={type:'contact',id:'c',name:'Ada',email:'ada@example.test',created_at:1704067200},conversation={type:'conversation',id:'v',state:'closed',channel:{initial:'messenger'},created_at:1704153600,updated_at:1704153720,contacts:{type:'contact.list',contacts:[{id:'c'}]},source:{id:'s',body:'First',author:{type:'contact',id:'c'}},conversation_parts:{type:'conversation_part.list',conversation_parts:[{id:'n',part_type:'note',body:'Secret note',created_at:1704153660,author:{id:'a',type:'admin'}},{id:'r',part_type:'comment',body:'Reply',created_at:1704153720,author:{id:'a',type:'admin'}}]}};
 const result=await map(ndjson(contact,conversation),'intercom'),tables=result.effects.get('conversation/v')[0].value.tables;assert.deepEqual(tables.messages.toSorted((a,b)=>a.revision-b.revision).map(m=>m.content),['First','Reply']);assert.equal(tables.move_in_notes[0].content,'Secret note');const initial=tables.move_in_message_sources.find(s=>s.source_id==='source:s');assert.equal(initial.source_time,null);assert.equal(initial.time_provenance,'conversation-created-context');assert.equal(tables.conversations[0].resolved_at,null);assert.equal(tables.move_in_conversations[0].source_state,'closed');assert.ok(result.omissions.get('conversation/v').includes('historical_resolution_time_unavailable_source_state_preserved'));
});
test('ZIP corruption, unsafe paths and expansion are refused before parsing',async()=>{await assert.rejects(()=>filesFromUpload('bad.zip',new Uint8Array([80,75,3,4])),/archive_footer/);await assert.rejects(()=>filesFromUpload('big.json',new Uint8Array(2*1024*1024+1)),/upload_limit/)});

test('JSON collections parse in resumable slices and retain physical line and pointer locations',async()=>{
 const input=file('{\n "contacts": [\n {"type":"contact","id":"a"},\n {"type":"contact","id":"b"}\n ],\n "conversations": [{"type":"conversation","id":"v"}]\n}','export.json');
 const first=[...parseFile(input,'intercom',0,1)],second=[...parseFile(input,'intercom',1,1)],third=[...parseFile(input,'intercom',2,1)];assert.equal(first[0].record.sourceId,'a');assert.equal(second[0].record.sourceId,'b');assert.equal(third[0].record.sourceId,'v');assert.deepEqual(first[0].record.location,{artifact:'export.json',row:3,pointer:'/contacts/0'});assert.equal(second[0].record.location.row,4);assert.equal(third[0].record.location.row,6);
});

test('ZIP validates deflate bytes, CRC, exact paths, duplicates and advertised expanded bounds',async()=>{
 const {zip}=await import('./zip.mjs'),good=zip([{name:'nested/contacts.jsonl',body:'{"type":"contact","id":"one"}\n'}]);const files=await filesFromUpload('export.zip',good);assert.equal(files.length,1);assert.equal(files[0].name,'nested/contacts.jsonl');assert.equal(new TextDecoder().decode(files[0].bytes),'{"type":"contact","id":"one"}\n');
 for(const name of ['../contacts.json','/contacts.json','C:/contacts.json','a\\b.json','a//b.json'])await assert.rejects(()=>filesFromUpload('export.zip',zip([{name,body:'{}'}])),/archive_unsafe_path/);
 await assert.rejects(()=>filesFromUpload('export.zip',zip([{name:'same.json',body:'{}'},{name:'same.json',body:'{}'}])),/archive_duplicate_path/);
 const corrupt=Buffer.from(good),central=corrupt.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));corrupt.writeUInt32LE(0,central+16);await assert.rejects(()=>filesFromUpload('export.zip',corrupt),/archive_integrity/);
 await assert.rejects(()=>filesFromUpload('export.zip',zip([{name:'large.json',body:' '.repeat(2*1024*1024+1)}])),/archive_expansion_limit/);
 await assert.rejects(()=>filesFromUpload('export.zip',zip(Array.from({length:65},(_,i)=>({name:`${i}.json`,body:'{}'})))),/archive_limit_or_zip64/);
});


test('contact tags remain contact metadata and plain_body takes precedence in Zendesk comments',async()=>{
 const person={user:{...user.user,tags:['contact-only']}},conversation={ticket:{...ticket.ticket,comments:ticket.ticket.comments.map(comment=>({...comment,plain_body:'Exported plain body'}))}},result=await map(ndjson(person,staff,conversation),'zendesk');
 assert.deepEqual(JSON.parse(result.effects.get('user/1')[0].value.tables.contacts[0].metadata_json).imported_tags,['contact-only']);assert.equal(result.effects.has('tag-name/contact-only'),false);assert.deepEqual(result.effects.get('ticket/42')[0].value.tables.messages.map(m=>m.content),['Exported plain body','Exported plain body']);
});

test('original ISO timestamps reject normalized invalid dates and preserve explicit offsets',async()=>{const {time}=await import('../../src/modules/move-in/readers/common.ts');assert.throws(()=>time('2024-02-30T00:00:00Z','iso'),/original_timestamp_missing_or_invalid/);assert.throws(()=>time('2024-01-01T24:00:00Z','iso'),/original_timestamp_missing_or_invalid/);assert.equal(time('2024-01-01T10:00:00+10:00','iso'),1704067200000)});
