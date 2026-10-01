import test from 'node:test'
import assert from 'node:assert/strict'
// delegation-sqlite.mjs registers the module resolver and exports the SQLite-backed D1; its own test is skipped here.
process.env.H2H_DELEGATION_RUNTIME='1'
const {sqliteDB,d1}=await import('./delegation-sqlite.mjs')
const {Hono}=await import('hono'),{consent}=await import('../src/edition/delegation/consent.ts'),{delegationDocument,delegationDocumentPolicy,delegationLoginRedirect,isDelegationDocument,protectDelegationDocument}=await import('../src/edition/delegation/document.ts'),{hashToken}=await import('../src/platform/auth.ts')

test('only GET and HEAD of the two delegation pages are dashboard documents', () => {
 const request=(path,method='GET')=>new Request('https://h2h.test'+path,{method})
 for(const path of ['/delegation/settings','/delegation/settings/','/delegation/authorize','/delegation/authorize?client_id=x'])assert.ok(isDelegationDocument(request(path)),path)
 assert.ok(isDelegationDocument(request('/delegation/settings','HEAD')))
 for(const [path,method] of [['/delegation/authorize','POST'],['/delegation/settings/revoke','POST'],['/delegation/settings/clients','POST'],['/delegation/settings/data','GET'],['/delegation/authorize/request','GET'],['/delegation/other','GET'],['/api/delegation/v1/token','POST']])assert.ok(!isDelegationDocument(request(path,method)),method+' '+path)
})

test('a delegation document without a current session redirects to sign in and keeps the way back', async () => {
 const db=sqliteDB(),DB=d1(db)
 try{
  const run=(sql,...args)=>DB.prepare(sql).bind(...args).run()
  await run("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Support','widget-p','https://customer.test',1)")
  await run("INSERT INTO users(id,email,name,created_at) VALUES('owner','owner@test.example','Owner',1)");await run("INSERT INTO memberships VALUES('p','owner','owner')")
  await run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',await hashToken('live-session'),'owner','p','owner',Date.now()+86400000)
  await run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',await hashToken('expired-session'),'owner','p','owner',Date.now()-1000)
  const gate=(cookie,path='/delegation/settings?account_id=p&x=1')=>delegationLoginRedirect(new Request('https://h2h.test'+path,{headers:cookie?{Cookie:'h2h_session='+cookie}:{}}),{DB})
  assert.equal(await gate('live-session'),null)
  for(const cookie of [undefined,'unknown-session','expired-session']){const redirect=await gate(cookie);assert.equal(redirect.status,303,String(cookie));assert.equal(redirect.headers.get('location'),'/login?returnTo='+encodeURIComponent('/delegation/settings?account_id=p&x=1'))}
 }finally{db.close()}
})

test('delegation documents are never cached or framed', async () => {
 const secured=protectDelegationDocument(new Response('<html></html>',{headers:{'Content-Type':'text/html'}}))
 assert.equal(secured.headers.get('Cache-Control'),'no-store');assert.equal(secured.headers.get('Content-Security-Policy'),"frame-ancestors 'none'");assert.equal(secured.headers.get('X-Frame-Options'),'DENY');assert.equal(await secured.text(),'<html></html>')
 assert.equal(protectDelegationDocument(new Response('',{headers:{'Content-Security-Policy':"default-src 'self'"}})).headers.get('Content-Security-Policy'),"default-src 'self'; frame-ancestors 'none'")
 assert.equal(protectDelegationDocument(new Response('',{headers:{'Content-Security-Policy':"frame-ancestors 'self'"}})).headers.get('Content-Security-Policy'),"frame-ancestors 'self'")
})

test('delegation documents carry a strict app-page policy with form-action limited to this origin and the registered callback', async () => {
 const db=sqliteDB(),DB=d1(db)
 try{
  const run=(sql,...args)=>DB.prepare(sql).bind(...args).run()
  await run("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Support','widget-p','https://customer.test',1)")
  await run("INSERT INTO users(id,email,name,created_at) VALUES('owner','owner@test.example','Owner',1)");await run("INSERT INTO memberships VALUES('p','owner','owner')")
  await run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',await hashToken('live-session'),'owner','p','owner',Date.now()+86400000)
  await run("INSERT INTO edition_clients(id,project_id,origin,redirect_uri,allow_loopback,enabled) VALUES('docs','p','https://docs.test','https://docs.test/callback',0,1),('off','p','https://off.test','https://off.test/callback',0,0)")
  const env={DB},directives=policy=>Object.fromEntries(policy.split(';').map(part=>part.trim().split(/\s+/)).map(([name,...values])=>[name,values.join(' ')]))
  const authorize=(client,redirect)=>new Request('https://h2h.test/delegation/authorize?'+new URLSearchParams({client_id:client,account_id:'p',redirect_uri:redirect}))
  const registered=directives(await delegationDocumentPolicy(authorize('docs','https://docs.test/callback'),env))
  assert.equal(registered['form-action'],"'self' https://docs.test");assert.equal(registered['base-uri'],"'self'");assert.equal(registered['object-src'],"'none'");assert.equal(registered['default-src'],"'self'");assert.equal(registered['connect-src'],"'self'")
  for(const [name,request] of [['a callback that is not the registered one',authorize('docs','https://evil.test/callback')],['an unknown client',authorize('nope','https://docs.test/callback')],['a disabled client',authorize('off','https://off.test/callback')],['the settings page',new Request('https://h2h.test/delegation/settings?account_id=p')],['a bare consent URL',new Request('https://h2h.test/delegation/authorize')]])
   assert.equal(directives(await delegationDocumentPolicy(request,env))['form-action'],"'self'",name)
  // The served document gets that policy, the framing denial and no-store, whatever the app renderer sent, and a signed-out request still goes to sign in.
  const served=await delegationDocument(new Request('https://h2h.test/delegation/authorize?'+new URLSearchParams({client_id:'docs',account_id:'p',redirect_uri:'https://docs.test/callback'}),{headers:{Cookie:'h2h_session=live-session'}}),env,undefined,async()=>new Response('<html></html>',{headers:{'Content-Type':'text/html'}}))
  const header=served.headers.get('Content-Security-Policy');assert.deepEqual({...directives(header)},{...registered,'frame-ancestors':"'none'"})
  assert.equal(served.headers.get('Cache-Control'),'no-store');assert.equal(served.headers.get('X-Frame-Options'),'DENY');assert.equal(await served.text(),'<html></html>')
  const signedOut=await delegationDocument(new Request('https://h2h.test/delegation/authorize'),env,undefined,async()=>{throw new Error('rendered without a session')})
  assert.equal(signedOut.status,303);assert.equal(signedOut.headers.get('Cache-Control'),'no-store')
 }finally{db.close()}
})

test('settings and consent page data re-check the session, project and role, and decisions land back in the app', async () => {
 const db=sqliteDB(),DB=d1(db)
 try{
  const run=(sql,...args)=>DB.prepare(sql).bind(...args).run(),one=(sql,...args)=>DB.prepare(sql).bind(...args).first()
  await run("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Support','widget-p','https://customer.test',1),('q','Other','widget-q','https://other.test',1)")
  await run("INSERT INTO users(id,email,name,created_at) VALUES('owner','owner@test.example','Owner Person',1),('operator','op@test.example','Operator',1),('outsider','out@test.example','Outsider',1)")
  await run("INSERT INTO memberships VALUES('p','owner','owner'),('p','operator','operator'),('q','outsider','owner')")
  for(const [token,user,project,role] of [['owner-session','owner','p','owner'],['operator-session','operator','p','operator'],['outsider-session','outsider','q','owner']])await run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',await hashToken(token),user,project,role,Date.now()+86400000)
  const app=new Hono().route('/delegation',consent),env={DB,RER_INSTALLATION_ID:'documents-installation'}
  const call=(path,{cookie,form,origin='https://h2h.test',environment=env}={})=>app.request('https://h2h.test'+path,{method:form?'POST':'GET',headers:{...(cookie?{Cookie:'h2h_session='+cookie}:{}),...(form?{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'}:{})},body:form?new URLSearchParams(form):undefined},environment)
  const client={account_id:'p',id:'docs',origin:'https://docs.test',redirect_uri:'https://docs.test/callback'}

  // Registering: the owner can, a duplicate is a distinct conflict, an operator cannot.
  assert.equal((await call('/delegation/settings/clients',{cookie:'owner-session',form:client})).status,303)
  const duplicate=await call('/delegation/settings/clients',{cookie:'owner-session',form:client});assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).error.code,'CLIENT_EXISTS')
  assert.equal((await call('/delegation/settings/clients',{cookie:'operator-session',form:{...client,id:'op'}})).status,403)

  // Settings data: the member's own project, parsed grants, and who may register.
  assert.equal((await call('/delegation/settings/data?account_id=p')).status,401)
  assert.equal((await call('/delegation/settings/data?account_id=p',{cookie:'outsider-session'})).status,403)
  assert.equal((await call('/delegation/settings/data',{cookie:'owner-session'})).status,400)
  const ownerResponse=await call('/delegation/settings/data?account_id=p',{cookie:'owner-session'});assert.equal(ownerResponse.headers.get('cache-control'),'no-store');assert.match(ownerResponse.headers.get('content-type'),/json/)
  const owner=(await ownerResponse.json()).data
  assert.deepEqual({project:owner.project,role:owner.role,canRegister:owner.canRegister,grants:owner.grants,clients:owner.clients},{project:'p',role:'owner',canRegister:true,grants:[],clients:[{id:'docs',origin:'https://docs.test',redirectUri:'https://docs.test/callback'}]})
  assert.equal((await (await call('/delegation/settings/data?account_id=p',{cookie:'operator-session'})).json()).data.canRegister,false)

  // Consent data is bound to the session; an approval redirects to the application, a cancel returns to Connected applications.
  const query=new URLSearchParams({client_id:'docs',account_id:'p',redirect_uri:client.redirect_uri,response_type:'code',state:'1e3',code_challenge:'a'.repeat(43),code_challenge_method:'S256',scope:'knowledge.article.read knowledge.article.update',targets:JSON.stringify(['projects/p/articles/a'])})
  assert.equal((await call('/delegation/authorize/request?'+query)).status,401)
  assert.equal((await call('/delegation/authorize/request?'+query,{cookie:'outsider-session'})).status,403)
  assert.equal((await call('/delegation/authorize/request?client_id=docs',{cookie:'owner-session'})).status,400)
  assert.equal((await call('/delegation/authorize/request?'+query,{cookie:'owner-session',environment:{DB}})).status,503)
  const page=async()=>(await (await call('/delegation/authorize/request?'+query,{cookie:'owner-session'})).json()).data
  const first=await page();assert.deepEqual(first.principal,{id:'owner',name:'Owner Person',email:'owner@test.example'});assert.deepEqual(first.project,{id:'p',name:'Support'});assert.deepEqual(first.request.scope,['knowledge.article.read','knowledge.article.update'])
  const decision=(data,decision,cookie='owner-session')=>call('/delegation/authorize',{cookie,form:{decision,request:JSON.stringify(data.request),issued:String(data.issued),csrf:data.csrf}})
  assert.equal((await decision(first,'approve','operator-session')).status,400,'another session cannot use the form')
  const approved=await decision(first,'approve');assert.equal(approved.status,303);const callback=new URL(approved.headers.get('location'));assert.equal(callback.origin+callback.pathname,client.redirect_uri);assert.equal(callback.searchParams.get('state'),'1e3');assert.ok(callback.searchParams.get('code'))
  const second=await page(),cancelled=await decision(second,'deny');assert.equal(cancelled.status,303);assert.equal(cancelled.headers.get('location'),'/delegation/settings?account_id=p&cancelled=1')
  assert.equal((await decision(second,'approve')).status,400,'a cancelled form cannot be approved later')
  assert.equal((await one("SELECT count(*) n FROM edition_grants WHERE project_id='p'")).n,1)
  const after=(await (await call('/delegation/settings/data?account_id=p',{cookie:'owner-session'})).json()).data
  assert.deepEqual(after.grants.map(g=>({clientId:g.clientId,scopes:g.scopes,targets:g.targets,revokedAt:g.revokedAt})),[{clientId:'docs',scopes:['knowledge.article.read','knowledge.article.update'],targets:['projects/p/articles/a'],revokedAt:null}])
 }finally{db.close()}
})
