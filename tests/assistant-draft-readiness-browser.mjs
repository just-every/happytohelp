import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {assistantDraftFixture, visitorConversation} from './helpers/assistant-draft-fixture.mjs';

const evidence = resolve(process.env.H2H_EVIDENCE_DIR || 'test-results/assistant-draft-readiness');
await mkdir(evidence, {recursive:true});
const runtime = await createRuntime();
const checks = [], errors = [];
let browser, visitor, setup, success = false;
try {
    browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
    // Seed before any dashboard sockets are open; every response below is native.
    const tenant = await runtime.seedTenant({name:'Draft readiness', email:'draft-readiness@test.example', allowedOrigin:runtime.origin});
    setup = await browser.newContext();
    const sessionCookie = {name:'h2h_session', value:tenant.token, url:runtime.origin};
    await setup.addCookies([sessionCookie]);
    const project = await (await setup.request.get(runtime.origin + `/api/identity/projects/${tenant.projectId}`)).json();
    visitor = await visitorConversation({browser, origin:runtime.origin, widgetKey:project.widget_key, projectId:tenant.projectId, viewport:{width:390,height:900}});
    const fixture = await assistantDraftFixture(runtime, setup, visitor.session, tenant, 'readiness');
    // A global conversation deep link resolves its project through the native
    // metadata API. It exercises genuinely pending history rather than holding
    // a later refresh after the scoped document already supplied fresh history.
    const url = runtime.origin + `/conversations/${visitor.session.conversationId}`;

    for (const width of [1440, 390, 1280, 1279]) {
        const context = await browser.newContext({viewport:{width,height:900}});
        await context.addCookies([sessionCookie]);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        let releaseBuckets;
        const bucketsHeld = new Promise(resolve => { releaseBuckets = resolve; });
        const bucketPath = `/api/dashboard/projects/${tenant.projectId}/conversations/${visitor.session.conversationId}/buckets`;
        let bucketStatus;
        // Delay the real initial transcript response, without altering its body.
        await page.route(requestUrl => requestUrl.pathname === bucketPath, async route => {
            const response = await route.fetch();
            bucketStatus = response.status();
            await bucketsHeld;
            await route.fulfill({response});
        });
        try {
            const bucketRequested = page.waitForRequest(request => new URL(request.url()).pathname === bucketPath);
            await page.goto(url);
            const panel = page.locator('#conversation-assistant');
            const composer = page.getByRole('textbox', {name:'Reply to conversation',exact:true});
            await composer.waitFor();
            await bucketRequested;
            const openLocal = async () => {
                const toggle = page.getByRole('button', {name:'Show conversation panel',exact:true});
                if (await toggle.isVisible()) await toggle.click();
                await page.getByRole('tab', {name:'Local',exact:true}).click();
            };
            await openLocal();
            const use = page.getByRole('button', {name:'Use Reviewed reply',exact:true});
            await use.waitFor();
            await page.getByText('Evidence and details', {exact:true}).click();
            const legacyUse = panel.locator('.delegation-job__draft').getByRole('button', {name:'Use',exact:true});
            assert.ok(await use.isDisabled(), 'local Use waits for native conversation history');
            assert.ok(await legacyUse.isDisabled(), 'legacy Use obeys the same readiness boundary');
            assert.equal(await composer.inputValue(), '', 'unready history cannot hand off a draft');

            if (width < 1280) {
                await page.getByRole('tab', {name:'Local',exact:true}).click();
                await page.keyboard.press('Shift+Tab');
                assert.ok(await panel.evaluate(element => element.contains(document.activeElement)), 'open compact sheet still traps backwards Tab');
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement?.id), 'conversation-tab-local', 'open compact sheet wraps to its first control');
                await page.keyboard.press('Escape');
                await panel.waitFor({state:'hidden'});
                assert.ok(await page.getByRole('button', {name:'Show conversation panel',exact:true}).evaluate(element => element === document.activeElement), 'Escape returns focus to opener');
                await openLocal();
            }

            releaseBuckets();
            const [adoption] = await Promise.all([
                page.waitForResponse(response => response.url().endsWith('/result/draft') && response.request().method() === 'POST'),
                use.click(),
            ]);
            assert.equal(bucketStatus, 200, 'delayed transcript was a real successful native response');
            assert.equal(adoption.status(), 200);
            await page.waitForFunction(body => document.querySelector('textarea[aria-label="Reply to conversation"]')?.value === body, fixture.body);
            await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Reply to conversation');
            assert.equal(await panel.getAttribute('aria-hidden'), String(width < 1280));
            await page.keyboard.type(' Operator edit.');
            assert.equal(await composer.inputValue(), fixture.body + ' Operator edit.');
            assert.ok(await page.getByRole('button', {name:'Send',exact:true}).isEnabled(), 'handoff has usable Send');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.activeElement?.id), 'conversation-composer-tools', 'native Tab reaches Reply tools after delayed history');
            await page.keyboard.press('Shift+Tab');
            assert.ok(await composer.evaluate(element => element === document.activeElement));
            assert.equal((await visitor.transcript()).filter(message => message.actor_role === 'owner').length, 0, 'Use and editing never send');
            await panel.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
            await page.screenshot({path:join(evidence, `ready-${width}.png`)});
            checks.push({width, bucketStatus, localAndLegacyBlocked:true, compactTrap:width < 1280, nativeTab:true, providerCalls:0});
        } finally {
            releaseBuckets();
            await page.unrouteAll({behavior:'wait'});
            await context.close();
        }
    }
    assert.deepEqual(errors, []);
    success = true;
} finally {
    await visitor?.context.close();
    await setup?.close();
    await browser?.close();
    await writeFile(join(evidence, 'runtime.log'), runtime.logs);
    await runtime.close(success);
    await writeFile(join(evidence, 'result.json'), JSON.stringify({success,checks,errors,providerCalls:0,browserClosed:true,runtimeClosed:true}, null, 2));
}
console.log(`Assistant draft readiness passed ${checks.length} widths with native delayed transcript responses and keyboard handoff.`);
