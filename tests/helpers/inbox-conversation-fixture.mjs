// Fixture for the inbox/conversation browser regression: an owner, contacts and conversations built through the real HTTP APIs.
export const OWNER={email:'inbox-owner@example.test',password:'synthetic-inbox-conversation-test-2026',name:'Inbox Owner',ownerName:'Alex Rivers'}
export const REPLY={title:'Replacement buckle approved',content:'Hi {{contact.name}}, a black replacement buckle is approved for express dispatch tomorrow. — {{agent.name}}'}

export async function buildInboxFixture(origin){
 const call=async(path,body,token,method=body===undefined?'GET':'POST',headers={})=>{
  const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  const text=await response.text()
  if(!response.ok)throw new Error(`${method} ${path}: ${response.status} ${text}`)
  return JSON.parse(text)
 }
 const initial=await call('/api/identity/bootstrap',{...OWNER,password:OWNER.password,allowedOrigin:origin})
 const token=(await call('/api/identity/login',{email:OWNER.email,password:OWNER.password})).token
 const projectId=initial.projectId
 const project=await call(`/api/identity/projects/${projectId}`,undefined,token)
 let counter=0
 const conversation=async({name,email,subject,closed=false})=>{
  const session=await call('/api/identity/widget/session',{widgetKey:project.widget_key,name,email},undefined,'POST',{Origin:origin})
  const created=await call('/api/conversations',{projectId},session.token)
  await call(`/api/conversations/${created.id}/messages`,{localId:`inbox-fixture-${++counter}`,content:subject,expectedRevision:0},session.token)
  if(closed)await call(`/api/dashboard/projects/${projectId}/conversations/${created.id}`,{resolved:true},token,'PUT')
  return {id:created.id,name,email}
 }
 const contacts={
  percent:await conversation({name:'Rate 100% Rhea',email:'rhea.rate@percentco.test',subject:'Need a quote for the annual plan'}),
  under:await conversation({name:'snake_case Sam',email:'sam.snake@underscoreco.test',subject:'Webhook retries are failing'}),
  kenji:await conversation({name:'Kenji Watanabe',email:'kenji.watanabe@harborworks.test',subject:'Billing address change needed'}),
  tokyo:await conversation({name:'Tokyo Tess',email:'tess.tanaka@tokyoworks.test',subject:'Our office hours are in Japan'}),
  alpha:await conversation({name:'Row Alpha',email:'row.alpha@rowtest.test',subject:'Row control keyboard test'}),
  beta:await conversation({name:'Row Beta',email:'row.beta@rowtest.test',subject:'Row control touch test'}),
  assign:await conversation({name:'Assign Test',email:'assign.test@assigntest.test',subject:'Assignment menu test'}),
  draft:await conversation({name:'Maya Chen',email:'draft.test@drafttest.test',subject:'Saved reply draft test'}),
  reopen:await conversation({name:'Hannah Closed',email:'hannah.closed@fjordworks.test',subject:'Invoice reminder resolved last week',closed:true}),
 }
 await call(`/api/dashboard/projects/${projectId}/macros`,REPLY,token)
 const api=(path,{method,body}={})=>call(path,body,token,method)
 return {projectId,contacts,api,owner:OWNER}
}
