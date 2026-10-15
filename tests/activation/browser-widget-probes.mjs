import assert from 'node:assert/strict';
import {apiKit,snapshot} from './browser-kit.mjs';
export async function widgetProbes({runtime,page,projectId,token,activation,checks}){
 const api=apiKit(runtime,token),project=await api(`/api/identity/projects/${projectId}`);
 const visitor=await api('/api/identity/widget/session',{body:{widgetKey:project.widget_key,name:'Activation visitor',email:'activation-visitor@example.test'},auth:null,headers:{Origin:runtime.origin},status:201});
 const conversation=await api('/api/conversations',{body:{projectId},auth:visitor.token,status:201});
 const widgetStep=async()=>snapshot(await api(activation+'/check',{body:{step:'widget_seen'}})).steps.find(s=>s.id==='widget_seen');
 assert.notEqual((await widgetStep()).state,'done','creating contact does not prove ping');
 await api(`/api/conversations/${conversation.id}/widget-events`,{auth:visitor.token,body:{action:'instruction',data:{opened:true}},headers:{Origin:runtime.origin}});
 assert.notEqual((await widgetStep()).state,'done','generic instruction/last_seen_at does not prove ping');
 // The actual widget must report installation without enabling optional activity collection.
 // Keep Setup open: its own next check, rather than an API/manual check, must notice the visit.
 await page.goto(`${runtime.origin}/projects/${projectId}/activation`);
 const list=page.getByTestId('setup-list');await list.locator('[data-need="widget_seen"]').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-again]')?.disabled===false);
 const before=Number(await list.getAttribute('data-confirmed'));
 const context=await page.context().browser().newContext({viewport:{width:1000,height:844}});
 try {
  const customer=await context.newPage();
  await customer.goto(`${runtime.origin}/help/${projectId}`);
  await customer.addScriptTag({url:`${runtime.origin}/widget.js`});
  await customer.evaluate(options=>window.h2h('init',options),{widgetKey:project.widget_key,apiOrigin:runtime.origin,open:true,settings:{collector:{enabled:false}}});
  const content='Setup installation conversation on the saved localhost origin';
  await customer.locator('textarea[name=content]').fill(content);
  const sent=customer.waitForResponse(response=>/\/api\/conversations\/[^/]+\/messages$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST');
  await customer.locator('button[name=submit]').click();assert.equal((await sent).status(),200);
  const conversationId=await customer.evaluate(key=>JSON.parse(localStorage.getItem(key)).conversationId,`rer-widget:${runtime.origin}:${project.widget_key}`);
  const transcript=await api(`/api/conversations/${conversationId}/messages`);
  assert.equal(transcript.messages.at(-1).content,content,'the real widget message reached the operator');
  const reply='The widget conversation reached our team.';
  const admitted=await api(`/api/conversations/${conversationId}/messages`,{body:{localId:'setup-widget-reply',content:reply,expectedRevision:transcript.revision,expectedLastMessageId:transcript.lastMessageId}});
  assert.equal(admitted.accepted,true);await customer.getByText(reply,{exact:true}).waitFor();
  await list.locator('[data-set="widget_seen"][data-state="confirmed"]').waitFor({timeout:35000});
  assert.equal(await list.locator('[data-need="widget_seen"]').count(),0);
  assert.equal(Number(await list.getAttribute('data-confirmed')),before+1);
  const seen=snapshot(await api(activation)).steps.find(step=>step.id==='widget_seen');
  assert.equal(seen.state,'done');assert.ok(seen.checkedAt);assert.ok(seen.receiptRef);
 } finally {await context.close();}
 await api(`/api/management/projects/${projectId}/settings`,{method:'PUT',body:{allowed_origin:'https://activation-second-origin.example.test'}});
 assert.notEqual(snapshot(await api(activation)).steps.find(s=>s.id==='widget_seen').state,'done','origin change invalidates old ping');
 checks.push('real localhost widget conversation with collection disabled reaches the team and receives its reply; open Setup automatically confirms the authenticated visit; changed origin invalidates it');
}
