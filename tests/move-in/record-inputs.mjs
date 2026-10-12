// Independently handwritten from Lily d24f3f7's singular wrappers, Beacon
// fa1846b's Data API 2.16 boundary and the documented API supplements.
export const intercomRecords=()=>({
 contact:{type:'contact',id:'person-31',email:'person31@example.test',external_id:'external-31',name:'Mara',created_at:1704067200},
 conversation:{type:'conversation',id:'conversation-32',state:'open',created_at:1704153600,updated_at:1704153660,channel:{initial:'email'},contacts:{type:'contact.list',contacts:[{id:'person-31',type:'contact',email:'participant@example.test',external_id:'participant-external'}]},source:{id:'source-33',type:'email',body:'Opening message',author:{type:'admin',id:'staff-34',email:'staff34@example.test',external_id:'staff-external'}},conversation_parts:{type:'conversation_part.list',total_count:1,conversation_parts:[{id:'note-35',part_type:'note',body:'Private note',created_at:1704153660,author:{type:'teammate',id:'staff-36',email:'staff36@example.test',external_id:'note-external'}}]},tags:{type:'tag.list',tags:[{id:'tag-37',name:'Returns'}]}},
 macro:{type:'macro',id:'macro-38',name:'Greeting',body:'Hello Mara',visible_to:'everyone',available_on:['inbox'],created_at:'2024-01-01T00:00:00Z',updated_at:'2024-01-02T00:00:00Z'},
 article:{type:'article',id:'article-39',title:'Guide',body:'Guide text',body_markdown:'Guide text',state:'draft',created_at:1704067200,updated_at:1704153600},
});
export const zendeskRecords=()=>({
 user:{user:{id:31,role:'end-user',name:'Mara',email:'person31@example.test',external_id:'external-31',created_at:'2024-01-01T00:00:00Z'}},
 ticket:{ticket:{id:32,requester_id:31,subject:'Question',status:'open',created_at:'2024-01-02T00:00:00Z',updated_at:'2024-01-02T00:01:00Z',tags:['Returns'],comments:[{id:33,author_id:31,public:true,plain_body:'Opening message',created_at:'2024-01-02T00:00:00Z'}]}},
 macro:{macro:{id:38,title:'Greeting',restriction:null,actions:[{field:'comment_value',value:'Hello Mara'}],created_at:'2024-01-01T00:00:00Z',updated_at:'2024-01-02T00:00:00Z'}},
 article:{article:{id:39,title:'Guide',body:'Guide text',draft:true,user_segment_id:null,created_at:'2024-01-01T00:00:00Z',updated_at:'2024-01-02T00:00:00Z'}},
});
export const collectionNames=['contacts','conversations','data','articles','macros','companies','segments','unknown_collection'];
export const collisionValues=[[],[{type:'contact',id:'nested',email:'nested@example.test'}],null,0,'ordinary@example.test',{}];
export function recordPackages(record){return [
 ['root.json','\n'+JSON.stringify(record),''],
 ['line.jsonl','\n'+JSON.stringify(record),''],
 ['array.json','\n['+JSON.stringify(record)+']','/0'],
 ['list.json','\n'+JSON.stringify({type:'list',data:[record]}),'/data/0'],
 ['convenience.json','\n'+JSON.stringify({contacts:[record]}),'/contacts/0'],
 ];}
export const ambiguousRecords=()=>[
 [{...intercomRecords().contact,kind:'conversation'},'conflicting_record_discriminator','/kind'],
 [{...intercomRecords().contact,kind:'list',data:[]},'conflicting_record_discriminator','/kind'],
 [{...intercomRecords().contact,type:'list',kind:'contact',data:[]},'conflicting_record_discriminator','/kind'],
 [{...intercomRecords().contact,type:'unknown-record',kind:'contact',data:[]},'conflicting_record_discriminator','/kind'],
 [{...intercomRecords().contact,type:null},'invalid_record_discriminator','/type'],
 [{...intercomRecords().contact,kind:[]},'invalid_record_discriminator','/kind'],
 [{type:'list',id:'person-31',data:[]},'ambiguous_record_envelope','/id'],
 [{type:'list',data:{type:'contact',id:'person-31'}},'collection_must_be_array','/data'],
 [{contacts:null},'collection_must_be_array','/contacts'],
];
