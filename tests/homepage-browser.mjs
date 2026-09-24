import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.H2H_TEST_ORIGIN;
if (!origin) throw new Error('Set H2H_TEST_ORIGIN to the real native homepage preview');
const evidence = process.env.H2H_EVIDENCE_DIR || '/tmp/h2h-village-browser';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const checks = [];
try {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: 'Support. Free. Yours.' }).waitFor();
  assert.equal(await page.locator('main > section').count(), 5);
  assert.equal(await page.locator('footer').count(), 1);
  assert.equal(await page.locator('.chat, .answer').count(), 0);
  const links = await page.locator('.h2h-village a').evaluateAll(elements => elements.map(el => el.getAttribute('href')));
  const repository = 'https://github.com/runeditrun/support-happytohelp';
  const allowed = ['#top', '#features', repository, `${repository}/blob/main/README.md`, `${repository}/blob/main/docs/INSTALLER.md`, '/projects', '/setup', '/login'];
  assert.ok(links.every(href => allowed.includes(href)), JSON.stringify(links));
  for (const href of ['/projects', '/setup', '/login']) assert.ok(links.includes(href));
  for (const width of [320, 390, 723, 768, 959, 960, 1199, 1200, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).paddingTop), '0px', `no dashboard body spacing at ${width}px`);
    const headlineLines = await page.locator('#hero-title > span').evaluateAll(lines => lines.map(line => ({ text: line.textContent, top: line.getBoundingClientRect().top, height: line.getBoundingClientRect().height })));
    assert.deepEqual(headlineLines.map(line => line.text), ['Support.', 'Free.', 'Yours.']);
    assert.ok(headlineLines[0].top < headlineLines[1].top && headlineLines[1].top < headlineLines[2].top, `three separate hero lines at ${width}px`);
    assert.ok(headlineLines.every(line => line.height > 0));
    const metrics = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(metrics.scroll <= metrics.client, `horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    const missingImages = await page.locator('img').evaluateAll(images => images.filter(img => img.complete && !img.naturalWidth).map(img => img.src));
    assert.deepEqual(missingImages, []);
    checks.push(`three explicit hero lines and no horizontal overflow at ${width}px`);
  }
  for (const section of await page.locator('main > section').all()) {
    await section.scrollIntoViewIfNeeded();
    await section.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  }
  assert.equal(await page.locator('.village-scene img').count(), 7);
  assert.deepEqual(await page.locator('.village-scene img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src)), []);
  checks.push('all seven scene image layers loaded and decoded across all five sections');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const heights = {};
  for (const name of ['hero', 'context']) {
    const selector = `.village-scene-${name}`;
    const scene = page.locator(selector);
    await scene.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
    await page.waitForFunction(selector => document.querySelector(selector)?.dataset.parallaxState === 'active', selector);
    const initial = await scene.evaluate(el => el.style.getPropertyValue('--scene-y'));
    heights[name] = (await scene.boundingBox()).height;
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.waitForFunction(({selector, initial}) => document.querySelector(selector)?.style.getPropertyValue('--scene-y') !== initial, {selector, initial});
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(selector => document.querySelector(selector)?.dataset.parallaxState === 'offscreen', selector);
    const frozen = await scene.evaluate(el => el.style.getPropertyValue('--scene-y'));
    await page.evaluate(() => window.scrollBy(0, -100));
    await page.waitForTimeout(150);
    assert.equal(await scene.evaluate(el => el.style.getPropertyValue('--scene-y')), frozen);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const name of ['hero', 'context']) {
    const selector = `.village-scene-${name}`;
    await page.waitForFunction(selector => document.querySelector(selector)?.dataset.parallaxState === 'reduced', selector);
    assert.equal(await page.locator(`${selector} .scene-foreground`).evaluate(el => getComputedStyle(el).transform), 'none');
    assert.equal((await page.locator(selector).boundingBox()).height, heights[name]);
  }
  checks.push('both independent foregrounds move on scroll, stop offscreen, and disable transforms for reduced motion without changing layout');
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Features', exact: true }).click();
  assert.equal(new URL(page.url()).hash, '#features');
  checks.push('real feature anchor navigation and repository/local destination allowlist');
  for (const width of [1440, 960, 723, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${evidence}/homepage-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/results.json`, JSON.stringify({ origin, checks, errors }, null, 2));
  console.log(checks.join('\n'));
} finally { await browser.close(); }
