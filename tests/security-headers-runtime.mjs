import assert from 'node:assert/strict'
import {createRuntime} from './helpers/emitted-runtime.mjs'

// Emitted Worker: operator documents and APIs refuse foreign framing; the customer
// widget, its CORS API and published Help Center pages keep working on customer sites.
const runtime=await createRuntime();let success=false
const customer='https://customer.example.test'
const application=(response,label)=>{
 assert.equal(response.headers.get('content-security-policy'),"frame-ancestors 'self'",label)
 assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN',label)
 assert.equal(response.headers.get('x-content-type-options'),'nosniff',label)
 assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin',label)
}
const unframed=(response,label)=>{
 assert.equal(response.headers.get('content-security-policy'),null,label)
 assert.equal(response.headers.get('x-frame-options'),null,label)
}
try{
 const {origin}=runtime
 const call=(path,{body,token,method=body===undefined?'GET':'POST',headers={}}={})=>fetch(origin+path,{method,redirect:'manual',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
 for(const path of ['/','/login','/setup','/docs','/docs/install']){const response=await call(path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/text\/html/,path);application(response,path)}
 const created=await call('/api/identity/bootstrap',{body:{password:'security-header-password-123',name:'Header project',email:'header-owner@example.com',allowedOrigin:customer},headers:{Origin:origin}})
 assert.equal(created.status,201);application(created,'bootstrap API')
 const owner=await created.json()
 const dashboard=await call(`/projects/${owner.projectId}/conversations`,{headers:{Cookie:created.headers.get('set-cookie').split(';')[0]}})
 assert.equal(dashboard.status,200);assert.match(dashboard.headers.get('content-type'),/text\/html/);application(dashboard,'dashboard document')
 const session=await call('/api/identity/session',{token:owner.token});assert.equal(session.status,200);application(session,'session API')
 const denied=await call('/api/identity/session');assert.equal(denied.status,401);application(denied,'rejected API')
 const health=await call('/health');assert.equal(health.status,200);application(health,'health')
 const missing=await call('/this-document-does-not-exist');assert.equal(missing.status,404);application(missing,'missing document')
 const missingDocs=await call('/docs/does-not-exist');assert.equal(missingDocs.status,404);assert.match(missingDocs.headers.get('content-type'),/text\/html/);application(missingDocs,'missing docs page')

 // Customer widget: static script plus cross-origin API with its CORS contract intact.
 const script=await call('/widget.js');assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);unframed(script,'widget.js')
 const project=await(await call('/api/identity/projects/'+owner.projectId,{token:owner.token})).json()
 const preflight=await call('/api/identity/widget/session',{method:'OPTIONS',headers:{Origin:customer,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}})
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),customer)
 const contact=await call('/api/identity/widget/session',{body:{widgetKey:project.widget_key},headers:{Origin:customer}})
 assert.equal(contact.status,201);assert.equal(contact.headers.get('access-control-allow-origin'),customer);assert.equal(contact.headers.get('x-content-type-options'),'nosniff')
 const {token:contactToken}=await contact.json();assert.ok(contactToken)
 const foreign=await call('/api/identity/widget/session',{body:{widgetKey:project.widget_key},headers:{Origin:'https://foreign.example.test'}})
 assert.equal(foreign.status,403);assert.equal(foreign.headers.get('access-control-allow-origin'),null)

 // Published Help Center pages remain embeddable; preview paths keep their own policy.
 for(const path of [`/help/${owner.projectId}`,`/${owner.projectId}`,`/${owner.projectId}/search?keyword=help`]){
  const response=await call(path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/text\/html/,path);unframed(response,path)
  assert.equal(response.headers.get('x-content-type-options'),'nosniff',path);assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin',path)
 }
 const preview=await call(`/preview/${owner.projectId}/not-a-grant/`);assert.equal(preview.status,404);unframed(preview,'preview on app origin')
 success=true
 console.log('Security headers passed: /, /login, /setup, /docs, /docs/install, dashboard document, APIs, health, the 404 and the docs 404 carry frame-ancestors/X-Frame-Options/nosniff/Referrer-Policy; widget script, widget CORS API, published Help Center and preview remain embeddable.')
}finally{await runtime.close(success)}
