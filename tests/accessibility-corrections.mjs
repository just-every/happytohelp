import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {contrastRatio} from './helpers/accessibility-contrast.mjs';
import {measureFocusIndicator} from './helpers/accessibility-focus-contrast.mjs';

const {chromium} = await import(process.env.H2H_PLAYWRIGHT_MODULE || 'playwright');
const evidenceDir = resolve(process.env.H2H_EVIDENCE_DIR || '/tmp/h2h-accessibility-corrections');
await mkdir(evidenceDir, {recursive: true});
const source = await readFile(new URL('../src/ui/dashboard/components/dialogTabBoundary.js', import.meta.url), 'utf8');
const browser = await chromium.launch({headless: true});
const checks = [];
try {
    const page = await browser.newPage();
    // Component-level test fixture, never application mock data or a mocked runtime.
    await page.setContent(`<style>body{margin:40px;background:white}button:focus{outline:2px solid rgba(113,62,224,.4);outline-offset:4px}button{height:40px;width:140px}</style>
      <button id="outside">Outside</button><div id="dialog" role="dialog" tabindex="-1" aria-label="Test dialog">
      <button id="first">Close</button><fieldset disabled><input aria-label="Disabled fieldset"></fieldset>
      <div inert><button>Inert</button></div><button hidden>Hidden</button><button tabindex="-1">Programmatic only</button>
      <textarea id="note" aria-label="Note"></textarea><button id="last">Add</button></div>`);
    await page.evaluate(async source => {
        const {trapDialogTab} = await import('data:text/javascript;base64,' + btoa(source));
        document.querySelector('#dialog').addEventListener('keydown', trapDialogTab);
    }, source);
    await page.locator('#first').focus();
    for (const direction of ['Tab', 'Shift+Tab']) {
        for (let repeat = 0; repeat < 3; repeat++) {
            const expected = direction === 'Tab' ? ['note', 'last', 'first'] : ['last', 'note', 'first'];
            for (const id of expected) {
                await page.keyboard.press(direction);
                assert.equal(await page.evaluate(() => document.activeElement.id), id);
            }
        }
    }
    checks.push('18 Tab presses wrap both ways and skip disabled fieldsets, inert, hidden and negative-tabindex controls');
    await page.locator('#dialog').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
    await page.locator('#dialog').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
    checks.push('dialog-container entry reaches first/last control according to direction');
    await page.locator('#dialog').evaluate(dialog => dialog.querySelectorAll('button,input,textarea').forEach(control => {control.disabled = true;}));
    await page.locator('#dialog').focus();
    for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'dialog');
    }
    checks.push('busy/no-tabbable state retains focus on the dialog');
    await page.locator('#last').evaluate(control => {control.disabled = false;});
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
    checks.push('dynamic one-control state remains operable in both directions');
    await page.locator('#outside').focus();
    const translucent = await measureFocusIndicator(page, {samplePixels: true});
    assert.ok(translucent.ringContrastAgainstHalo > 1.8 && translucent.ringContrastAgainstHalo < 2);
    assert.ok(translucent.pixelSample.contrastRatio > 1.8 && translucent.pixelSample.contrastRatio < 2);
    assert.equal(contrastRatio('rgb(113,62,224)', 'rgb(255,255,255)'), 6.06);
    checks.push('translucent purple focus regression fails 3:1 at about 1.90:1, despite opaque RGB ratio 6.06:1');
    await page.addStyleTag({content: 'button:focus {outline-color: #005fcc}'});
    const opaque = await measureFocusIndicator(page, {samplePixels: true});
    assert.ok(opaque.ringContrastAgainstHalo >= 3 && opaque.pixelSample.contrastRatio >= 3);
    checks.push('opaque focus passes both alpha compositing and independently sampled screenshot pixels');
    await page.screenshot({path: join(evidenceDir, 'focus-oracle-regression.png')});
    await writeFile(join(evidenceDir, 'correction-regressions.json'), JSON.stringify({checks, translucent, opaque}, null, 2));
    console.log(JSON.stringify({passed: checks.length, checks}, null, 2));
} finally {
    await browser.close();
}
