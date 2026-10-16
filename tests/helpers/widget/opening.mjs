import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createConfiguredMailRuntime} from '../configured-mail-runtime.mjs';
import {decodePng, measureContrastInRegions} from '../accessibility-contrast.mjs';
import {launchBrowser} from '../../journeys/kit/browser.mjs'
// Opening the widget at desktop and phone widths: readable contrast in every opened state.
export async function openingJourney(){

const evidence = resolve(process.env.H2H_EVIDENCE_DIR || 'test-results/widget-opening-contrast');
await mkdir(evidence, {recursive: true});
const runtime = await createConfiguredMailRuntime();
const records = [];
let browser, success = false;
const call = async (path, body, token) => {
    const response = await fetch(runtime.origin + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    assert.ok(response.ok, `${path}: ${response.status} ${await response.clone().text()}`);
    return response.json();
};

// Pause real entrance motion at its first frame and intermediate frames. Capture
// the real surface with text transparent, retaining its ancestors and decoration.
async function measure(page, label, selector) {
    const target = page.locator(selector);
    const geometry = await target.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const fragments = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (!node.textContent.trim()) continue;
            const style = getComputedStyle(node.parentElement);
            let opacity = 1;
            for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
            const range = document.createRange();
            range.selectNodeContents(node);
            fragments.push({text: node.textContent.trim(), foreground: style.color, opacity, fontSize: style.fontSize, fontWeight: style.fontWeight,
                rects: [...range.getClientRects()].map(rect => ({x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height}))});
        }
        return {fragments, elementSize: {width: bounds.width, height: bounds.height}};
    });
    await target.screenshot({path: join(evidence, `${label}-glyph.png`), animations: 'allow', caret: 'hide'});
    await target.evaluate(element => {
        element.setAttribute('data-opening-contrast', '');
        const style = document.createElement('style');
        style.id = 'opening-contrast';
        style.textContent = '[data-opening-contrast], [data-opening-contrast] * {color:transparent !important; -webkit-text-fill-color:transparent !important}';
        element.getRootNode().appendChild(style);
    });
    let image;
    try {
        image = await target.screenshot({path: join(evidence, `${label}-background.png`), animations: 'allow', caret: 'hide'});
    } finally {
        await target.evaluate(element => {element.removeAttribute('data-opening-contrast'); element.getRootNode().getElementById('opening-contrast').remove();});
    }
    const measurement = measureContrastInRegions(decodePng(image), geometry.fragments, geometry.elementSize);
    records.push({label, selector, ...geometry, ...measurement});
    await writeFile(join(evidence, 'measurements.json'), JSON.stringify(records, null, 2));
    assert.ok(measurement.sampledPixels > 0, `${label} has no rendered text surface`);
    assert.ok(measurement.minimumContrastRatio >= 4.5, `${label} text contrast ${measurement.minimumContrastRatio}:1`);
}

try {
    browser = await launchBrowser();
    const tenant = await runtime.seedTenant({name: 'Opening contrast', email: 'opening@example.test', allowedOrigin: runtime.origin});
    const project = await call(`/api/identity/projects/${tenant.projectId}`, undefined, tenant.token);
    for (const viewport of [{width: 1440, height: 960}, {width: 390, height: 844}]) {
        const page = await browser.newPage({viewport});
        await page.goto(runtime.origin + `/help/${tenant.projectId}`);
        await page.addScriptTag({url: runtime.origin + '/widget.js'});
        await page.evaluate(options => window.h2h('init', options), {
            widgetKey: project.widget_key, apiOrigin: runtime.origin, open: false,
            settings: {collector: {enabled: false}, collect: {require_name: true, require_email: true}},
        });
        await page.getByRole('button', {name: 'Open chat', exact: true}).waitFor();
        // A configured provider and an existing reply make the email-notification
        // offer meaningful. Seed the reply through the native conversation API.
        const storageKey = `rer-widget:${runtime.origin}:${project.widget_key}`;
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.conversationId, storageKey);
        const session = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
        const initial = await call(`/api/conversations/${session.conversationId}/messages`, undefined, tenant.token);
        const reply = await call(`/api/conversations/${session.conversationId}/messages`, {
            localId: `opening-contrast-${viewport.width}-initial`, content: 'Your support reply is ready. How can we help further?',
            expectedRevision: initial.revision, expectedLastMessageId: initial.lastMessageId,
        }, tenant.token);
        assert.equal(reply.accepted, true);
        await page.evaluate(() => {
            const style = document.createElement('style');
            style.id = 'pause-opening-motion';
            style.textContent = '.happytohelp-interact-container {animation-play-state:paused !important}';
            document.querySelector('#happytohelp > div').shadowRoot.appendChild(style);
        });
        await page.evaluate(() => window.h2h('open'));
        await page.locator('textarea[name=content]').waitFor();
        await page.locator('.happytohelp-insight-agent-info').waitFor();
        await page.getByText('Your support reply is ready. How can we help further?', {exact: true}).waitFor();
        for (const time of [0, 16, 75, 150, 300]) {
            await page.locator('.happytohelp-interact-container').evaluate((panel, time) => {
                for (const animation of panel.getAnimations()) {animation.pause(); animation.currentTime = time;}
            }, time);
            const label = `${viewport.width}-opening-${time}`;
            await measure(page, `${label}-response`, '.happytohelp-insight-agent-info');
            await measure(page, `${label}-notification`, '.happytohelp-collect-notify-email');
        }
        await page.locator('.happytohelp-interact-container').evaluate(panel => {
            for (const animation of panel.getAnimations()) animation.finish();
            panel.getRootNode().getElementById('pause-opening-motion').remove();
        });
        await page.locator('textarea[name=content]').fill('A real conversation for the scrolled composer contrast check.');
        await measure(page, `${viewport.width}-composing-response`, '.happytohelp-insight-agent-info');
        await measure(page, `${viewport.width}-composing-notification`, '.happytohelp-collect-notify-email');
        for (let index = 0; index < 12; index++) {
            const transcript = await call(`/api/conversations/${session.conversationId}/messages`, undefined, tenant.token);
            const result = await call(`/api/conversations/${session.conversationId}/messages`, {
                localId: `opening-contrast-${viewport.width}-${index}`, content: `Support update ${index + 1}: Your support conversation remains available while you compose a reply.`,
                expectedRevision: transcript.revision, expectedLastMessageId: transcript.lastMessageId,
            }, tenant.token);
            assert.equal(result.accepted, true);
        }
        await page.getByText('Support update 12: Your support conversation remains available while you compose a reply.', {exact: true}).waitFor();
        // Keep the original transcript and add enough real updates to overflow
        // the panel even when the browser's font metrics produce fewer lines.
        for (let index = 12; index < 24; index++) {
            const transcript = await call(`/api/conversations/${session.conversationId}/messages`, undefined, tenant.token);
            const result = await call(`/api/conversations/${session.conversationId}/messages`, {
                localId: `opening-contrast-${viewport.width}-${index}`, content: `Support update ${index + 1}: Your support conversation remains available while you compose a reply.`,
                expectedRevision: transcript.revision, expectedLastMessageId: transcript.lastMessageId,
            }, tenant.token);
            assert.equal(result.accepted, true);
        }
        await page.getByText('Support update 24: Your support conversation remains available while you compose a reply.', {exact: true}).waitFor();
        const transcript = await page.locator('.happytohelp-chatlist-container').elementHandle();
        try {
            await transcript.evaluate(element => {element.scrollTop = element.scrollHeight;});
            // Wait for the real smooth scroll to reach its bottom before sampling.
            await page.waitForFunction(element => element.scrollTop > 0 &&
                Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 1,
                transcript, {timeout: 15000});
        } finally {
            await transcript.dispose();
        }
        const scroll = await page.locator('.happytohelp-chatlist-container').evaluate(element => {
            return {top: element.scrollTop, height: element.scrollHeight, viewport: element.clientHeight};
        });
        assert.ok(scroll.top > 0 && scroll.height > scroll.viewport, 'real transcript must scroll');
        await page.locator('textarea[name=content]').fill('Continuing the reply after scrolling.');
        await measure(page, `${viewport.width}-scrolled-response`, '.happytohelp-insight-agent-info');
        await measure(page, `${viewport.width}-scrolled-notification`, '.happytohelp-collect-notify-email');
        await page.close();
    }
    success = true;
} finally {
    if (browser) await browser.close();
    await runtime.close(success);
    await writeFile(join(evidence, 'cleanup.json'), JSON.stringify({success, browserClosed: true, workerClosed: true}));
}

}
