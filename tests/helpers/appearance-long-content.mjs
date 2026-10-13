import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {assertHelpSearchFits, assertHelpSearchReachable} from './appearance-geometry.mjs';

async function saveAppearance(page, origin, projectId, values) {
 await page.goto(`${origin}/projects/${projectId}/edit`);
 await page.getByRole('button', {name: 'Appearance', exact: true}).click();
 await page.getByText('Additional branding', {exact: true}).click();
 for (const [label, value] of [['Public brand name', values.brand_name], ['Welcome greeting', values.welcome_message]]) {
  await page.getByLabel(label, {exact: true}).fill(value);
 }
 await page.getByRole('button', {name: 'Update', exact: true}).click();
 await page.getByRole('status').filter({hasText: 'Saved.'}).waitFor();
 await page.reload();
 await page.getByRole('button', {name: 'Appearance', exact: true}).click();
 await page.getByText('Additional branding', {exact: true}).click();
 assert.equal(await page.getByLabel('Public brand name', {exact: true}).inputValue(), values.brand_name);
 assert.equal(await page.getByLabel('Welcome greeting', {exact: true}).inputValue(), values.welcome_message);
}

async function assertTextFits(locator) {
 await locator.evaluate(element => {
  const bounds = element.getBoundingClientRect(), range = document.createRange();
  range.selectNodeContents(element);
  for (const line of range.getClientRects()) {
   if (line.left < bounds.left - 1 || line.right > bounds.right + 1) throw Error('Saved text escapes its surface');
  }
  if (element.clientWidth && element.scrollWidth > element.clientWidth + 1) throw Error('Text surface has horizontal overflow');
 });
}

async function assertWidgetFits(page, message) {
 const panel = page.locator('.happytohelp-interact');
 await panel.evaluate(panel => {
  const root = panel.getRootNode();
  for (const element of [panel, root.querySelector('.happytohelp-chat-header-container'), root.querySelector('.happytohelp-chatlist-container')]) {
   if (element.scrollWidth > element.clientWidth + 1) throw Error('Widget surface has horizontal overflow');
  }
 });
 for (const locator of [page.locator('textarea[name=content]'), page.locator('button[name=submit]'), ...(message ? [page.getByText(message, {exact: true})] : [])]) {
  const bounds = await locator.boundingBox(), surface = await panel.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && surface);
  assert.ok(bounds.y >= Math.max(0, surface.y) - 1 && bounds.y + bounds.height <= Math.min(viewport.height, surface.y + surface.height) + 1 && bounds.x >= surface.x - 1 && bounds.x + bounds.width <= surface.x + surface.width + 1,
   `Widget control or newest text remains visible: ${JSON.stringify({bounds, surface})}`);
 }
}

async function tabWithinWidget(page, target, key) {
 const visited = await target.evaluateHandle(element => new Set([element.getRootNode().activeElement]));
 try {
  let reached = false;
  while (!reached) {
   await page.keyboard.press(key);
   reached = await target.evaluate((element, visited) => {
    const active = element.getRootNode().activeElement;
    if (!active || !element.closest('.happytohelp-interact').contains(active)) throw Error('Keyboard focus escaped the widget before reaching its target');
    if (visited.has(active)) throw Error('Keyboard focus cycled before reaching its target');
    visited.add(active);
    return active === element;
   }, visited);
  }
 } finally {
  await visited.dispose();
 }
}

async function assertTranscriptKeyboardScroll(page) {
 const transcript = page.getByRole('region', {name: 'Conversation transcript', exact: true});
 const composer = page.locator('textarea[name=content]');
 // The suite keeps several pages open. Native keyboard scrolling needs the
 // visitor tab active as well as its DOM element focused, especially on macOS.
 await page.bringToFront();
 await composer.focus();
 await tabWithinWidget(page, transcript, 'Shift+Tab');
 assert.ok(await transcript.evaluate(element => element === element.getRootNode().activeElement), 'Keyboard reaches the transcript from the composer');
 const overflowing = await transcript.evaluate(element => {
  const style = getComputedStyle(element);
  if (style.outlineStyle === 'none' || parseFloat(style.outlineWidth) === 0) throw Error('Transcript keyboard focus is not visible');
  return element.scrollHeight > element.clientHeight + 1;
 });
 if (overflowing) {
  const element = await transcript.elementHandle();
  try {
   await page.keyboard.press('Home');
   await page.waitForFunction(element => element.scrollTop <= 1, element);
   await page.keyboard.press('PageDown');
   try {
    await page.waitForFunction(element => element.scrollTop > 1, element);
   } catch (error) {
    const state = await transcript.evaluate(element => ({viewport: {width: innerWidth, height: innerHeight},
     scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
     elementFocused: element.getRootNode().activeElement === element, documentFocused: document.hasFocus(),
     visibility: document.visibilityState, scrollBehavior: getComputedStyle(element).scrollBehavior}));
    console.error('Transcript keyboard scroll failed:', state);
    await writeFile(join(resolve(process.env.H2H_EVIDENCE_DIR || 'test-results/appearance'), 'keyboard-failure.json'),
     JSON.stringify({state, error: error.stack}, null, 2));
    throw error;
   }
   await page.keyboard.press('Home');
   await page.waitForFunction(element => element.scrollTop <= 1, element);
  } finally {
   await element.dispose();
  }
 }
 await tabWithinWidget(page, composer, 'Tab');
 assert.ok(await composer.evaluate(element => element === element.getRootNode().activeElement), 'Keyboard returns from the transcript to the composer');
 return overflowing;
}

async function assertArticleKeyboardScroll(page, precedingLink) {
 await precedingLink.focus();
 for (const name of ['Code block', 'Article table']) {
  const scroller = page.getByRole('region', {name, exact: true});
  await page.keyboard.press('Tab');
  assert.ok(await scroller.evaluate(element => document.activeElement === element), `Tab reaches the ${name}`);
  await scroller.evaluate(element => {
   const style = getComputedStyle(element);
   if (style.outlineStyle === 'none' || parseFloat(style.outlineWidth) === 0) throw Error('Article scroll region keyboard focus is not visible');
   if (element.scrollWidth <= element.clientWidth) throw Error('Wide article fixture must exercise scrolling');
   element.scrollLeft = element.scrollWidth;
   if (!element.scrollLeft) throw Error('Wide content cannot be scrolled');
   element.scrollLeft = 0;
  });
  const element = await scroller.elementHandle();
  try {
   await page.keyboard.press('ArrowRight');
   await page.waitForFunction(element => element.scrollLeft > 1, element);
  } finally {
   await element.dispose();
  }
 }
 await page.keyboard.press('Shift+Tab');
 assert.ok(await page.getByRole('region', {name: 'Code block', exact: true}).evaluate(element => document.activeElement === element), 'Shift+Tab returns from the table to the code block');
 await page.keyboard.press('Shift+Tab');
 assert.ok(await precedingLink.evaluate(element => document.activeElement === element), 'Keyboard can leave the article scroll regions');
}

/** One native save → public search/article → visitor chat flow at both release widths. */
export async function exerciseLongAppearance({page, browser, origin, tenant, project, api, brand, audit}) {
 const keyboardScrollChecks = [];
 const identifier = 'account_reference_'.repeat(10);
 const values = {
  brand_name: `Orchid international account assistance ${identifier}`,
  welcome_message: `Welcome to Orchid account assistance.\n${'Please describe the account issue and keep this reference for our team. '.repeat(8)}\n${identifier}`,
 };
 await saveAppearance(page, origin, tenant.projectId, values);
 const title = `Long content guide ${identifier}`;
 const url = `https://example.test/support/${identifier}`;
 const columns = Array.from({length: 18}, (_, index) => `Column ${index + 1}`);
 const content = `Use reference ${identifier}.\n\n[${url}](${url})\n\n\`\`\`text\n${identifier.repeat(5)}\n\`\`\`\n\n| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n| ${columns.map(() => identifier).join(' | ')} |`;
 const published = await api(`/api/knowledge/${tenant.projectId}/articles`, {token: tenant.token, body: {title, slug: 'long-content-guide', content, status: 'published'}});
 assert.equal(published.status, 201);
 for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
  await page.setViewportSize(viewport);
  await page.goto(`${origin}/projects/${tenant.projectId}/widget-settings`);
  await page.getByRole('tab', {name: 'Theme', exact: true}).click();
  await page.locator('#happytohelp .happytohelp-welcome p').waitFor();
  assert.equal(await page.locator('#happytohelp .happytohelp-welcome p').textContent(), values.welcome_message);
  await assertTextFits(page.locator('#happytohelp .happytohelp-brand-heading span'));
  await assertTextFits(page.locator('#happytohelp .happytohelp-welcome p'));
  await audit(page, `${viewport.width}-long-preview`);
  keyboardScrollChecks.push(await assertTranscriptKeyboardScroll(page));
  const context = await browser.newContext({viewport}), visitor = await context.newPage();
  try {
   const base = `${origin}/help/${tenant.projectId}`;
   await visitor.goto(base);
   assert.equal(await visitor.locator('.help-center-welcome p').textContent(), values.welcome_message);
   await assertTextFits(visitor.locator('.help-center-brand > span'));
   await assertTextFits(visitor.locator('.help-center-welcome p'));
   await assertHelpSearchFits(visitor);
   await audit(visitor, `${viewport.width}-long-help-index`);
   await visitor.getByRole('searchbox', {name: 'Search the Help Center'}).fill('Long content guide');
   await visitor.getByRole('button', {name: 'Search', exact: true}).click();
   await visitor.getByRole('link', {name: title, exact: true}).waitFor();
   await audit(visitor, `${viewport.width}-long-help-search`);
   await visitor.getByRole('link', {name: title, exact: true}).click();
   await visitor.getByRole('heading', {name: title, exact: true}).waitFor();
   await assertTextFits(visitor.getByRole('heading', {name: title, exact: true}));
   const longLink = visitor.getByRole('link', {name: url, exact: true});
   await assertTextFits(longLink);
   assert.equal(await longLink.getAttribute('href'), url);
   const table = visitor.getByRole('table');
   assert.deepEqual(await table.getByRole('columnheader').allTextContents(), columns);
   assert.deepEqual(await table.getByRole('cell').allTextContents(), columns.map(() => identifier));
   await assertArticleKeyboardScroll(visitor, longLink);
   await audit(visitor, `${viewport.width}-long-help-article`);
   await visitor.goto(base);
   await visitor.addScriptTag({url: origin + '/widget.js'});
   await visitor.evaluate(options => window.h2h('init', options), {widgetKey: project.widget_key, apiOrigin: origin, open: true, settings: {collector: {enabled: false}}});
   await visitor.locator('.happytohelp-welcome p').waitFor();
   await visitor.locator('.happytohelp-connection-state').waitFor({state: 'hidden'});
   assert.equal(await visitor.locator('.happytohelp-welcome p').textContent(), values.welcome_message);
   await assertTextFits(visitor.locator('.happytohelp-brand-heading span'));
   await assertTextFits(visitor.locator('.happytohelp-welcome p'));
   await assertWidgetFits(visitor);
   if (viewport.width === 1440) await assertHelpSearchReachable(visitor);
   await audit(visitor, `${viewport.width}-long-widget-greeting`);
   keyboardScrollChecks.push(await assertTranscriptKeyboardScroll(visitor));
   const message = `Please help with ${identifier}`;
   await visitor.locator('textarea[name=content]').fill(message);
   await visitor.locator('button[name=submit]').click();
   await visitor.getByText(message, {exact: true}).waitFor();
   await visitor.waitForTimeout(1000); // Settle native transcript/composer motion without correcting scroll.
   await assertWidgetFits(visitor, message);
   await audit(visitor, `${viewport.width}-long-widget-sent`);
   await visitor.locator(viewport.width <= 500 ? '.happytohelp-close' : '.happytohelp-button[aria-label="Close chat"]').click();
   await visitor.getByRole('button', {name: 'Open chat', exact: true}).click();
   await visitor.getByText(message, {exact: true}).waitFor();
   await visitor.waitForTimeout(1000);
   await assertWidgetFits(visitor, message);
   await audit(visitor, `${viewport.width}-long-widget-reopened`);
  } finally {
   await context.close();
  }
 }
 assert.ok(keyboardScrollChecks.some(Boolean), 'Long greetings exercise actual keyboard scrolling');
 await saveAppearance(page, origin, tenant.projectId, brand);
}
