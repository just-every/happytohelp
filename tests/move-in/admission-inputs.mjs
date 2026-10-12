import {documents} from './shape-inputs.mjs';
import {zip} from './zip.mjs';
export const upload=(vendor,body,name='source.jsonl')=>({method:'POST',headers:{'X-Import-Filename':name,'X-Import-Schema':'2.16'},body});
export const base='/api/move-in/projects/p/imports';
export function refusals(){
 const person=documents('intercom').person,valid=JSON.stringify(person),later=JSON.stringify({...person,id:'later',email:'later@example.test'});
 return [
  ['intercom','bad.jsonl',valid+'\n\n{"type":\n'+later,'invalid_json',3,'/type'],
  ['intercom','bad.json','{\n"contacts":['+valid+'],\n"conversations":[\n nope\n]}','invalid_json',4,'/conversations/0'],
  ['zendesk','bad.ndjson','\n{"user":{"id":1,"id":2}}','duplicate_json_field',2,'/user/id'],
  ['intercom','duplicate.jsonl','\n{"type":"contact","id":"first","i\\u0064":"second"}','duplicate_json_field',2,'/id'],
  ['intercom','deep.jsonl','\n{"type":"contact","id":"deep","unknown":'+ '['.repeat(129)+'0'+']'.repeat(129)+'}','source_structure_depth_limit',2,'/unknown'+'/0'.repeat(128)],
  ['intercom','large.jsonl','\n'+JSON.stringify({...person,name:'x'.repeat(128*1024)})+'\n'+later,'record_size_limit',2,''],
  ['intercom','many.jsonl',Array(5000).fill(valid).join('\n')+'\n'+later,'export_record_limit',5001,''],
  ['intercom','many.json','{\n"contacts":['+Array(5000).fill(valid).join(',')+',\n'+later+']}','export_record_limit',3,'/contacts/5000'],
  ['intercom','group.zip',zip([{name:'safe.jsonl',body:valid},{name:'nested/bad.jsonl',body:'\n{"type":'}]),'invalid_json',2,'/type','nested/bad.jsonl'],
  ['intercom','count.zip',zip([{name:'first.jsonl',body:Array(3000).fill(valid).join('\n')},{name:'second.jsonl',body:Array(2001).fill(later).join('\n')}]),'export_record_limit',2001,'','second.jsonl'],
  ['intercom','later.zip',zip([...Array.from({length:21},(_,i)=>({name:`safe-${i}.jsonl`,body:valid})),{name:'later.jsonl',body:'{\"id\":'}]),'invalid_json',1,'/id','later.jsonl'],
  ['intercom','invalid.zip',Buffer.from('not a zip'),'archive_footer',1,''],
  ['intercom','entries.zip',zip(Array.from({length:65},(_,i)=>({name:`${i}.jsonl`,body:valid}))),'archive_limit_or_zip64',1,''],
  ['intercom','invalid.jsonl',Buffer.from([0xff,0xfe]),'invalid_utf8',1,''],
 ];
}
