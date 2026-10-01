import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Real-browser check of the approved "Customer Support, Solved." homepage (owner approval 2026-10-01).
const origin = process.env.H2H_TEST_ORIGIN;
if (!origin) throw new Error('Set H2H_TEST_ORIGIN to the real native homepage preview');
const evidence = process.env.H2H_EVIDENCE_DIR || '/tmp/h2h-homepage-browser';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const checks = [];
const parseColor = value => {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const [r, g, b, a = 1] = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
};

try {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Content, in order.
  await page.getByRole('heading', { level: 1, name: 'Customer Support, Solved.', exact: true }).waitFor();
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('.hero-copy p').innerText(), 'Free and open source: chat widget, shared inbox, help centre and AI-suggested replies with sources.');
  assert.deepEqual(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id)), ['top', 'product', 'help-before-they-ask', 'agent', 'yours-to-run']);
  assert.deepEqual(await page.locator('main h2').allInnerTexts(), ['The product', 'Help before they ask', 'Your own agent can investigate', 'Yours to run']);
  assert.deepEqual(await page.locator('.parts > li h3').allInnerTexts(), ['Chat widget', 'Shared inbox', 'Help centre', 'AI-suggested replies that cite their sources']);
  assert.deepEqual(await page.locator('.parts > li > p').allInnerTexts(), [
    'Customers reach you from your site or app.',
    'Assignments, notes and customer context are kept together.',
    'Publish searchable articles so customers can find answers themselves.',
    'Your team reviews every suggestion before it is sent.',
  ]);
  assert.deepEqual(await page.locator('.signals li').allInnerTexts(), ['Lingering on a page', 'Sitting idle', 'Scrolling back up', 'Pausing at checkout']);
  const offerCopy = await page.locator('#help-before-they-ask .split-copy > p').innerText();
  for (const phrase of ['offer help once', 'with their consent', 'stays quiet', 'person can always take over']) assert.ok(offerCopy.includes(phrase), phrase);
  const agentCopy = await page.locator('#agent .section-head p').innerText();
  for (const phrase of ['Codex or Claude on your own computer', 'access and scope', 'internal note', 'reviews the replies']) assert.ok(agentCopy.includes(phrase), phrase);
  const yoursCopy = await page.locator('#yours-to-run .split-copy p').innerText();
  for (const phrase of ['free and MIT licensed', 'your own Cloudflare account', 'keep the code and the data', 'paid to the providers you choose']) assert.ok(yoursCopy.includes(phrase), phrase);
  assert.equal(await page.locator('footer').count(), 1);
  assert.deepEqual(await page.locator('footer a').allInnerTexts(), ['HappyToHelp', 'Docs', 'GitHub', 'Workspace', 'Set up', 'Log in', 'MIT licence']);
  assert.equal(await page.locator('.h2h-village, .village-scene, [class*="village"]').count(), 0);
  checks.push('headline, subhead, five sections in order, four product parts, signals, agent and ownership copy, footer');

  // Links derive from package.json repository.url.
  const repository = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).repository.url;
  const links = await page.locator('.h2h-home a').evaluateAll(elements => elements.map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') })));
  const allowed = ['#top', '#product', repository, `${repository}/blob/main/README.md`, `${repository}/blob/main/docs/INSTALLER.md`, `${repository}/blob/main/LICENSE`, '/projects', '/setup', '/login'];
  assert.ok(links.every(link => allowed.includes(link.href)), JSON.stringify(links));
  const hrefOf = text => links.filter(link => link.text === text).map(link => link.href);
  assert.deepEqual(hrefOf('Get the code'), [repository, repository, repository]);
  assert.deepEqual(hrefOf('Read the docs'), [`${repository}/blob/main/README.md`]);
  assert.deepEqual(hrefOf('Read the installation guide'), [`${repository}/blob/main/docs/INSTALLER.md`]);
  assert.deepEqual(hrefOf('MIT licence'), [`${repository}/blob/main/LICENSE`]);
  assert.deepEqual(hrefOf('GitHub'), [repository, repository]);
  for (const href of ['/projects', '/setup', '/login']) assert.ok(links.some(link => link.href === href), href);
  checks.push('every link is the repository, its README, installer guide or licence, or a local workspace route');

  // One open-licensed geometric sans-serif for every piece of type, actually loaded.
  const families = await page.locator('.h2h-home').evaluate(root => {
    const found = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const family = getComputedStyle(node.parentElement).fontFamily.split(',')[0].trim().replace(/["']/g, '');
      found.set(family, (found.get(family) || 0) + 1);
    }
    return [...found.entries()];
  });
  assert.deepEqual(families.map(([family]) => family), ['Outfit'], JSON.stringify(families));
  assert.ok(await page.evaluate(() => [...document.fonts].some(face => face.family.replace(/["']/g, '') === 'Outfit' && face.status === 'loaded')), 'Outfit font faces loaded');
  assert.ok(await page.evaluate(() => document.fonts.check('500 40px Outfit')));
  assert.ok(await page.locator('link[rel="stylesheet"][href^="https://fonts.googleapis.com/css2?family=Outfit"]').count() === 1);
  checks.push('all type is Outfit and the font faces loaded');

  // Paper, ink and a monochrome page: colour only inside the drawings.
  assert.deepEqual(await page.locator('body').evaluate(body => [getComputedStyle(body).paddingTop, getComputedStyle(body).marginTop]), ['0px', '0px'], 'no dashboard body spacing');
  const paper = parseColor(await page.locator('.h2h-home').evaluate(el => getComputedStyle(el).backgroundColor));
  assert.deepEqual([paper.r, paper.g, paper.b], [246, 242, 234]);
  const grain = await page.locator('.h2h-home').evaluate(el => getComputedStyle(el).backgroundImage);
  assert.ok(grain.includes('feTurbulence'), 'faint paper grain');
  const coloured = await page.locator('.h2h-home').evaluate(root => {
    const bad = [];
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.drawing')) continue;
      const style = getComputedStyle(el);
      const probes = [['color', style.color], ['background', style.backgroundColor]];
      if (parseFloat(style.borderTopWidth) > 0) probes.push(['border', style.borderTopColor]);
      if (style.textDecorationLine !== 'none') probes.push(['decoration', style.textDecorationColor]);
      for (const [name, value] of probes) {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) continue;
        const [r, g, b, a = 1] = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        if (a > 0 && Math.max(r, g, b) - Math.min(r, g, b) > 14) bad.push(`${el.tagName.toLowerCase()}.${el.className} ${name} ${value}`);
      }
    }
    return bad;
  });
  assert.deepEqual(coloured, [], 'page chrome stays monochrome');
  const cyan = await page.locator('.drawing *').evaluateAll(elements => elements.filter(el => getComputedStyle(el).backgroundColor === 'rgb(214, 245, 250)' || getComputedStyle(el).borderTopColor === 'rgb(143, 227, 238)').length);
  assert.ok(cyan >= 10, `soft cyan accents inside the drawings (${cyan})`);
  const buttons = await page.locator('.pill--ink').evaluateAll(els => els.map(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).borderTopLeftRadius]));
  assert.ok(buttons.length === 3 && buttons.every(([bg, fg, radius]) => bg === 'rgb(20, 20, 20)' && fg === 'rgb(255, 255, 255)' && parseFloat(radius) >= 20), JSON.stringify(buttons));
  checks.push('warm paper with grain, near-black ink, black pill buttons, no colour outside the drawings');

  // Drawings: real DOM text, one accessible label each, no raster images, legible at every width.
  assert.equal(await page.locator('img').count(), 0);
  const drawings = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => ({ role: figure.getAttribute('role'), label: figure.getAttribute('aria-label') })));
  assert.equal(drawings.length, 8);
  assert.ok(drawings.every(drawing => drawing.role === 'img' && drawing.label.length > 40), JSON.stringify(drawings));
  assert.ok((await page.locator('.hero-art').getAttribute('aria-label')).includes('Billing FAQ'));
  assert.ok((await page.locator('.offer-art').getAttribute('aria-label')).includes('Yes please and No thanks'));
  assert.ok((await page.locator('.agent-art').getAttribute('aria-label')).includes('terminal beside an internal note'));
  assert.ok(await page.locator('.drawing .d-icon').evaluateAll(icons => icons.every(icon => icon.getAttribute('aria-hidden') === 'true')));
  assert.equal(await page.locator('.drawing a, .drawing button, .drawing input').count(), 0, 'drawn controls are not interactive');
  const heroText = await page.locator('.hero-art').innerText();
  for (const text of ['Maya Chen', 'Tom Reyes', 'Priya Shah', 'Sam Ortiz', 'Suggested reply', 'Source: Billing FAQ', 'Edit', 'Send']) assert.ok(heroText.includes(text), text);
  assert.ok((await page.locator('.offer-art').innerText()).includes('Yes please') && (await page.locator('.offer-art').innerText()).includes('No thanks'));
  const agentText = await page.locator('.agent-art').innerText();
  for (const text of ['claude', 'read-only', 'Internal note', 'waiting for your review']) assert.ok(agentText.includes(text), text);
  checks.push('eight labelled drawings built from real text, no raster images');

  // Layout at every width: no overflow, two-line headline on wide screens, legible drawings, nothing clipped.
  for (const width of [320, 390, 723, 768, 860, 861, 959, 1100, 1200, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(metrics.scroll <= metrics.client, `horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    const lines = await page.locator('#hero-title > span').evaluateAll(spans => spans.map(span => ({ text: span.textContent, top: span.getBoundingClientRect().top })));
    assert.deepEqual(lines.map(line => line.text), ['Customer Support,', 'Solved.']);
    if (width >= 861) assert.ok(lines[0].top < lines[1].top, `headline breaks after the comma at ${width}px`);
    const fontSize = await page.locator('h1').evaluate(h1 => parseFloat(getComputedStyle(h1).fontSize));
    assert.ok(fontSize >= 40, `headline size ${fontSize} at ${width}`);
    const outside = await page.locator('.drawing').evaluateAll((figures, viewport) => figures.flatMap(figure => [...figure.querySelectorAll('*')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1);
    }).map(el => `${el.tagName}.${el.getAttribute('class')}`)), metrics.client);
    assert.deepEqual(outside, [], `drawing parts outside the viewport at ${width}px`);
    const tiny = await page.locator('.drawing').evaluateAll(figures => figures.flatMap(figure => [...figure.querySelectorAll('*')].filter(el => {
      const rect = el.getBoundingClientRect();
      const hasText = [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
      return hasText && rect.width > 0 && rect.height > 0 && parseFloat(getComputedStyle(el).fontSize) < 11;
    }).map(el => `${el.className} ${getComputedStyle(el).fontSize} ${el.textContent.trim().slice(0, 24)}`)));
    assert.deepEqual(tiny, [], `drawing text under 11px at ${width}px`);
    const buttonsOk = await page.locator('.pill').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).every(el => el.getBoundingClientRect().height >= 40));
    assert.ok(buttonsOk, `pill targets at ${width}px`);
    if (width === 390) {
      assert.equal(await page.locator('.hero-list').evaluate(el => getComputedStyle(el).display), 'none', 'narrow hero shows the open conversation only');
      assert.equal(await page.locator('.parts').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
    }
    if (width === 1440) assert.equal(await page.locator('.parts').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
  }
  checks.push('no horizontal overflow, headline breaking, drawing text of 11px or more and contained marks at 12 widths from 320px to 1920px');

  // Motion: marks draw in once; reduced motion removes every animation and transition and smooth scrolling.
  await page.setViewportSize({ width: 1440, height: 900 });
  const motion = () => page.locator('.h2h-home').evaluate(root => ({
    animated: [...root.querySelectorAll('.d-marks path')].filter(path => getComputedStyle(path).animationName !== 'none').length,
    transitions: [...root.querySelectorAll('.pill')].filter(el => parseFloat(getComputedStyle(el).transitionDuration) > 0).length,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  const full = await motion();
  assert.ok(full.animated > 0 && full.transitions > 0 && full.scrollBehavior === 'smooth', JSON.stringify(full));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  assert.deepEqual(await motion(), { animated: 0, transitions: 0, scrollBehavior: 'auto' });
  const frozen = await page.locator('.d-marks path').first().evaluate(path => getComputedStyle(path).strokeDashoffset);
  assert.ok(['0px', '0'].includes(frozen), `marks fully drawn under reduced motion (${frozen})`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push('marks animate once by default; reduced motion disables animation, transitions and smooth scrolling');

  // Keyboard and anchors.
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Skip to the product');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#product');
  await page.getByRole('link', { name: 'HappyToHelp' }).last().click();
  assert.equal(new URL(page.url()).hash, '#top');
  checks.push('skip link and wordmark anchors work from the keyboard and pointer');

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${evidence}/homepage-${width}-fold.png` });
    await page.screenshot({ path: `${evidence}/homepage-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/results.json`, JSON.stringify({ origin, checks, errors }, null, 2));
  console.log(checks.join('\n'));
} finally { await browser.close(); }
