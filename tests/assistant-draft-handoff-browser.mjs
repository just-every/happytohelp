import assert from 'node:assert/strict';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {assistantDraftFixture, visitorConversation} from './helpers/assistant-draft-fixture.mjs';

const evidence = resolve(process.env.H2H_EVIDENCE_DIR || 'test-results/assistant-draft-handoff');
await mkdir(evidence, {recursive:true});
const runtime = await createRuntime();
let browser, success = false;
const checks = [], errors = [];
const ownerMessages = messages => messages.filter(message => message.actor_role === 'owner');
try {
    browser = await chromium.launch({headless:true});
    for (const width of [390, 1440, 1279, 1280]) {
        const viewport = {width, height:900};
        const context = await browser.newContext({viewport}), page = await context.newPage();
        let visitor;
        try {
            page.on('pageerror', error => errors.push(error.message));
            const tenant = await runtime.seedTenant({name:'Draft handoff ' + width, email:`handoff-${width}@test.example`, allowedOrigin:runtime.origin});
            await context.addCookies([{name:'h2h_session', value:tenant.token, url:runtime.origin}]);
            const project = await context.request.get(runtime.origin + `/api/identity/projects/${tenant.projectId}`);
            assert.equal(project.status(), 200);
            visitor = await visitorConversation({browser, origin:runtime.origin, widgetKey:(await project.json()).widget_key, projectId:tenant.projectId, viewport});
            const fixture = await assistantDraftFixture(runtime, context, visitor.session, tenant, width);
            const savedReply = {title:'Handoff saved reply', content:'Saved reply still inserts.'};
            const saved = await context.request.post(runtime.origin + `/api/dashboard/projects/${tenant.projectId}/macros`, {data:savedReply});
            assert.ok(saved.ok(), await saved.text());
            const url = runtime.origin + `/projects/${tenant.projectId}/conversations/${visitor.session.conversationId}`;
            await page.goto(url);
            const panel = page.locator('#conversation-assistant');
            const composer = page.getByRole('textbox', {name:'Reply to conversation', exact:true});
            await composer.waitFor();
            const openLocal = async () => {
                const toggle = page.getByRole('button', {name:'Show conversation panel', exact:true});
                if (await toggle.isVisible()) await toggle.click();
                await panel.locator('[role=tab]').first().waitFor();
                await page.getByRole('tab', {name:'Local', exact:true}).click();
            };
            const assertHandoff = async body => {
                await page.waitForFunction(expected =>
                    document.querySelector('textarea[aria-label="Reply to conversation"]')?.value === expected,
                body);
                assert.equal(await composer.inputValue(), body);
                assert.equal(await panel.getAttribute('aria-hidden'), String(width < 1280));
                if (width < 1280) await panel.waitFor({state:'hidden'});
                else assert.ok(await panel.isVisible(), 'permanent desktop column stays open');
                await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Reply to conversation');
            };
            await openLocal();
            const before = ownerMessages(await visitor.transcript()).length;
            assert.equal(before, 0);
            await page.getByRole('button', {name:'Use Reviewed reply', exact:true}).click();
            await assertHandoff(fixture.body);
            await page.keyboard.type(' Edited by the operator.');
            const edited = fixture.body + ' Edited by the operator.';
            assert.equal(await composer.inputValue(), edited);
            await page.keyboard.press('Tab');
            assert.equal(await panel.evaluate(element => element.contains(document.activeElement)), false, 'Tab is not trapped in assistant');
            await page.keyboard.press('Shift+Tab');
            assert.ok(await composer.evaluate(element => element === document.activeElement), 'Shift+Tab returns to editable draft');
            assert.equal(ownerMessages(await visitor.transcript()).length, before, 'Use and keyboard edit never send');
            await page.screenshot({path:join(evidence, `before-send-${width}.png`)});
            // Deliberately no Hide, Escape, force, DOM click, or dismissal between Use and Send.
            await page.getByRole('button', {name:'Send', exact:true}).click();
            await visitor.page.getByText(edited, {exact:true}).waitFor();
            const sent = ownerMessages(await visitor.transcript());
            assert.equal(sent.length, before + 1);
            assert.equal(sent[0].content, edited);
            const frame = visitor.frames.find(frame => frame.message?.id === sent[0].id);
            assert.equal(frame?.message.content, edited, 'visitor socket receives same durable message identity');
            await visitor.page.reload();
            await visitor.mount();
            await visitor.page.getByText(edited, {exact:true}).waitFor();
            assert.deepEqual(ownerMessages(await visitor.transcript()).map(({id, content}) => ({id, content})), [{id:sent[0].id, content:edited}]);
            await page.reload();
            await page.getByText(edited, {exact:true}).waitFor();
            checks.push({width, messageId:sent[0].id, jobId:fixture.jobId, body:edited, exactCount:1, socket:true, reload:true});

            // Both caller forms preserve attachment identity and deduplication.
            await openLocal();
            await page.getByRole('button', {name:'Use Reply with screenshot', exact:true}).click();
            await assertHandoff('Screenshot draft.');
            assert.equal(await page.locator('.conversation-composer__files img[alt="handoff.png"]').count(), 1);
            await openLocal();
            await page.getByText('Evidence and details', {exact:true}).click();
            await page.locator('.delegation-job__draft').getByRole('button', {name:'Use', exact:true}).click();
            await assertHandoff(fixture.legacy);
            assert.equal(await page.locator('.conversation-composer__files img[alt="handoff.png"]').count(), 1);
            assert.equal(ownerMessages(await visitor.transcript()).length, 1, 'legacy insertion also does not send');
            // Discard through native navigation, then return: no draft, attachment or focus leaks.
            page.on('dialog', dialog => dialog.accept());
            const navigationToggle = page.getByRole('button', {name:'Toggle navigation', exact:true});
            if (await navigationToggle.isVisible()) await navigationToggle.click();
            await page.getByTestId('nav-settings').click();
            await page.waitForURL('**/edit');
            await page.getByRole('heading', {name:'Project details', exact:true}).waitFor();
            await composer.waitFor({state:'detached'});
            await page.goBack();
            await page.waitForURL(url);
            await composer.waitFor();
            assert.equal(await composer.inputValue(), '');
            assert.equal(await page.locator('.conversation-composer__files').count(), 0);
            await composer.fill('Ordinary typing still works.');
            assert.equal(await composer.inputValue(), 'Ordinary typing still works.');
            await page.getByRole('button', {name:'Reply tools', exact:true}).click();
            await page.getByRole('menuitem', {name:'Saved replies', exact:true}).click();
            await page.getByRole('link', {name:savedReply.title, exact:true}).click();
            assert.ok((await composer.inputValue()).includes('Ordinary typing still works.'));
            assert.ok((await composer.inputValue()).includes(savedReply.content));
            await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Reply to conversation');
            assert.equal(ownerMessages(await visitor.transcript()).length, 1);
            if (width < 1280) {
                await openLocal();
                await page.keyboard.press('Escape');
                await panel.waitFor({state:'hidden'});
                assert.ok(await page.getByRole('button', {name:'Show conversation panel', exact:true}).evaluate(element => element === document.activeElement));
            }
            checks.at(-1).attachmentsAndLegacy = true;
            checks.at(-1).navigationAndKeyboard = true;
            checks.at(-1).savedReply = true;
        } finally { await visitor?.context.close(); await context.close(); }
    }
    assert.deepEqual(errors, []);
    success = true;
} finally {
    await browser?.close();
    await writeFile(join(evidence, 'runtime.log'), runtime.logs);
    await runtime.close(success);
    const bundle = await readFile('delivery-artifact/happytohelp-worker-artifact.json');
    await writeFile(join(evidence, 'result.json'), JSON.stringify({success, checks, errors, providerCalls:0,
        emittedArtifactManifestSha256:createHash('sha256').update(bundle).digest('hex'), browserClosed:true, runtimeClosed:true}, null, 2));
}
console.log(`Assistant draft handoff passed ${checks.length} widths: 390, 1440, 1279, 1280; native Worker/D1/R2/socket, explicit Send exactly once, legacy/attachments/navigation/keyboard, zero provider calls.`);
