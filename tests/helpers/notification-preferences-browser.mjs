import assert from 'node:assert/strict'
import {join} from 'node:path'

export async function notificationPreferencesJourney({page,request,runtime,token,owner,projectId,project,evidenceDir}){
 const api=`/api/management/projects/${projectId}`
 const me=(await request(`${api}/agents`,{token})).data.find(row=>row.email===owner.email)
 assert.equal((await request(`${api}/agents`,{token})).data.filter(row=>row.role==='owner').length,1)
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:960})
  await page.goto(`${runtime.origin}/projects/${projectId}/agents/${me.id}`)
  const box=page.getByLabel('Notify on unassigned conversation activity',{exact:true})
  await box.waitFor()
  // Exercise an unchanged role save as the sole owner, with a real preference change.
  if(await box.isChecked()){
   await box.uncheck()
   const off=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(`/agents/${me.id}`))
   await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await off).status(),200);await page.getByRole('status').filter({hasText:'Saved.'}).waitFor()
  }
  await box.check()
  const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(`/agents/${me.id}`))
  await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await saved).status(),200);await page.getByRole('status').filter({hasText:'Saved.'}).waitFor()
  await page.reload();await box.waitFor();assert.equal(await box.isChecked(),true)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:join(evidenceDir,`notification-owner-${width}.png`),fullPage:true})
  await page.goto(`${runtime.origin}/users/profile`)
  await page.getByRole('button',{name:'Notification',exact:true}).click()
  await box.waitFor();assert.equal(await box.isChecked(),true)
  for(const enabled of [false,true]){
   await box.setChecked(enabled)
   const updated=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/management/profile')
   await page.getByRole('button',{name:'Update',exact:true}).click();assert.equal((await updated).status(),200);await page.getByRole('status').filter({hasText:'Saved.'}).waitFor()
   await page.reload();await page.getByRole('button',{name:'Notification',exact:true}).click();await box.waitFor();assert.equal(await box.isChecked(),enabled)
  }
  await page.screenshot({path:join(evidenceDir,`notification-account-${width}.png`),fullPage:true})
 }
 assert.equal((await request(`${api}/agents/${me.id}`,{token,method:'PUT',body:{role:'operator'},raw:true})).status,409,'a real demotion still protects the sole owner')
 const visitor=await request('/api/identity/widget/session',{body:{widgetKey:project.widget_key,name:'Maya Chen'}})
 const conversation=await request('/api/conversations',{token:visitor.token,body:{projectId}})
 await request(`/api/conversations/${conversation.id}/messages`,{token:visitor.token,body:{localId:'notification-preference-question',content:'Can you help me restore access to my workspace?',expectedRevision:0,expectedLastMessageId:null}})
 // The real scheduled entry batches only after a minute of silence. Advance the
 // local fixture's activity clock while the Worker is stopped, without waiting.
 await runtime.restart(()=>runtime.execute(`UPDATE conversations SET updated_at=updated_at-61000 WHERE id='${conversation.id}'; UPDATE messages SET created_at=created_at-61000 WHERE conversation_id='${conversation.id}';`))
 const tick=await fetch(runtime.origin+'/cdn-cgi/local/scheduled?format=json')
 assert.equal(tick.status,200,await tick.text())
 const deadline=Date.now()+10000
 let mail
 while(Date.now()<deadline){
  mail=runtime.logs.split('\n').filter(line=>line.includes('NOTIFICATION_MAIL ')).map(line=>{try{return JSON.parse(line.slice(line.indexOf('NOTIFICATION_MAIL ')+18))}catch{return null}}).find(row=>row?.subject==='Unread HappyToHelp conversation messages'&&row.to.includes(owner.email)&&row.text.includes('restore access'))
  if(mail)break
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 assert.ok(mail,'the opted-in sole owner receives the unassigned activity email')
 await page.setViewportSize({width:1440,height:1000})
}
