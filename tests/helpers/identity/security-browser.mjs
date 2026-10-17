import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createRuntime} from '../emitted-runtime.mjs'
import {evidence,viewports} from '../../journeys/kit/browser.mjs'
import {totp} from './two-factor.mjs'

const api=async(origin,path,{body,token,method}={})=>{
 const response=await fetch(origin+path,{method:method||(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)})
 const text=await response.text();let json;try{json=JSON.parse(text)}catch{}
 return {status:response.status,json,text}
}
const axe=await readFile(resolve('node_modules/axe-core/axe.min.js'),'utf8')

/**
 * The account-security screens in a real browser: an authenticator app and a passkey
 * (a virtual WebAuthn authenticator) on the profile, the two-factor sign-in page, the
 * step-up dialog on an export, Settings → Security, Security log and Roles, and a
 * collaborator's notes-only conversation. Every screen is axe-checked for serious
 * findings and horizontal overflow, and photographed at 1440 and 390.
 */
export async function securityBrowserJourney(browser){
 const shot=await evidence('account-security'),errors=[],records=[]
 const runtime=await createRuntime({vars:{INTEGRATION_ENCRYPTION_KEY:randomBytes(32).toString('base64')}})
 let passed=false,current
 try{
  // Passkeys bind to a domain name, so the browser uses localhost rather than 127.0.0.1.
  const origin=runtime.origin.replace('127.0.0.1','localhost'),password='owner-correct-horse-battery'
  const created=await api(origin,'/api/identity/bootstrap',{body:{name:'Lantern Works',ownerName:'Casey Owner',email:'casey@lantern.test',password,allowedOrigin:origin}});assert.equal(created.status,201,created.text)
  const projectId=created.json.projectId,P=`/projects/${projectId}`,widgetKey=(await api(origin,`/api/identity/projects/${projectId}`,{token:created.json.token})).json.widget_key
  const open=async(viewport,token)=>{
   const context=await browser.newContext({viewport,acceptDownloads:true});if(token)await context.addCookies([{name:'h2h_session',value:token,url:origin}])
   const page=await context.newPage();page.setDefaultTimeout(20000);current=page
   page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!/status of (4|5)\d\d/.test(message.text()))errors.push(message.text())})
   return page
  }
  const inspect=async(page,name)=>{
   await page.addScriptTag({content:axe})
   const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})))
   assert.deepEqual(violations,[],name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+': no horizontal overflow')
   await page.screenshot({path:shot(name+'.png'),fullPage:true});records.push({name,violations:violations.length})
  }

  // The owner turns on an authenticator app from the profile and keeps the recovery codes.
  const owner=await open(viewports.desktop,created.json.token)
  await owner.goto(origin+'/users/profile');await owner.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Security',exact:true}).click()
  await owner.getByRole('heading',{name:'Two-factor sign-in'}).waitFor();await inspect(owner,'profile-security-off-1440')
  await owner.getByRole('button',{name:'Add an authenticator app'}).click();await owner.getByRole('button',{name:'Set up an authenticator app'}).click()
  const secret=(await owner.getByTestId('totp-secret').innerText()).replace(/\s/g,'');await inspect(owner,'authenticator-setup-1440')
  await owner.getByLabel('Code from the app').fill(totp(secret));await owner.getByRole('button',{name:'Turn on'}).click()
  await owner.getByRole('heading',{name:'Save your recovery codes'}).waitFor();assert.equal(await owner.locator('.tf-code-list li').count(),10);await inspect(owner,'recovery-codes-1440')
  await owner.getByRole('button',{name:'Done'}).click()

  // A passkey from a virtual authenticator joins the app as a second factor.
  const cdp=await owner.context().newCDPSession(owner);await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}})
  await owner.getByRole('button',{name:'Add a passkey or security key'}).click();await owner.getByRole('button',{name:'Add a passkey or security key'}).click()
  await owner.getByRole('cell',{name:/Passkey or security key/}).waitFor();await inspect(owner,'profile-security-on-1440')

  // Signing in again stops at the second step; the passkey finishes it.
  await owner.evaluate(()=>fetch('/api/identity/session',{method:'DELETE'}));await owner.goto(origin+'/login')
  await owner.getByLabel('Email').fill('casey@lantern.test');await owner.getByLabel('Password').fill(password);await owner.getByRole('button',{name:'Login'}).click()
  await owner.waitForURL(url=>url.pathname==='/two-factor');await owner.getByRole('heading',{name:'Check it’s you'}).waitFor();await inspect(owner,'two-factor-verify-1440')
  await owner.getByRole('button',{name:'Use a passkey or security key'}).click();await owner.waitForURL(url=>url.pathname.startsWith(P))

  // An export after the step-up window asks again: the dialog takes the next authenticator code.
  await runtime.execute(`UPDATE session_factors SET verified_at=verified_at-${20*60*1000}`)
  await owner.goto(origin+P+'/security-log');await owner.getByRole('heading',{name:'Activity'}).waitFor();await inspect(owner,'security-log-1440')
  const download=owner.waitForEvent('download');await owner.getByRole('button',{name:'Export CSV'}).click()
  await owner.getByRole('dialog',{name:'Confirm it’s you'}).waitFor();await inspect(owner,'step-up-dialog-1440')
  await owner.getByRole('dialog').getByLabel('Code from your authenticator app').fill(totp(secret,1));await owner.getByRole('dialog').getByRole('button',{name:'Confirm'}).click()
  const csv=await readFile(await (await download).path(),'utf8');assert.match(csv,/two_factor\.enrolled/);assert.match(csv,/step_up\.required/)

  // Settings → Security: the owner requires two-factor for agents; Roles: a custom role.
  await owner.goto(origin+P+'/security');await owner.getByRole('heading',{name:'Two-factor sign-in'}).waitFor()
  await owner.getByLabel('Agents').check();await owner.getByRole('button',{name:'Save policy'}).click();await owner.getByRole('status').filter({hasText:'Saved'}).waitFor();await inspect(owner,'security-policy-1440')
  await owner.goto(origin+P+'/roles');await owner.getByRole('heading',{name:'Built-in roles'}).waitFor();await owner.getByRole('button',{name:'New role'}).click()
  await owner.getByLabel('Name').fill('Billing helper');await owner.getByLabel('Publish help articles').uncheck();await owner.getByRole('button',{name:'Create role'}).click()
  await owner.getByRole('heading',{name:'Billing helper'}).waitFor();await inspect(owner,'roles-1440')

  // A collaborator reads a customer's conversation, follows it and has notes instead of a reply box.
  const widget=await api(origin,'/api/identity/widget/session',{body:{widgetKey,name:'Riley Customer',email:'riley@example.test'}})
  const conversation=await api(origin,'/api/conversations',{body:{projectId},token:widget.json.token})
  await api(origin,`/api/conversations/${conversation.json.id}/messages`,{body:{localId:'riley-1',content:'Where is my order?',expectedRevision:0},token:widget.json.token})
  const unproven=await api(origin,`/api/management/projects/${projectId}/agents`,{body:{email:'casey.collab@lantern.test',role:'collaborator'},token:(await api(origin,'/api/identity/login',{body:{email:'casey@lantern.test',password}})).json.token})
  assert.equal(unproven.status,401,'a password-only owner session reaches nothing until its second factor')
  const steppedOwner=await owner.evaluate(async invitation=>(await fetch(invitation.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(invitation.body)})).json(),{path:`/api/management/projects/${projectId}/agents`,body:{email:'casey.collab@lantern.test',role:'collaborator'}})
  const token=new URL(steppedOwner.data.invitationUrl).searchParams.get('token')
  assert.equal((await api(origin,'/api/identity/accept-token',{body:{token,name:'Jordan Collaborator',password:'collab-correct-horse-battery'}})).status,200)
  const collaboratorLogin=await api(origin,'/api/identity/login',{body:{email:'casey.collab@lantern.test',password:'collab-correct-horse-battery'}})
  const collaborator=await open(viewports.desktop,collaboratorLogin.json.token)
  await collaborator.goto(origin+`${P}/conversations/${conversation.json.id}`);await collaborator.getByRole('note').filter({hasText:'add internal notes'}).waitFor()
  assert.equal(await collaborator.getByPlaceholder('Type your reply…').count(),0,'no reply box for a collaborator')
  assert.equal(await collaborator.getByRole('button',{name:'Close',exact:true}).count(),0,'no close button for a collaborator')
  await collaborator.getByRole('button',{name:'Follow',exact:true}).click();await collaborator.getByRole('button',{name:'Following'}).waitFor();await inspect(collaborator,'collaborator-conversation-1440')

  // The same screens at phone width.
  for(const [page,path,heading,name] of [[owner,'/users/profile',null,'profile-security'],[owner,P+'/security','Two-factor sign-in','security-policy'],[owner,P+'/security-log','Activity','security-log'],[owner,P+'/roles','Built-in roles','roles'],[collaborator,`${P}/conversations/${conversation.json.id}`,null,'collaborator-conversation']]){
   await page.setViewportSize(viewports.mobile);await page.goto(origin+path)
   if(name==='profile-security'){await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Security',exact:true}).click();await page.getByRole('heading',{name:'Two-factor sign-in'}).waitFor()}
   else if(heading)await page.getByRole('heading',{name:heading}).waitFor()
   // The phone conversation slides in; photograph it once it rests inside the screen.
   else await page.waitForFunction(()=>{const box=document.querySelector('.conversation-notes-only')?.getBoundingClientRect();return box&&box.left>=0&&box.right<=innerWidth})
   await inspect(page,name+'-390')
  }
  const phone=await open(viewports.mobile);await phone.goto(origin+'/login')
  await phone.getByLabel('Email').fill('casey@lantern.test');await phone.getByLabel('Password').fill(password);await phone.getByRole('button',{name:'Login'}).click()
  await phone.getByRole('heading',{name:'Check it’s you'}).waitFor();await inspect(phone,'two-factor-verify-390')
  await phone.goto(origin+'/owner-recovery');await phone.getByRole('heading',{name:'Recover owner access'}).waitFor();await inspect(phone,'owner-recovery-390')
  assert.deepEqual(errors,[],'no page or console errors')
  await writeFile(shot('proof.json'),JSON.stringify({screens:records},null,2))
  passed=true
 }catch(error){await current?.screenshot({path:shot('failure.png'),fullPage:true}).catch(()=>{});throw error}
 finally{await runtime.close(passed)}
}
