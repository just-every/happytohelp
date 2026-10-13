import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {assistantDraftFixture, visitorConversation} from './helpers/assistant-draft-fixture.mjs';

const evidence=resolve(process.env.H2H_EVIDENCE_DIR || 'test-results/local-draft-adoption');
await mkdir(evidence,{recursive:true});
const runtime=await createRuntime();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=','base64');
const checks=[],errors=[];
let browser,success=false;
try {
    browser=await chromium.launch({headless:true});
    for(const width of [390,1440]) for(const kind of ['local','legacy']) {
        const viewport={width,height:900},context=await browser.newContext({viewport}),page=await context.newPage();
        let visitor;
        try {
            page.on('pageerror',error=>errors.push(error.message));
            page.on('dialog',dialog=>dialog.accept());
            const tenant=await runtime.seedTenant({name:'Adoption '+width+' '+kind,email:randomUUID()+'@example.test',allowedOrigin:runtime.origin});
            await context.addCookies([{name:'h2h_session',value:tenant.token,url:runtime.origin}]);
            const project=await(await context.request.get(runtime.origin+`/api/identity/projects/${tenant.projectId}`)).json();
            visitor=await visitorConversation({browser,origin:runtime.origin,widgetKey:project.widget_key,projectId:tenant.projectId,viewport});
            const fixture=await assistantDraftFixture(runtime,context,visitor.session,tenant,width);
            const url=runtime.origin+`/projects/${tenant.projectId}/conversations/${visitor.session.conversationId}`;
            await page.goto(url);
            const composer=page.getByRole('textbox',{name:'Reply to conversation',exact:true}),panel=page.locator('#conversation-assistant');
            await composer.waitFor();
            const openLocal=async()=>{
                const toggle=page.getByRole('button',{name:'Show conversation panel',exact:true});
                if(await toggle.isVisible())await toggle.click();
                await page.getByRole('tab',{name:'Local',exact:true}).click();
                if(kind==='legacy'&&!await panel.locator('.delegation-job__draft button').isVisible())await panel.getByText('Evidence and details',{exact:true}).click();
            };
            const button=kind==='local'?page.getByRole('button',{name:'Use Reply with screenshot',exact:true}):panel.locator('.delegation-job__draft').getByRole('button',{name:'Use',exact:true});
            const body=kind==='local'?'Screenshot draft.':fixture.legacy;
            const adopt=async()=>{
                await openLocal();
                const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/result/draft')&&r.request().method()==='POST'),button.click()]);
                assert.equal(response.status(),200,await response.text());
                const draft=(await response.json()).data;
                assert.equal(draft.body,body);assert.equal(draft.attachments.length,1);
                assert.notEqual(draft.attachments[0].id,fixture.attachment.id);
                await page.waitForFunction(body=>document.querySelector('textarea[aria-label="Reply to conversation"]')?.value===body,body);
                await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Reply to conversation');
                assert.equal(await panel.getAttribute('aria-hidden'),String(width<1280));
                assert.equal(await page.locator('.conversation-composer__files img[alt="handoff.png"]').count(),1);
                return draft;
            };
            const first=await adopt(),second=await adopt();
            assert.equal(first.attachments[0].id,second.attachments[0].id,'repeated Use deduplicates native media');
            assert.equal((await visitor.transcript()).filter(m=>m.actor_role==='owner').length,0);
            const edited=body+' Reviewed '+randomUUID();
            await page.keyboard.type(edited.slice(body.length));
            assert.equal(await composer.inputValue(),edited);
            const [sendResponse]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/messages')&&r.request().method()==='POST'),page.getByRole('button',{name:'Send',exact:true}).click()]);
            assert.equal(sendResponse.status(),200,await sendResponse.text());
            assert.deepEqual(sendResponse.request().postDataJSON().mediaIds,[first.attachments[0].id]);
            await visitor.page.getByText(edited,{exact:true}).waitFor();
            const messages=(await visitor.transcript()).filter(m=>m.actor_role==='owner');
            assert.equal(messages.length,1);assert.equal(messages[0].actor_id,tenant.userId);
            assert.equal(messages[0].content,edited);assert.equal(messages[0].media[0].id,first.attachments[0].id);
            assert.equal(visitor.frames.find(frame=>frame.message?.id===messages[0].id)?.message.media[0].id,first.attachments[0].id);
            const download=await visitor.context.request.get(runtime.origin+first.attachments[0].url,{headers:{Authorization:'Bearer '+visitor.session.token}});
            assert.equal(download.status(),200);assert.deepEqual(await download.body(),png);
            await visitor.page.reload();await visitor.mount();await visitor.page.getByText(edited,{exact:true}).waitFor();
            const reloaded=(await visitor.transcript()).filter(m=>m.actor_role==='owner');
            assert.equal(reloaded.length,1);assert.equal(reloaded[0].id,messages[0].id);assert.deepEqual(reloaded[0].media,messages[0].media);
            await page.screenshot({path:join(evidence,`${width}-${kind}.png`)});
            checks.push({width,kind,messageId:messages[0].id,mediaId:first.attachments[0].id,localAttachmentId:fixture.attachment.id,exactBytes:true,socket:true,reload:true,sendCount:1});

            // A late response from a real adoption must not restore body, files
            // or focus after native SPA navigation and return to this conversation.
            if(width===390&&kind==='local') {
                const fresh=await assistantDraftFixture(runtime,context,visitor.session,tenant,width);
                await page.reload();await composer.waitFor();await openLocal();
                let releaseEdit,editArrived;
                const editHeld=new Promise(resolve=>{releaseEdit=resolve;}),editReady=new Promise(resolve=>{editArrived=resolve;});
                await page.route('**/result/draft',async route=>{
                    const response=await route.fetch();editArrived(response.status());await editHeld;await route.fulfill({response});
                });
                await page.getByRole('button',{name:'Use Reply with screenshot',exact:true}).first().click();
                assert.equal(await editReady,200);
                await page.keyboard.press('Escape');
                const laterEdit='Keep this later human edit '+randomUUID();
                await composer.fill(laterEdit);
                await page.getByRole('button',{name:'Show conversation panel',exact:true}).focus();
                releaseEdit();await page.unrouteAll({behavior:'wait'});
                assert.equal(await composer.inputValue(),laterEdit);
                assert.equal(await page.locator('.conversation-composer__files').count(),0);
                assert.ok(await page.getByRole('button',{name:'Show conversation panel',exact:true}).evaluate(el=>el===document.activeElement));
                assert.equal((await visitor.transcript()).filter(m=>m.actor_role==='owner').length,1);
                checks.push({width,lateHumanEditPreserved:true,noLateFocus:true,noPartialDraft:true});
                await composer.fill('');await openLocal();
                let release,arrived;
                const held=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{arrived=resolve;});
                await page.route('**/result/draft',async route=>{
                    const response=await route.fetch();arrived(response.status());await held;
                    try {await route.fulfill({response});}catch(error){if(!/closed|cancel|disposed/i.test(error.message))throw error;}
                });
                await page.getByRole('button',{name:'Use Reply with screenshot',exact:true}).first().click();
                assert.equal(await ready,200);
                await page.keyboard.press('Escape');
                const nav=page.getByRole('button',{name:'Toggle navigation',exact:true});if(await nav.isVisible())await nav.click();
                await page.getByTestId('nav-settings').click();
                await page.waitForURL('**/edit');await composer.waitFor({state:'detached'});
                release();await page.unrouteAll({behavior:'wait'});
                await page.goBack();await page.waitForURL(url);await composer.waitFor();
                assert.equal(await composer.inputValue(),'');assert.equal(await page.locator('.conversation-composer__files').count(),0);
                assert.equal(await composer.evaluate(el=>el===document.activeElement),false);
                checks.push({width,routeRace:true,jobId:fresh.jobId});

                // The stale visible result now loses device authority. Failure
                // stays in the Local panel and no partial draft is inserted.
                await openLocal();
                const jobs=await(await context.request.get(runtime.origin+`/api/projects/${tenant.projectId}/conversations/${visitor.session.conversationId}/delegations`)).json();
                const device=jobs.data.find(j=>j.id===fresh.jobId).device_id;
                assert.equal((await context.request.delete(runtime.origin+`/api/projects/${tenant.projectId}/local-agents/${device}`)).status(),200);
                const [denied]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/result/draft')),page.getByRole('button',{name:'Use Reply with screenshot',exact:true}).first().click()]);
                assert.equal(denied.status(),409);await page.locator('.delegation-panel__error').waitFor();
                assert.equal(await composer.inputValue(),'');assert.equal(await page.locator('.conversation-composer__files').count(),0);
                assert.equal(await panel.getAttribute('aria-hidden'),'false');
                assert.equal((await visitor.transcript()).filter(m=>m.actor_role==='owner').length,1);
                checks.push({width,revocationVisible:true,noPartialDraft:true});
            }
        } finally {await visitor?.context.close();await context.close();}
    }
    assert.deepEqual(errors,[]);success=true;
} finally {
    await browser?.close();await writeFile(join(evidence,'runtime.log'),runtime.logs);await runtime.close(success);
    await writeFile(join(evidence,'result.json'),JSON.stringify({success,checks,errors,providerCalls:0,browserClosed:true,runtimeClosed:true},null,2));
}
console.log('Native Local/legacy Use: four attachment sends, deduplication, operator ownership, exact R2 downloads, visitor sockets/reload, route race and visible revocation passed.');
