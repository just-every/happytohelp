import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {chromium} from 'playwright'
import {startDelegationWorker} from './helpers/delegation-worker.mjs'
/**
 * Local computers and delegation in the real emitted Worker and browser: the Connect computer dialog is styled
 * outside the inbox, an authorization decision shows its outcome, and Connected applications and the consent
 * screen render in the application shell with friendly errors. The security model is exercised by
 * delegation-browser.mjs and delegation-scoped-browser.mjs; this suite checks that it still holds here.
 * H2H_TEST_PORT fixes the ports used: P (app), P+1 (inspector), P+2 (app without an installation), P+3 (inspector).
 */
const base=Number(process.env.H2H_TEST_PORT)||0
const workers=[];let browser,success=false
const checks=[]
const check=(name)=>checks.push(name)
const challenge=async verifier=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url')
try{
 const app=await startDelegationWorker({port:base});workers.push(app)
 const plain=await startDelegationWorker({port:base?base+2:0,installation:false});workers.push(plain)
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error'&&/Content[ -]Security[ -]Policy|form-action|Refused to/i.test(message.text()))errors.push(message.text())})
 const projectId=await app.bootstrapOwner(context,'Computers delegation')
 const shell=page.getByRole('navigation',{name:'Main navigation'})

 // Connect computer dialog: styled on the Local computers page, which is not the inbox.
 for(const [name,size] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(size);await page.goto(`${app.origin}/projects/${projectId}/local-agent`)
  await page.getByRole('button',{name:'Connect computer'}).click();await page.locator('.delegation-setup-modal').waitFor();await page.waitForTimeout(600)
  const dialog=await page.evaluate(()=>{const style=(selector,property)=>{const element=document.querySelector(selector);return element?getComputedStyle(element)[property]:null}
   return {bodyClass:document.body.className,listStyle:style('.delegation-setup-steps','listStyleType'),stepDisplay:style('.delegation-setup-step','display'),numberWidth:parseFloat(style('.delegation-setup-step__number','width')),providerBorder:style('.delegation-provider-options button','borderStyle'),providerDisplay:style('.delegation-provider-options button','display'),inputWidth:parseFloat(style('.delegation-provider-picker input','width')),inputBorder:style('.delegation-provider-picker input','borderStyle'),modalWidth:document.querySelector('.delegation-setup-modal .modal-content').getBoundingClientRect().width,providerText:document.querySelector('.delegation-provider-options').innerText}})
  assert.ok(!dialog.bodyClass.includes('conversation-workspace'),`the Local computers page is not the inbox (${name})`)
  assert.equal(dialog.listStyle,'none',`step list has no browser numbering (${name})`)
  assert.equal(dialog.stepDisplay,'grid');assert.ok(dialog.numberWidth>=20&&dialog.numberWidth<=32,`step badge is a compact circle (${name}: ${dialog.numberWidth})`)
  assert.equal(dialog.providerDisplay,'grid');assert.notEqual(dialog.providerBorder,'outset','provider choices are not raw browser buttons')
  assert.equal(dialog.inputBorder,'solid');assert.ok(dialog.inputWidth>=dialog.modalWidth*.6,`Computer name fills the dialog (${name}: ${dialog.inputWidth} of ${dialog.modalWidth})`)
  assert.match(dialog.providerText,/Codex\s+Recommended/);assert.match(dialog.providerText,/Claude\s+Alternate/)
  await page.screenshot({path:`${process.env.H2H_EVIDENCE_DIR||'/tmp'}/computers-dialog-${name}.png`}).catch(()=>{})
  await page.keyboard.press('Escape');await page.locator('.delegation-setup-modal').waitFor({state:'detached'})
 }
 check('Connect computer dialog styled on /local-agent at desktop and mobile widths')
 await page.setViewportSize({width:1440,height:900})

 // Authorize a computer: a recorded decision is shown and the code cannot be sent again.
 const device=async n=>(await (await context.request.post(app.origin+'/api/local-agents/device-authorizations',{data:{name:'Computer '+n,client_session_id:'pages-'+n,capabilities:[]}})).json()).data
 const exchange=async d=>context.request.post(app.origin+'/api/local-agents/device-authorizations/token',{data:{device_code:d.device_code}})
 const approved=await device('approve');await page.goto(`${app.origin}/local-agent/authorize?user_code=${approved.user_code}`)
 const code=page.getByLabel('Authorization code');assert.equal(await code.inputValue(),approved.user_code)
 await page.getByRole('button',{name:'Approve',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Computer approved'}).waitFor();assert.match(await page.getByRole('status').filter({hasText:'Computer approved'}).innerText(),new RegExp(approved.user_code))
 assert.equal(await code.inputValue(),'');assert.ok(await page.getByRole('button',{name:'Approve',exact:true}).isDisabled());assert.ok(await page.getByRole('button',{name:'Deny',exact:true}).isDisabled())
 assert.equal((await exchange(approved)).status(),200,'the server recorded the approval')
 const denied=await device('deny');await code.fill(denied.user_code);await page.getByRole('button',{name:'Deny',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Request denied'}).waitFor();assert.equal(await code.inputValue(),'');assert.equal((await exchange(denied)).status(),403,'the server recorded the denial')
 await code.fill(approved.user_code);await page.getByRole('button',{name:'Approve',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'not valid'}).waitFor();assert.equal(await page.getByRole('status').filter({hasText:'Computer approved'}).count(),0,'a failed attempt clears the previous outcome')
 check('authorize approve and deny show the recorded outcome, clear the code and report an unusable code')

 // Connected applications render in the application shell.
 await page.goto(`${app.origin}/delegation/settings?account_id=${projectId}`);await page.getByRole('heading',{name:'Connected applications',level:1}).waitFor()
 await shell.waitFor();assert.ok(await page.evaluate(()=>document.styleSheets.length>0),'the page loads the application stylesheet')
 assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g,'')),'Times');assert.ok(await shell.getByRole('link',{name:'Connected applications'}).isVisible())
 await page.getByLabel('Client identifier').fill('pages-slate');await page.getByLabel('Slate origin').fill(app.origin);await page.getByLabel('Exact callback URL').fill(app.origin+'/pages-callback');await page.getByLabel('Allow loopback development').check();await page.getByRole('button',{name:'Register client'}).click()
 await page.getByText('pages-slate —',{exact:false}).waitFor();assert.equal(await page.getByLabel('Client identifier').inputValue(),'')
 await page.getByLabel('Client identifier').fill('pages-slate');await page.getByLabel('Slate origin').fill(app.origin);await page.getByLabel('Exact callback URL').fill(app.origin+'/pages-callback');await page.getByLabel('Allow loopback development').check();await page.getByRole('button',{name:'Register client'}).click()
 await page.getByRole('alert').filter({hasText:'already registered'}).waitFor()
 await page.getByLabel('Client identifier').fill('pages-http');await page.getByLabel('Allow loopback development').uncheck();await page.getByRole('button',{name:'Register client'}).click()
 await page.getByRole('alert').filter({hasText:'not accepted'}).waitFor();assert.equal(await page.getByText('pages-http —',{exact:false}).count(),0)
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no horizontal scrolling at phone width');await page.setViewportSize({width:1440,height:900})
 check('Connected applications in the shell: styled, registers a client, reports a duplicate and a rejected address, fits a phone')

 // Consent screen: in the shell, cancel returns to Connected applications, approve redirects with the exact state.
 const verifier='v'.repeat(64),query=state=>new URLSearchParams({client_id:'pages-slate',redirect_uri:app.origin+'/pages-callback',response_type:'code',state,code_challenge:'',code_challenge_method:'S256',account_id:projectId,scope:'knowledge.article.read knowledge.article.update',targets:JSON.stringify([`projects/${projectId}/articles/page-article`])})
 const consentUrl=async state=>{const q=query(state);q.set('code_challenge',await challenge(verifier));return `${app.origin}/delegation/authorize?${q}`}
 const framing=await fetch(await consentUrl('framing'),{headers:{Cookie:(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ')}})
 assert.equal(framing.status,200);assert.match(framing.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(framing.headers.get('cache-control'),/no-store/);assert.equal(framing.headers.get('x-frame-options'),'DENY')
 const policy=Object.fromEntries(framing.headers.get('content-security-policy').split(';').map(part=>part.trim().split(/\s+/)).map(([name,...values])=>[name,values.join(' ')]))
 assert.equal(policy['form-action'],`'self' ${app.origin}`,'a form can only post to this origin and the registered callback');assert.equal(policy['base-uri'],"'self'");assert.equal(policy['object-src'],"'none'");assert.equal(policy['default-src'],"'self'");assert.equal(policy['frame-ancestors'],"'none'")
 assert.ok(!/\*|https?:\/\/(?!127\.0\.0\.1|localhost)/.test(framing.headers.get('content-security-policy')),'no wildcard or foreign source in the policy')
 const unregistered=await fetch((await consentUrl('framing')).replace('pages-callback','other-callback'),{headers:{Cookie:(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ')}})
 assert.equal(unregistered.status,200);assert.match(unregistered.headers.get('content-security-policy'),/form-action 'self'(;|$)/,'an unregistered callback is never added to form-action')
 assert.equal((await fetch((await consentUrl('anonymous')).replace('/delegation/authorize?','/delegation/authorize/request?'))).status,401,'the consent data needs the signed-in session')
 await page.goto(await consentUrl('cancel-state'));await page.getByRole('heading',{name:'Connect to Slate',level:1}).waitFor();await shell.waitFor()
 const main=await page.locator('main').innerText();assert.match(main,/page-article/);assert.match(main,/Read help articles/);assert.match(main,/Edit help articles/)
 await page.getByRole('button',{name:'Cancel'}).click();await page.waitForURL(/\/delegation\/settings\?/);await page.getByRole('status').filter({hasText:'Connection cancelled'}).waitFor();await shell.waitFor()
 for(const state of ['1e3','007','a b&c=d']){
  await page.goto(await consentUrl(state));await page.getByRole('button',{name:'Allow selected access'}).click();await page.waitForURL(/pages-callback\?code=/)
  assert.equal(new URL(page.url()).searchParams.get('state'),state,'the application receives exactly the state it sent')
 }
 await page.goto(`${app.origin}/delegation/settings?account_id=${projectId}`);await page.getByRole('heading',{name:'pages-slate',level:3}).first().waitFor()
 const revoke=page.getByRole('button',{name:'Revoke',exact:true});assert.equal(await revoke.count(),3);await revoke.first().click();await page.getByText('revoked',{exact:true}).waitFor();assert.equal(await revoke.count(),2)
 check('consent screen in the shell: cancel returns to settings, approve redirects with the exact state, revoke is recorded')

 // An application on another origin: the browser enforces form-action on the redirect that ends an approval, so the
 // registered callback origin must be allowed on the consent page (and only there) for the connection to complete.
 const remote=createServer((request,response)=>{response.setHeader('Content-Type','text/html');response.end('<title>Slate</title>callback reached')});workers.push({stop:async()=>{remote.closeAllConnections();await new Promise(done=>remote.close(done))}})
 await new Promise(done=>remote.listen(base?base+4:0,'127.0.0.1',done))
 const remoteOrigin=`http://127.0.0.1:${remote.address().port}`,remoteCallback=remoteOrigin+'/callback'
 await page.goto(`${app.origin}/delegation/settings?account_id=${projectId}`);await page.getByLabel('Client identifier').fill('pages-remote');await page.getByLabel('Slate origin').fill(remoteOrigin);await page.getByLabel('Exact callback URL').fill(remoteCallback);await page.getByLabel('Allow loopback development').check();await page.getByRole('button',{name:'Register client'}).click();await page.getByText('pages-remote —',{exact:false}).waitFor()
 const remoteUrl=new URL(await consentUrl('remote-state'));remoteUrl.searchParams.set('client_id','pages-remote');remoteUrl.searchParams.set('redirect_uri',remoteCallback)
 const remoteHeaders=await fetch(remoteUrl,{headers:{Cookie:(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ')}});assert.equal(remoteHeaders.headers.get('content-security-policy').match(/form-action ([^;]*)/)[1],`'self' ${remoteOrigin}`)
 await page.goto(remoteUrl.toString());await page.getByRole('button',{name:'Allow selected access'}).click();await page.waitForURL(url=>url.href.startsWith(remoteCallback+'?code='));assert.equal(new URL(page.url()).searchParams.get('state'),'remote-state','the cross-origin redirect after approval is not blocked by form-action')
 assert.equal(await page.locator('body').innerText(),'callback reached')
 check('consent policy: form-action is this origin plus the registered callback only; a cross-origin approval redirect completes without a CSP violation')

 // Bare and invalid URLs are friendly pages, not JSON.
 for(const [path,text] of [['/delegation/settings','Choose a workspace'],['/delegation/authorize','Nothing to approve'],['/delegation/authorize?client_id=unknown','incomplete']]){
  const response=await page.goto(app.origin+path);assert.match(response.headers()['content-type'],/text\/html/);await page.getByText(text,{exact:false}).first().waitFor();await shell.waitFor()
  assert.ok(!(await page.locator('body').innerText()).includes('"error"'),path+' shows no raw JSON')
 }
 await page.goto(app.origin+'/delegation/settings');await page.getByRole('link',{name:'Computers delegation'}).click();await page.getByRole('heading',{name:'Access you have granted'}).waitFor()
 const plainContext=await browser.newContext(),plainPage=await plainContext.newPage(),plainProject=await plain.bootstrapOwner(plainContext,'No installation')
 const plainQuery=query('unavailable');plainQuery.set('account_id',plainProject);plainQuery.set('targets',JSON.stringify([`projects/${plainProject}/articles/x`]))
 await plainPage.goto(`${plain.origin}/delegation/authorize?${plainQuery}`);await plainPage.getByRole('alert').filter({hasText:'not set up'}).waitFor()
 for(const path of [`/delegation/settings?account_id=${projectId}`,await consentUrl('signed-out')]){const bare=await fetch(path.startsWith('http')?path:app.origin+path,{redirect:'manual'});assert.equal(bare.status,303,'a request with no session is redirected before any page loads');assert.match(decodeURIComponent(bare.headers.get('location')),/^\/login\?returnTo=\/delegation\//)}
 await page.goto(app.origin+'/delegation/authorize');const back=page.locator('main').getByRole('link',{name:'Back to the inbox'});await back.waitFor();await back.click();await page.waitForURL(/\/conversations/)
 await page.setViewportSize({width:390,height:844});await page.goto(await consentUrl('phone'));await page.getByRole('button',{name:'Allow selected access'}).waitFor();const phoneActions=await page.locator('.delegation-consent__actions .btn').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect()));assert.ok(phoneActions.length===2&&phoneActions.every(r=>r.height>=44&&r.right<=390),'consent buttons are finger-sized and on screen at phone width');await page.setViewportSize({width:1440,height:900})
 const anonymous=await browser.newContext(),anonymousPage=await anonymous.newPage();await anonymousPage.goto(`${app.origin}/delegation/settings?account_id=${projectId}`);await anonymousPage.waitForURL(/\/login/);assert.match(decodeURIComponent(anonymousPage.url()),/returnTo=\/delegation\/settings\?account_id=/)
 check('bare, invalid, unavailable and signed-out delegation URLs give friendly pages or the login redirect')

 assert.deepEqual(errors,[]);success=true
 console.log(JSON.stringify({passed:true,checks,origin:app.origin}))
}finally{await browser?.close();for(const worker of workers)await worker.stop(success)}
