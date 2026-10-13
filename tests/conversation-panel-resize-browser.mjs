import assert from 'node:assert/strict';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {navigationFixture} from './helpers/navigation-fixture.mjs';

const {chromium} = await import(process.env.H2H_PLAYWRIGHT_MODULE || 'playwright');
const evidence = join(process.env.H2H_EVIDENCE_DIR ? resolve(process.env.H2H_EVIDENCE_DIR) : await mkdtemp(join(tmpdir(), 'h2h-conversation-panel-resize-')), 'conversation-panel-resize');
await mkdir(evidence, {recursive:true});
// Optional fixed ports for runs that must stay inside an assigned port range.
const optionalPort = name => process.env[name] ? Number(process.env[name]) : undefined;
const runtime = await createRuntime({port:optionalPort('H2H_RUNTIME_PORT') ?? 0, inspectorPort:optionalPort('H2H_RUNTIME_INSPECTOR_PORT')});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
let success = false;
try {
  const fixture = await navigationFixture(runtime.origin);
  await page.goto(runtime.origin + '/login?' + new URLSearchParams({returnTo:`/projects/${fixture.projects[0].id}/conversations`}));
  await page.getByLabel('Email', {exact:true}).fill(fixture.email);
  await page.getByLabel('Password', {exact:true}).fill(fixture.password);
  await page.getByRole('button', {name:'Login',exact:true}).click();
  await page.waitForURL('**/projects/**');
  await page.locator('nav[data-testid="inbox-views"] a[href*="view=open"]').click();
  await page.locator('.conversation-list-items').getByText('Alpha Visitor',{exact:true}).click();
  await page.locator('#chat .main').getByText(fixture.projects[0].message,{exact:true}).waitFor({state:'visible'});
  const panel = page.locator('#conversation-assistant');
  await page.waitForFunction(() => document.querySelector('#conversation-assistant')?.getAttribute('aria-hidden') === 'false');
  await page.screenshot({path:evidence + '/desktop-open.png'});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(() => document.querySelector('#conversation-assistant')?.getAttribute('aria-hidden') === 'true');
  await panel.waitFor({state:'hidden'});
  const composer = page.locator('#chat .main textarea').first();
  await composer.click();
  assert.equal(await composer.evaluate(el => el === document.activeElement), true);
  assert.ok(await page.locator('#chat .main').getByText(fixture.projects[0].message,{exact:true}).isVisible());
  checks.push('desktop open panel closes after resize; mobile transcript and composer usable');
  await page.screenshot({path:evidence + '/resized-closed.png'});
  await page.reload();
  await panel.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Show conversation panel',exact:true}).click();
  const hide = panel.getByRole('button',{name:'Hide',exact:true});
  await hide.waitFor();
  // Wait for the existing sheet transition before measuring its final position.
  await page.waitForFunction(() => {
    const button = document.querySelector('.conversation-assistant__hide');
    const box = button?.getBoundingClientRect();
    return box && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
  });
  await page.screenshot({path:evidence + '/mobile-manual-open.png'});
  await hide.click();
  await panel.waitFor({state:'hidden'});
  await composer.click();
  checks.push('fresh mobile starts closed; manual open keeps Hide within viewport; close restores composer');
  assert.deepEqual(errors, []);
  success = true;
} finally {
  await page.screenshot({path:evidence + '/final.png'}).catch(() => {});
  await writeFile(evidence + '/result.json', JSON.stringify({success,checks,errors},null,2));
  await browser.close();
  await runtime.close(success);
}
console.log('Conversation panel resize browser checks passed:', evidence);
