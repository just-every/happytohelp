export const root='/api/move-in/projects/p/imports';
export const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const person=(id='customer',email='customer@example.test')=>({type:'contact',id,email,created_at:1704067200});
export const article=(id='guide')=>({type:'article',id,title:'Moving guide',body:'<p>Keep this guide.</p>',state:'published',created_at:1704067200,updated_at:1704153600});
export const conversation=(id='thread',contactId='customer')=>({type:'conversation',id,state:'open',created_at:1704067200,updated_at:1704153600,channel:{initial:'messenger'},contacts:{type:'contact.list',contacts:[{id:contactId}]},source:{id:'opening',body:'Please help.',author:{type:'contact',id:contactId}},conversation_parts:{type:'conversation_part.list',conversation_parts:[]}});
export const uploadBody=(h,body,name='source.jsonl')=>h.call(`${root}?vendor=intercom`,{method:'POST',headers:{'X-Import-Filename':name,'X-Import-Schema':'2.16'},body});
export const upload=async(h,rows,name)=>(await uploadBody(h,rows.map(JSON.stringify).join('\n'),name)).data;
export const state=async(h,run)=>(await h.call(`${root}/${run.id}`)).data;
export async function apply(h,run){const reviewed=await state(h,run);await h.call(`${root}/${run.id}/apply`,json({fingerprint:reviewed.plan.fingerprint}));await h.drain();return state(h,run)}
export const replay=(h,rows)=>h.raw(`${root}?vendor=intercom`,{method:'POST',headers:{'X-Import-Filename':'different.jsonl','X-Import-Schema':'2.16'},body:rows.map(JSON.stringify).join('\n')});
