import assert from 'node:assert/strict'
export const ticketOwner={email:'trailhead-owner@example.test',password:'synthetic-trailhead-owner-password',ownerName:'Alex Rivers',name:'Trailhead Outfitters'}
export async function seedTicketBrowser(origin,count=12,installation){
 const owner=installation?.owner||ticketOwner
 const request=async(path,body,token,method=body===undefined?'GET':'POST',headers={})=>{
  const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  const data=await response.json();assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data
 }
 const initial=installation?{projectId:installation.projectId}:await request('/api/identity/bootstrap',{...owner,allowedOrigin:origin}),login=await request('/api/identity/login',{email:owner.email,password:owner.password}),token=login.token,projectId=initial.projectId
 const api=(path,body,method)=>request(path,body,token,method),base=`/api/dashboard/projects/${projectId}`
 await api(`/api/management/projects/${projectId}/settings`,{name:owner.name,website:'https://trailhead-outfitters.example',timezone:'America/New_York'},'PUT')
 const project=await api(`/api/identity/projects/${projectId}`),me=(await api('/api/management/bootstrap')).currentAgent
 const group=(await api(base+'/ticket-groups',{name:'Returns & replacements',members:[me.id]})).data
 const shipping=(await api(base+'/ticket-groups',{name:'Shipping',members:[me.id]})).data
 const fields=[]
 for(const definition of [{name:'Order number',type:'regex',validation:{pattern:'^TO-[0-9]{5}$'}},{name:'Pairs',type:'number'},{name:'Refund amount',type:'decimal'},{name:'Needed by',type:'date'},{name:'Reason',type:'dropdown',options:['Damaged','Wrong size','Missing parcel']},{name:'Products',type:'multiselect',options:['Boots','Packs','Tents']},{name:'Expedite',type:'checkbox'},{name:'Customer context',type:'text'}])fields.push((await api(base+'/ticket-fields',definition)).data)
 const custom=(await api(base+'/ticket-statuses',{name:'Waiting for shipping label',category:'pending'})).data
 const people=[]
 for(let n=0;n<Math.min(30,Math.ceil(count/4));n++)people.push(await request('/api/identity/widget/session',{widgetKey:project.widget_key,name:['Dana Whitfield','Marcus Chen','Rosa Martinez','Priya Shah','Jordan Lee'][n%5]+(n>4?' '+n:''),email:`customer-${n}@trailhead.example.test`},undefined,'POST',{Origin:origin}))
 const tickets=[],tags=[]
 for(let n=0;n<count;n++){
  const person=people[n%people.length],created=await api('/api/conversations',{projectId,contactId:person.contactId})
  await request(`/api/conversations/${created.id}/messages`,{localId:'opening-'+n,content:`Order TO-${48213+n}: ${['the left boot has a torn seam','please change my delivery address','my replacement has not arrived','the size is too small'][n%4]}.`,expectedRevision:0},person.token)
  const status=n===0?custom.id:['new','open','pending','on_hold','solved','closed'][n%6]
  const ticket=(await api(`${base}/conversations/${created.id}/ticket`,{subject:['Replacement Ridgeline boots','Change delivery address','Replacement tracking','Boot size exchange'][n%4]+` · TO-${48213+n}`,status_id:status,priority:['urgent','normal','high','low'][n%4],group_id:n%2?shipping.id:group.id,agent_id:me.id,fields:Object.fromEntries(fields.map((field,index)=>[field.id,[`TO-${48213+n}`,1+n%3,129.95,'2026-10-24',['Damaged','Wrong size','Missing parcel'][n%3],['Boots',...(n%2?['Packs']:[])],n%3===0,'Customer leaves for a hiking trip on Saturday.'][index]]))},'PATCH')).data
  if(n===0)for(const name of ['Needs return label','Warranty','Delivery issue'])tags.push((await api(`${base}/conversations/${created.id}/tags`,{name})).data)
  else if(n%5===0&&status!=='closed')await api(`${base}/conversations/${created.id}/tags`,{tagId:tags[n%tags.length].id})
  tickets.push({...ticket,visitor:person})
 }
 return {projectId,base,api,fields,group,shipping,custom,tickets,tags,owner}
}
