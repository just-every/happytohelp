import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {documents} from './shape-inputs.mjs';
import {zip} from './zip.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {uploadIdentities,sourceDigest,identityDigest}=await import('../../src/modules/move-in/identities.ts');
const bytes=body=>new TextEncoder().encode(body);
for(const format of ['jsonl','json','zip'])test(`${format} counts, depth, bytes and equivalent duplicate members refuse complete custody`,async()=>{
 const cases=[['[{"type":"contact","id":"first","i\\u0064":"second"}]','duplicate_json_field'],['[{"type":"contact","id":"deep","unknown":'+ '['.repeat(129)+'0'+']'.repeat(129)+'}]','source_structure_depth_limit'],[JSON.stringify([{type:'contact',id:'big',name:'x'.repeat(128*1024)}]),'record_size_limit'],['['+Array(5001).fill('{"type":"contact","id":"one"}').join(',')+']','export_record_limit']];
 for(const [array,code] of cases){const body=format==='jsonl'?array.slice(1,-1).replaceAll('},{','}\n{'):array,name=format==='jsonl'?'source.jsonl':'source.json',input=format==='zip'?zip([{name:'nested/'+name,body}]):bytes(body);await assert.rejects(()=>uploadIdentities('p','intercom',format==='zip'?'source.zip':name,input),error=>error.code===code&&error.artifact===(format==='zip'?'nested/'+name:name)&&error.row>=1&&typeof error.pointer==='string')}
});
for(const vendor of ['intercom','zendesk'])test(`${vendor} understood aliases survive diagnostic truncation and exact structural lower boundary`,async()=>{
 const input=documents(vendor).person,payload=vendor==='zendesk'?input.user:input,fields=Object.fromEntries(Array.from({length:128},(_,i)=>[`unknown${i}`,null]));payload.email='ordinary@example.test';payload.external_id='ordinary-external';
 for(const record of [{...fields,...payload},{...payload,...fields}]){const result=await uploadIdentities('p',vendor,'source.jsonl',bytes(JSON.stringify(vendor==='zendesk'?{user:record}:record)));assert.equal(result.complete,false);for(const digest of [sourceDigest('p',vendor,String(payload.id)),identityDigest('p','email','ordinary@example.test'),identityDigest('p','external','ordinary-external')])assert.ok(result.links.some(link=>link.digest===digest))}
 // Text fields and opaque nullable values are not arbitrary email detectors.
 const article=documents(vendor).article,p=vendor==='zendesk'?article.article:article;p.body='ordinary@example.test';p.translated_content=null;const ordinary=await uploadIdentities('p',vendor,'text.jsonl',bytes(JSON.stringify(article)));assert.equal(ordinary.complete,true);assert.deepEqual(ordinary.links,[]);
});
test('upload-wide work and hash fan-out have independent bounded refusals',async()=>{
 const wide=JSON.stringify({type:'macro',id:'wide',name:'R',body:'Hello',visible_to:'everyone',available_on:Array(4000).fill('inbox')});await assert.rejects(()=>uploadIdentities('p','intercom','wide.jsonl',bytes(Array(51).fill(wide).join('\n'))),error=>error.code==='upload_identity_node_limit');
 const person=id=>({type:'contact',id,email:id+'@example.test',external_id:id}),record=i=>({type:'conversation',id:String(i),contacts:{type:'contact.list',contacts:Array.from({length:100},(_,j)=>person(`${i}-${j}`))}}),body=Array.from({length:51},(_,i)=>JSON.stringify(record(i))).join('\n');assert.ok(Buffer.byteLength(body)<2*1024*1024);await assert.rejects(()=>uploadIdentities('p','intercom','links.jsonl',bytes(body)),error=>error.code==='upload_identity_link_limit');
 const same={type:'conversation',id:'repeated',contacts:{type:'contact.list',contacts:Array(100).fill(person('same'))}},repeated=Array(81).fill(JSON.stringify(same)).join('\n');await assert.rejects(()=>uploadIdentities('p','intercom','hashes.jsonl',bytes(repeated)),error=>error.code==='upload_identity_hash_limit');
});

test('exact byte, record, node, nesting and archive-entry lower boundaries retain known aliases',async()=>{
 const person={type:'contact',id:'at-limit',email:'at-limit@example.test',created_at:1704067200},serialized=JSON.stringify(person),known=sourceDigest('p','intercom','at-limit');
 const exactRecord=JSON.stringify({...person,name:''}),sized=JSON.stringify({...person,name:'x'.repeat(128*1024-Buffer.byteLength(exactRecord))});assert.equal(Buffer.byteLength(sized),128*1024);
 for(const [name,body] of [['bytes.jsonl',bytes(sized)],['count.jsonl',bytes(Array(5000).fill(serialized).join('\n'))],['depth.jsonl',bytes(serialized.slice(0,-1)+',"unknown":'+'['.repeat(127)+'0'+']'.repeat(127)+'}')],['archive.zip',zip(Array.from({length:64},(_,i)=>({name:`${i}.jsonl`,body:serialized})))],['expanded.zip',zip([{name:'at-limit.json',body:serialized+' '.repeat(2*1024*1024-Buffer.byteLength(serialized))}])]]){
  const indexed=await uploadIdentities('p','intercom',name,body);assert.ok(indexed.links.some(link=>link.digest===known),name);assert.equal(indexed.complete,name!=='depth.jsonl',name)
 }
 const user={user:{id:1,role:'end-user',name:'A',email:'a@example.test',created_at:'2024-01-01T00:00:00Z',tags:Array(4089).fill('x')}};assert.equal((await uploadIdentities('p','zendesk','nodes.jsonl',bytes(JSON.stringify(user)))).complete,true);user.user.tags.push('x');await assert.rejects(()=>uploadIdentities('p','zendesk','nodes.jsonl',bytes(JSON.stringify(user))),error=>error.code==='source_identity_node_limit'&&error.pointer==='/user/tags/4089');
});
