// Hand-authored records and expected identities for envelope/archive corrections.
export const records=()=>({
 contact:{type:'contact',id:'envelope-person',name:'Nadia',email:'nadia@example.test',external_id:'customer-archive',created_at:1711929600},
 conversation:{type:'conversation',id:'envelope-thread',state:'closed',created_at:1712016000,updated_at:1712016600,channel:{initial:'messenger'},contacts:{type:'contact.list',contacts:[{type:'contact',id:'envelope-person'}]},source:{type:'messenger',id:'opening',body:'Where is my parcel?',author:{type:'contact',id:'envelope-person'}},conversation_parts:{type:'conversation_part.list',total_count:2,conversation_parts:[{id:'reply',part_type:'comment',body:'It arrives tomorrow.',created_at:1712016300,author:{type:'admin',id:'courier-agent',email:'courier@example.test',external_id:'agent-archive'}},{id:'note',part_type:'note',body:'Checked tracking.',created_at:1712016600,author:{type:'admin',id:'courier-agent'}}]},tags:{type:'tag.list',tags:[{id:'delivery-tag',name:'Delivery'}]}},
 macro:{type:'macro',id:'envelope-reply',name:'Delivery reply',body:'Your parcel is on its way.',visible_to:'everyone',available_on:['inbox'],created_at:'2024-04-01T00:00:00Z',updated_at:'2024-04-02T00:00:00Z'},
 article:{type:'article',id:'envelope-guide',title:'Delivery guide',body:'Track your parcel.',state:'published',created_at:1711929600,updated_at:1712016000},
});
export const encode=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
export function positions(record){return [
 ['root.json','\n'+JSON.stringify(record),''],
 ['root.jsonl','\n'+JSON.stringify(record),''],
 ['array.json','\n'+JSON.stringify([record]),'/0'],
 ['list.json','\n'+JSON.stringify({type:'list',data:[record]}),'/data/0'],
 ['convenience.json','\n'+JSON.stringify({contacts:[record]}),'/contacts/0'],
 ['foreign-list.json','\n'+JSON.stringify({type:'list',results:[record]}),'/results/0'],
 ['foreign-one.json','\n'+JSON.stringify({type:'list',result:record}),'/result'],
 ['foreign-line.jsonl','\n'+JSON.stringify({kind:'list',results:[record]}),'/results/0'],
 ['foreign-convenience.json','\n'+JSON.stringify({results:[record]}),'/results/0'],
 ];}
