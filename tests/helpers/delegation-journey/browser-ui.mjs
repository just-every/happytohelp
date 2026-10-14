import assert from 'node:assert/strict';
import {join} from 'node:path';

export function browserUI({page,context,origin,actor,api,width,evidence,captions}){
 let conversationId;
 const openPanel=async()=>{
  await page.locator('.conversation-assistant-toggle').waitFor();
  const show=page.getByRole('button',{name:'Show conversation panel',exact:true});if(await show.isVisible())await show.click();
  await page.locator('#conversation-assistant[aria-hidden=false]').waitFor();await page.getByRole('tab',{name:'Local',exact:true}).click();
 };
 const ui={
  async open(id){conversationId=id;await page.goto(origin+`/projects/${actor.projectId}/conversations/${id}`);await openPanel()},
  async refresh(){await page.reload();await openPanel();for(const details of await page.locator('.delegation-job__completed-details').all())if(await details.getAttribute('open')===null)await details.locator('summary').click()},
  async pair(){
   await page.goto(origin+`/projects/${actor.projectId}/local-agent`);await page.getByRole('button',{name:'Connect computer',exact:true}).click();
   const response=page.waitForResponse(r=>r.url().endsWith('/local-agents/pairings')&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Generate setup command',exact:true}).click();const paired=await response;assert.equal(paired.status(),200);const code=(await paired.json()).data.code;
   // Pairing capabilities are not photographed. The following screenshot shows
   // only the paired device and the explicit conversation instruction.
   await page.keyboard.press('Escape');await ui.open(conversationId);return code;
  },
  async delegate(device,mode,instructions){
   await ui.refresh();await page.locator('#delegation-device').selectOption(device);await page.locator('#delegation-mode').selectOption(mode);await page.locator('#delegation-instructions').fill(instructions);
   const response=page.waitForResponse(r=>r.url().endsWith('/delegations')&&r.request().method()==='POST');
   await page.getByRole('button',{name:/^(Send|Queue) task$/}).click();const sent=await response;assert.equal(sent.status(),200);return (await sent.json()).data;
  },
  async approve(path,jobId){
   const response=page.waitForResponse(r=>r.url().endsWith(`/delegations/${jobId}/result/follow-up-actions/enable`));
   await page.getByRole('button',{name:'Run Enable Spanish',exact:true}).click();const approved=await response;assert.equal(approved.status(),200);return (await approved.json()).data;
  },
  async send(reply,jobId){
   await page.getByRole('button',{name:'Use '+reply.title,exact:true}).click();
   const composer=page.getByPlaceholder('Type your reply…');await page.waitForFunction(body=>document.querySelector('textarea[aria-label="Reply to conversation"]')?.value===body,reply.body);assert.equal(await composer.inputValue(),reply.body);
   const messagePath=`/api/conversations/${conversationId}/messages`;
   const response=page.waitForResponse(r=>new URL(r.url()).pathname===messagePath&&r.request().method()==='POST');await page.getByRole('button',{name:'Send',exact:true}).click();
   const sent=await response;assert.equal(sent.status(),200);const command=sent.request().postDataJSON();assert.equal(command.authoring.jobId,jobId);
   const replay=await api(messagePath,command);const value=await sent.json();assert.equal(replay.duplicate,true);assert.equal(replay.message.id,value.message.id);return value;
  },
  async shot(step,caption){
   for(const [side,surface] of [['operator',page],['visitor',ui.visitorPage]]){
    assert.ok(await surface.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),side+' fits viewport');
    const name=`${width}-${step}-${side}.png`;await surface.screenshot({path:join(evidence,name),fullPage:true});captions.push(`- [${name}](${name}): ${caption} (${side}, ${width}px; local test, scripted provider.)`);
   }
  },
 };
 return ui;
}
