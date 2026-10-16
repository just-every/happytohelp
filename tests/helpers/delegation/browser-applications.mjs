import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createRuntime} from '../emitted-runtime.mjs'
import {viewports} from '../../journeys/kit/browser.mjs'
import {challengeOf} from './applications.mjs'

const policyOf=header=>Object.fromEntries(header.split(';').map(part=>part.trim().split(/\s+/)).map(([name,...values])=>[name,values.join(' ')]))

// Connected applications in the emitted Worker and a real browser, end to end.
export async function applicationsBrowserJourney({runtime,browser,shot}){
 const origin=runtime.origin,tenant=await runtime.seedTenant({name:'Computers delegation',email:'owner@applications.test',allowedOrigin:origin}),projectId=tenant.projectId
 const context=await browser.newContext({viewport:viewports.desktop}),page=await context.newPage(),errors=[],closers=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error'&&/Content[ -]Security[ -]Policy|form-action|Refused to/i.test(message.text()))errors.push(message.text())})
 try{
  await context.addCookies([{name:'h2h_session',value:tenant.token,url:origin}])
  const cookie=`h2h_session=${tenant.token}`,shell=page.getByRole('navigation',{name:'Main navigation'})
  const created=await context.request.post(origin+`/api/knowledge/${projectId}/articles`,{data:{title:'Native guide',content:'Original public facts',summary:'Summary',status:'draft'}});assert.equal(created.status(),201)
  const articleId=(await created.json()).id,target=`projects/${projectId}/articles/${articleId}`

  // Registering in the application shell: a duplicate and a plain-HTTP address are reported, and the page fits a phone.
  const register=async(id,appOrigin,callback,loopback=true)=>{await page.getByLabel('Client identifier').fill(id);await page.getByLabel('Slate origin').fill(appOrigin);await page.getByLabel('Exact callback URL').fill(callback);await page.getByLabel('Allow loopback development')[loopback?'check':'uncheck']();await page.getByRole('button',{name:'Register client'}).click()}
  await page.goto(`${origin}/delegation/settings?account_id=${projectId}`);await page.getByRole('heading',{name:'Connected applications',level:1}).waitFor();await shell.waitFor()
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g,'')),'Times','the application stylesheet applies')
  assert.ok(await page.getByTestId('settings-menu').getByRole('link',{name:'Connected applications'}).isVisible())
  await register('slate',origin,origin+'/slate-callback');await page.getByText('slate —',{exact:false}).waitFor();assert.equal(await page.getByLabel('Client identifier').inputValue(),'')
  await register('slate',origin,origin+'/slate-callback');await page.getByRole('alert').filter({hasText:'already registered'}).waitFor()
  await page.getByLabel('Client identifier').fill('slate-http');await page.getByLabel('Allow loopback development').uncheck();await page.getByRole('button',{name:'Register client'}).click()
  await page.getByRole('alert').filter({hasText:'not accepted'}).waitFor();assert.equal(await page.getByText('slate-http —',{exact:false}).count(),0)
  await page.setViewportSize(viewports.mobile);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no horizontal scrolling at phone width');await page.setViewportSize(viewports.desktop)

  // The consent document: never cached or framed, and its forms may post only here and to the registered callback.
  const verifier='v'.repeat(64),challenge=await challengeOf(verifier)
  const consentUrl=(state,{client='slate',callback=origin+'/slate-callback',scope='knowledge.article.read knowledge.article.update knowledge.article.publish'}={})=>`${origin}/delegation/authorize?`+new URLSearchParams({client_id:client,redirect_uri:callback,response_type:'code',state,code_challenge:challenge,code_challenge_method:'S256',account_id:projectId,scope,targets:JSON.stringify([target])})
  const framing=await fetch(consentUrl('framing'),{headers:{Cookie:cookie}});assert.equal(framing.status,200)
  assert.match(framing.headers.get('cache-control'),/no-store/);assert.equal(framing.headers.get('x-frame-options'),'DENY')
  const policy=policyOf(framing.headers.get('content-security-policy'))
  assert.equal(policy['form-action'],`'self' ${origin}`);assert.equal(policy['frame-ancestors'],"'none'");assert.equal(policy['base-uri'],"'self'");assert.equal(policy['object-src'],"'none'");assert.equal(policy['default-src'],"'self'")
  assert.ok(!/\*|https?:\/\/(?!127\.0\.0\.1|localhost)/.test(framing.headers.get('content-security-policy')),'no wildcard or foreign source in the policy')
  const unregistered=await fetch(consentUrl('framing',{callback:origin+'/other-callback'}),{headers:{Cookie:cookie}});assert.match(unregistered.headers.get('content-security-policy'),/form-action 'self'(;|$)/,'an unregistered callback is never allowed')
  assert.equal((await fetch(consentUrl('anonymous').replace('/delegation/authorize?','/delegation/authorize/request?'))).status,401,'consent data needs the signed-in session')

  // Cancel returns to Connected applications; approval returns exactly the state the application sent.
  await page.goto(consentUrl('cancel-state'));await page.getByRole('heading',{name:'Connect to Slate',level:1}).waitFor();await shell.waitFor()
  const main=await page.locator('main').innerText();assert.match(main,new RegExp(articleId));assert.match(main,/Read help articles/);assert.match(main,/Edit help articles/)
  await page.screenshot({path:shot('consent-1440.png'),fullPage:true})
  await page.getByRole('button',{name:'Cancel'}).click();await page.waitForURL(/\/delegation\/settings\?/);await page.getByRole('status').filter({hasText:'Connection cancelled'}).waitFor()
  for(const state of ['1e3','007','a b&c=d']){await page.goto(consentUrl(state,{scope:'knowledge.article.read'}));await page.getByRole('button',{name:'Allow selected access'}).click();await page.waitForURL(/slate-callback\?code=/);assert.equal(new URL(page.url()).searchParams.get('state'),state)}

  // The application exchanges its single-use code, publishes the repair once, and the native editor and public help show it.
  await page.goto(consentUrl('publish-state'));await page.getByRole('button',{name:'Allow selected access'}).click();await page.waitForURL(/slate-callback\?code=/)
  const tokenBody={grant_type:'authorization_code',client_id:'slate',redirect_uri:origin+'/slate-callback',code:new URL(page.url()).searchParams.get('code'),code_verifier:verifier},exchange=body=>fetch(origin+'/api/delegation/v1/token',{method:'POST',body:new URLSearchParams(body)})
  assert.equal((await exchange({...tokenBody,redirect_uri:origin+'/slate-callback/extra'})).status,401)
  const exchanged=await exchange(tokenBody);assert.equal(exchanged.status,200);const accessToken=(await exchanged.json()).access_token;assert.equal((await exchange(tokenBody)).status,401)
  const api=(path,body)=>fetch(origin+'/api/delegation/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
  const current=await (await api('/evidence?target='+target)).json(),audience=await (await api('/audience?'+new URLSearchParams({target,operation:'happytohelp.article.update',intendedStatus:'published'}))).json()
  const effect={operationKey:'browser-repair',operation:'happytohelp.article.update',target,expectedRevision:current.revision,expectedAudienceRevision:audience.audienceRevision,content:{title:'Browser repaired article',content:'Exact repaired public facts',summary:'Repair summary',status:'published'}}
  const repair=await api('/effects',effect);assert.equal(repair.status,200,await repair.clone().text());assert.equal((await api('/effects',effect)).status,200)
  const publicRead=await fetch(origin+`/api/knowledge/public/${projectId}/articles/`+JSON.parse(current.text).slug);assert.equal(publicRead.status,200);assert.equal((await publicRead.json()).content,effect.content.content)
  await page.goto(`${origin}/projects/${projectId}/articles/${articleId}`);await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Browser repaired article'))

  // An application on another origin: its callback alone joins form-action, so the approval redirect completes.
  const remote=createServer((request,response)=>{response.setHeader('Content-Type','text/html');response.end('<title>Slate</title>callback reached')});closers.push(()=>new Promise(done=>{remote.closeAllConnections();remote.close(done)}))
  await new Promise(done=>remote.listen(0,'127.0.0.1',done));const remoteOrigin=`http://127.0.0.1:${remote.address().port}`,remoteCallback=remoteOrigin+'/callback'
  await page.goto(`${origin}/delegation/settings?account_id=${projectId}`);await register('slate-remote',remoteOrigin,remoteCallback);await page.getByText('slate-remote —',{exact:false}).waitFor()
  const remoteUrl=consentUrl('remote-state',{client:'slate-remote',callback:remoteCallback,scope:'knowledge.article.read'})
  assert.equal((await fetch(remoteUrl,{headers:{Cookie:cookie}})).headers.get('content-security-policy').match(/form-action ([^;]*)/)[1],`'self' ${remoteOrigin}`)
  await page.goto(remoteUrl);await page.getByRole('button',{name:'Allow selected access'}).click();await page.waitForURL(url=>url.href.startsWith(remoteCallback+'?code='));assert.equal(new URL(page.url()).searchParams.get('state'),'remote-state')
  assert.equal(await page.locator('body').innerText(),'callback reached')

  // Bare and invalid URLs are friendly pages in the shell; signed-out requests go to sign in and keep the way back.
  for(const [path,text] of [['/delegation/settings','Choose a workspace'],['/delegation/authorize','Nothing to approve'],['/delegation/authorize?client_id=unknown','incomplete']]){
   const response=await page.goto(origin+path);assert.match(response.headers()['content-type'],/text\/html/);await page.getByText(text,{exact:false}).first().waitFor();await shell.waitFor()
   assert.ok(!(await page.locator('body').innerText()).includes('"error"'),path+' shows no raw JSON')
  }
  await page.goto(origin+'/delegation/settings');await page.getByRole('link',{name:'Computers delegation'}).click();await page.getByRole('heading',{name:'Access you have granted'}).waitFor()
  for(const url of [`${origin}/delegation/settings?account_id=${projectId}`,consentUrl('signed-out')]){const bare=await fetch(url,{redirect:'manual'});assert.equal(bare.status,303);assert.match(decodeURIComponent(bare.headers.get('location')),/^\/login\?returnTo=\/delegation\//)}
  await page.goto(origin+'/delegation/authorize');const back=page.locator('main').getByRole('link',{name:'Back to the inbox'});await back.waitFor();await back.click();await page.waitForURL(/\/conversations/)
  await page.setViewportSize(viewports.mobile);await page.goto(consentUrl('phone'));await page.getByRole('button',{name:'Allow selected access'}).waitFor()
  const actions=await page.locator('.delegation-consent__actions .btn').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect()))
  assert.ok(actions.length===2&&actions.every(rect=>rect.height>=44&&rect.right<=390),'consent buttons are finger-sized and on screen at phone width');await page.screenshot({path:shot('consent-390.png'),fullPage:true});await page.setViewportSize(viewports.desktop)
  const anonymous=await browser.newContext(),anonymousPage=await anonymous.newPage();closers.push(()=>anonymous.close())
  await anonymousPage.goto(`${origin}/delegation/settings?account_id=${projectId}`);await anonymousPage.waitForURL(/\/login/);assert.match(decodeURIComponent(anonymousPage.url()),/returnTo=\/delegation\/settings\?account_id=/)

  // Revoking every grant in the shell ends the application's access.
  await page.goto(`${origin}/delegation/settings?account_id=${projectId}`);await page.getByRole('heading',{name:'slate',level:3}).first().waitFor()
  const revoke=page.getByRole('button',{name:'Revoke',exact:true})
  for(let count=await revoke.count();count>0;count--){await revoke.first().click();await page.waitForFunction(([selector,expected])=>[...document.querySelectorAll(selector)].filter(button=>button.textContent.trim()==='Revoke').length===expected,['button',count-1])}
  assert.equal((await api('/identity')).status,401);assert.equal((await api('/effects/browser-repair')).status,401)
  await page.screenshot({path:shot('revoked-1440.png'),fullPage:true})

  // Without an installation id, the consent screen explains that delegation is not set up.
  const plain=await createRuntime();closers.push(()=>plain.close(true))
  const plainTenant=await plain.seedTenant({name:'No installation',email:'owner@plain.test',allowedOrigin:plain.origin}),plainContext=await browser.newContext();closers.push(()=>plainContext.close())
  await plainContext.addCookies([{name:'h2h_session',value:plainTenant.token,url:plain.origin}]);const plainPage=await plainContext.newPage()
  await plainPage.goto(`${plain.origin}/delegation/authorize?`+new URLSearchParams({client_id:'slate',redirect_uri:plain.origin+'/slate-callback',response_type:'code',state:'unavailable',code_challenge:challenge,code_challenge_method:'S256',account_id:plainTenant.projectId,scope:'knowledge.article.read',targets:JSON.stringify([`projects/${plainTenant.projectId}/articles/x`])}))
  await plainPage.getByRole('alert').filter({hasText:'not set up'}).waitFor()
  assert.deepEqual(errors,[])
 }finally{await context.close();for(const close of closers.reverse())await close()}
}
