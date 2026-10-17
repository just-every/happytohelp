import assert from 'node:assert/strict'

export async function ticketQueue(f){
 const {app,w,foreign,ok,call,get,patch,create}=f
 const ids=[]
 for(let i=0;i<37;i++){const id=await create(i+1);ids.push(id);await patch(id,{subject:`Order ${i}`,priority:i%2?'high':'normal',fields:{[f.fields[1].id]:i+1}})}
 const filters=[{field:'status_category',operator:'ne',value:'closed'},{field:'custom:'+f.fields[1].id,operator:'gte',value:1}],sort=[{field:'custom:'+f.fields[1].id,direction:'asc'}]
 const view=await ok('/ticket-views',{name:'Returns by pair count',visibility:'shared',filters,sort})
 const page=async n=>ok(`/conversations?saved_view=${view.id}&page=${n}`)
 const first=await page(1),second=await page(2)
 assert.equal(first.length,30);assert.equal(second.length,7)
 assert.deepEqual([...first,...second].map(t=>t.fields[f.fields[1].id]),Array.from({length:37},(_,i)=>i+1))
 const personal=await ok('/ticket-views',{name:'My urgent work',visibility:'personal',filters:[{field:'priority',operator:'eq',value:'urgent'}],sort:[]},'operator')
 assert.equal((await call('/ticket-views/'+personal.id)).status,404)
 assert.equal((await call('/ticket-views',{name:'Forbidden shared',visibility:'shared',filters:[],sort:[]},'operator')).status,403)
 const restricted=await ok('/ticket-views',{name:'Private address',visibility:'shared',filters:[{field:'custom:'+f.privateField.id,operator:'eq',value:'Dana private return address'}],sort:[]})
 const restrictedRead=(await call('/ticket-views/'+restricted.id,undefined,'operator')).data
 assert.ok(!JSON.stringify(restrictedRead).includes('Dana private return address'))
 assert.equal((await call(`/conversations?saved_view=${restricted.id}`,undefined,'operator')).status,403)
 const tag=await ok(`/conversations/${ids[3]}/tags`,{name:'Needs replacement'})
 const selected=await Promise.all(ids.slice(0,2).map(async id=>({id,expected_version:(await get(id)).ticket_version})))
 const stranger=(await app.ok('/api/identity/widget/session',{body:{widgetKey:foreign.widgetKey},headers:{Origin:foreign.allowedOrigin}}))
 const foreignTicket=await app.ok('/api/conversations',{body:{projectId:foreign.projectId},token:stranger.token})
 const body={tickets:[...selected,{id:foreignTicket.id,expected_version:0}],changes:{assigned_to:w.users.operator,priority:'urgent',status_id:'pending',add_tags:[tag.id]}}
 const before=(await get(ids[0])).priority
 const preview=await ok('/tickets/bulk/preview',body)
 assert.deepEqual(preview.results.map(r=>r.status),['ready','ready','forbidden']);assert.equal((await get(ids[0])).priority,before)
 await patch(ids[1],{subject:'Changed while preview was open'})
 const result=await ok('/tickets/bulk/apply',body)
 assert.deepEqual(result.results.map(r=>r.status),['applied','stale','forbidden'])
 assert.equal((await get(ids[0])).priority,'urgent');assert.equal((await get(ids[0])).status_category,'pending')
 assert.equal((await get(ids[1])).priority,'high');assert.equal((await app.first('SELECT status_category FROM conversations WHERE id=?',foreignTicket.id)).status_category,'new')
 assert.ok(await app.first('SELECT 1 FROM conversation_tags WHERE conversation_id=? AND tag_id=?',ids[0],tag.id))
 f.queueIds=ids
}
