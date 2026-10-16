import assert from 'node:assert/strict';

// After hours on the installed widget: a workspace in New York opens three days from now, and a visitor in Chicago
// is told the team is away and when it is back in their own time, leaves an email before writing, and gets the
// away reply once in the conversation the team then answers by email.
export async function awayWidget({browser,origin,api,ownerToken,projectId,evidence}){
 const headers={Authorization:`Bearer ${ownerToken}`,'Content-Type':'application/json'};
 const put=async(path,body)=>{const response=await fetch(`${api}/api/management/projects/${projectId}/${path}`,{method:'PUT',headers,body:JSON.stringify(body)});assert.equal(response.status,200,await response.text())};
 const zone='America/New_York',weekday=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long'}).format(new Date());
 const names=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],openDay=names[(names.indexOf(weekday)+3)%7];
 await put('settings',{timezone:zone});
 await put('availability',{is_availability_schedule_enabled:true,availability_schedule:{days:[names.indexOf(openDay)+1],time_from:'09:00',time_to:'17:00',message:''}});
 const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Chicago'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(origin);
  const notice=page.locator('.happytohelp-away-notice');await notice.waitFor();
  assert.match(await notice.innerText(),new RegExp(`We're away right now\\s+We're back ${openDay} at 8:00 AM\\.\\s+Leave your email below`));
  await page.locator('.happytohelp-insight-agent-info').filter({hasText:`Away until ${openDay} at 8:00 AM`}).waitFor();
  const email=page.locator('input[name=email]');await email.waitFor();await page.getByText("We'll email our reply to this address.",{exact:true}).waitFor();
  await page.screenshot({path:`${evidence}/away-1440.png`});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at 390');
  await page.screenshot({path:`${evidence}/away-390.png`});
  await page.setViewportSize({width:1440,height:900});
  await email.fill('night-owl@example.test');await email.press('Enter');
  await notice.filter({hasText:"We'll reply here and email you at night-owl@example.test."}).waitFor();
  await page.locator('textarea[name=content]').fill('My order arrived damaged.');await page.locator('button[name=submit]').click();
  const awayReply=page.locator('.happytohelp-chat-message').filter({hasText:/is away right now and back \w+ at 9:00 AM E[SD]T\. We'll reply here and by email\./});
  await awayReply.waitFor();
  await page.locator('textarea[name=content]').fill('The order number is 4471.');await page.locator('button[name=submit]').click();
  await page.getByText('The order number is 4471.',{exact:true}).waitFor();
  await page.screenshot({path:`${evidence}/away-reply-1440.png`});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:`${evidence}/away-reply-390.png`});
  const session=await page.evaluate(()=>Object.entries(localStorage).map(([key,value])=>key.startsWith('rer-widget:')?JSON.parse(value):null).find(Boolean));
  const transcript=await(await fetch(`${api}/api/conversations/${session.conversationId}/messages`,{headers})).json();
  assert.deepEqual(transcript.messages.map(message=>message.actor_role),['contact','system','contact'],'the conversation is in the inbox with one away reply');
  assert.equal(await awayReply.count(),1);
  // The team answers in the morning; the answer is emailed to the address the visitor left.
  const answer=await(await fetch(`${api}/api/conversations/${session.conversationId}/messages`,{method:'POST',headers,body:JSON.stringify({localId:'away-morning-answer',content:'Sorry about that. A replacement ships today.',expectedRevision:transcript.revision,expectedLastMessageId:transcript.lastMessageId})})).json();
  assert.equal(answer.accepted,true);
  const mailed=async()=>{const buckets=await(await fetch(`${api}/api/dashboard/projects/${projectId}/conversations/${session.conversationId}/buckets`,{headers})).json();return buckets.data.flatMap(bucket=>bucket.messages).find(message=>message.id===answer.message.id)?.email_status?.state};
  let state;for(const deadline=Date.now()+10000;Date.now()<deadline&&(state=await mailed())!=='sent';)await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(state,'sent','the answer is emailed');
  const contact=await(await fetch(`${api}/api/management/projects/${projectId}/contacts/${session.contactId}`,{headers})).json();assert.equal(contact.data.email,'night-owl@example.test');
  await page.getByText('Sorry about that. A replacement ships today.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  return ['after hours the installed widget says the team is away, when it is back in the visitor\'s time, and asks for an email before the first message; the conversation reaches the inbox with one away reply, and the answer is emailed'];
 }finally{
  await context.close();
  await put('availability',{is_availability_schedule_enabled:false,availability_schedule:{}});
 }
}
