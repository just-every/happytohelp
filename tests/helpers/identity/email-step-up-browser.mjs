import assert from 'node:assert/strict'
import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRuntime} from '../emitted-runtime.mjs'
import {freePort} from '../../first-run/browser-kit.mjs'
import {evidence,viewports} from '../../journeys/kit/browser.mjs'

/** An email-claimed owner uses the real dialog, mailbox link, exports and first-password form. */
export async function emailStepUpBrowserJourney(browser,{oldRuntimeFactory}={}){
 const shot=await evidence(oldRuntimeFactory?'email-step-up-upgrade':'email-step-up')
 for(const [name,viewport] of Object.entries(viewports)){
  const port=await freePort(),origin=`http://127.0.0.1:${port}`,email='maya.roberts@example.test',marker='Order 4821 needs the corrected receipt '+viewport.width
  const state=oldRuntimeFactory?await mkdtemp(join(tmpdir(),'h2h-email-upgrade-')):undefined
  const options={port,...(state?{persist:state}:{}),vars:{APP_ORIGIN:origin,OWNER_EMAIL:email,H2H_SETUP_TOKEN:'synthetic-browser-owner-claim',EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'synthetic-mail-edge-key',EMAIL_FROM:'support@example.test'},outboundFixture:new URL('./step-up-mail-edge.mjs',import.meta.url).href}
  const context=await browser.newContext({viewport,acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(20000)
  let passed=false,held,runtime
  try{
   if(oldRuntimeFactory){
    const previous=await oldRuntimeFactory(options)
    try{
     const claim=await context.request.post(origin+'/auth/bootstrap',{data:{token:'synthetic-browser-owner-claim'},maxRedirects:0,headers:{Origin:origin}});assert.equal(claim.status(),303)
     const actor=await (await context.request.get(origin+'/api/identity/session')).json()
     await page.goto(origin+'/users/profile');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Security',exact:true}).click();await page.getByLabel('Current password',{exact:true}).waitFor();await page.screenshot({path:shot('before-'+name+'-unknown-password.png'),fullPage:true})
     await previous.execute(`UPDATE session_factors SET verified_at=verified_at-1200000 WHERE user_id='${actor.id}'`)
     await page.goto(origin+`/projects/${actor.projectId}/reports`);await page.getByRole('button',{name:'Conversations CSV',exact:true}).click();await page.getByLabel('Your password',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).count(),0);await page.screenshot({path:shot('before-'+name+'-password-only.png'),fullPage:true})
    }finally{await previous.close(true)}
   }
   runtime=await createRuntime(options)
   if(!oldRuntimeFactory){const claim=await context.request.post(origin+'/auth/bootstrap',{data:{token:'synthetic-browser-owner-claim'},maxRedirects:0,headers:{Origin:origin}});assert.equal(claim.status(),303)}
   if(oldRuntimeFactory){
    const profile=await (await context.request.get(origin+'/api/management/profile')).json();assert.equal(profile.data.has_password,1,'the old claim credential survives the upgrade');assert.equal(profile.data.mailbox_confirmed,false);assert.equal((await (await context.request.get(origin+'/api/identity/two-factor')).json()).stepUp,false,'migration preserves the aged proof')
   }
   const signIn=await context.request.post(origin+'/api/identity/magic-link',{data:{email},headers:{Origin:origin}});assert.equal(signIn.status(),202)
   let firstMail
   for(let attempt=0;attempt<100&&!firstMail;attempt++){const line=runtime.logs.split('\n').find(line=>line.includes('STEP_UP_MAILBOX '));if(line)firstMail=JSON.parse(line.split('STEP_UP_MAILBOX ')[1]);else await new Promise(resolve=>setTimeout(resolve,25))}
   assert.ok(firstMail,'the mailbox received the primary sign-in link')
   await page.goto(firstMail.text.match(/http:\/\/\S+/)[0]);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>/\/projects\/[^/]+\/activation/.test(url.pathname))
   const actor=await (await context.request.get(origin+'/api/identity/session')).json(),P=`/projects/${actor.projectId}`,R=`/api/dashboard/projects/${actor.projectId}/reports`
   const api=async(path,body,token)=>{const response=await context.request.fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{data:body})});assert.ok(response.ok(),path+': '+response.status()+' '+await response.text());return response.json()}
   assert.equal((await api('/api/management/profile')).data.has_password,oldRuntimeFactory?1:0,'new claims omit unknown passwords; existing credentials are preserved')
   await page.goto(origin+'/users/profile');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Security',exact:true}).click();await page.getByRole('heading',{name:oldRuntimeFactory?'Set a new password':'Set a password',exact:true}).waitFor();assert.equal(await page.getByLabel('Current password',{exact:true}).count(),0)
   await page.screenshot({path:shot(name+'-set-password.png'),fullPage:true})
   const project=await api('/api/identity/projects/'+actor.projectId),visitor=await api('/api/identity/widget/session',{widgetKey:project.widget_key,email,name:'Maya Roberts'}),conversation=await api('/api/conversations',{projectId:actor.projectId},visitor.token)
   await api('/api/conversations/'+conversation.id+'/messages',{localId:'receipt-question',content:marker,expectedRevision:0,expectedLastMessageId:null},visitor.token)
   await api('/api/conversations',{projectId:actor.projectId},visitor.token)
   await page.goto(origin+P+'/conversations/'+conversation.id);await page.getByPlaceholder('Type your reply…').fill('I corrected the receipt for order 4821. '+marker);await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Email not sent · the visitor’s address matches the reply sender’s',{exact:true}).waitFor()
   await page.screenshot({path:shot(name+'-same-address.png'),fullPage:true})
   await api(`/api/dashboard/projects/${actor.projectId}/conversations/${conversation.id}/notes`,{content:'Private: verify the billing address for '+marker})
   const upload=await context.request.post(origin+`/api/conversations/${conversation.id}/media`,{headers:{Origin:origin,'Content-Type':'text/plain','X-Filename':'receipt-4821.txt'},data:Buffer.from(marker)});assert.equal(upload.status(),201)
   const report=await api(R);assert.equal(report.volume,1,'the empty widget conversation does not inflate Reports')
   held=await browser.newContext({viewport,storageState:await context.storageState()})
   // An aged held session cannot set credentials or export, before or after requesting mail.
   await runtime.execute(`UPDATE session_factors SET verified_at=verified_at-1200000 WHERE user_id='${actor.id}'`)
   assert.equal((await held.request.post(origin+'/api/identity/password',{data:{password:'synthetic-held-browser-password'},headers:{Origin:origin}})).status(),403)
   await page.goto(origin+P+'/reports');await page.getByRole('button',{name:'Conversations CSV',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).waitFor()
   assert.equal(await page.getByLabel('Your password',{exact:true}).count(),oldRuntimeFactory?1:0);await page.screenshot({path:shot(name+'-email-dialog.png'),fullPage:true})
   const requested=page.waitForResponse(r=>r.url().endsWith('/api/identity/step-up/email'));await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).click();assert.equal((await requested).status(),202)
   await page.getByRole('status').filter({hasText:'Check your inbox'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Open the email link'}).waitFor()
   assert.equal((await held.request.get(origin+R+'?format=conversations.csv')).status(),403,'request alone does not refresh the held session')
   await page.screenshot({path:shot(name+'-awaiting-mailbox.png'),fullPage:true})
   const mail=JSON.parse(runtime.logs.split('\n').filter(line=>line.includes('STEP_UP_MAILBOX ')).at(-1).split('STEP_UP_MAILBOX ')[1]),link=mail.text.match(/http:\/\/\S+/)[0]
   assert.deepEqual(mail.to,[email]);assert.equal(new URL(link).origin,origin)
   const mailbox=await context.newPage();await mailbox.goto(link);await mailbox.getByRole('button',{name:'Sign in',exact:true}).click();await mailbox.waitForURL(url=>url.pathname===P+'/reports');await mailbox.close()
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Continue',exact:true}).click();const csv=await download;assert.equal(csv.suggestedFilename(),'conversations.csv');assert.match(await readFile(await csv.path(),'utf8'),new RegExp(conversation.id))
   const jsonDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export workspace conversations (JSON)',exact:true}).click();const history=JSON.parse(await readFile(await (await jsonDownload).path(),'utf8')),exported=history.conversations.find(row=>row.id===conversation.id)
   assert.ok(exported.messages.some(row=>row.content===marker));assert.ok(exported.messages.some(row=>row.content.includes('I corrected')));assert.ok(exported.privateNotes.some(row=>row.content.includes('Private:')));assert.ok(exported.attachments.some(row=>row.filename==='receipt-4821.txt'))
   await page.screenshot({path:shot(name+'-reports-exported.png'),fullPage:true})
   assert.equal((await held.request.get(origin+R+'?format=conversations.csv')).status(),403,'another session cannot borrow mailbox proof')
   assert.equal((await held.request.post(origin+'/api/identity/password',{data:{password:'synthetic-held-browser-password'},headers:{Origin:origin}})).status(),403)
   const heldPage=await held.newPage();await heldPage.goto(origin+P+'/reports');await heldPage.getByRole('button',{name:'Conversations CSV',exact:true}).click();await heldPage.getByRole('dialog').waitFor();await heldPage.screenshot({path:shot(name+'-held-session-denied.png'),fullPage:true})
   await page.goto(origin+'/users/profile');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Security',exact:true}).click();await page.getByLabel('New password',{exact:true}).fill('synthetic-mailbox-browser-password');await page.getByLabel('Confirm password',{exact:true}).fill('synthetic-mailbox-browser-password');await page.getByRole('button',{name:'Update',exact:true}).click();await page.waitForURL(url=>url.pathname==='/login')
   passed=true
  }finally{await held?.close();await context.close();await runtime?.close(passed);if(state)await rm(state,{recursive:true,force:true})}
 }
}
