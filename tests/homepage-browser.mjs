import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
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
page.on('requestfailed', request => errors.push(`request failed: ${request.url()}`));
page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
const requested = [];
page.on('request', request => requested.push(request.url()));
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const axeViolations = async () => {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`));
};
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

  // Content, in order. The page is the clarity pass: one idea per section, free plainly and absolutely, nothing small-print.
  await page.getByRole('heading', { level: 1, name: 'Customer Support, Solved.', exact: true }).waitFor();
  assert.equal(await page.locator('h1').count(), 1);
  const subhead = await page.locator('.hero-sub').innerText();
  assert.equal(subhead, 'Your Codex or Claude fixes the problem and writes the reply. You press Send.');
  assert.equal(subhead.split(/\s+/).length, 14, 'the subhead stays at 14 words');
  assert.equal(await page.locator('.hero-free').innerText(), '100% free and open source.');
  assert.equal(await page.locator('.hero-examples').count(), 0, 'the examples strip is removed');
  assert.deepEqual(await page.locator('.hero-steps li').allInnerTexts(), ['The customer asks', 'The agent fixes it', 'You press Send']);
  assert.deepEqual(await page.locator('.hero-copy .actions a').allInnerTexts(), ['Get the code', 'Read the docs'], 'the hero has two controls and no third');
  assert.deepEqual(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id)), ['top', 'free', 'help-before-they-ask', 'product', 'move-in', 'get-started']);
  assert.deepEqual(await page.locator('main h2').allInnerTexts(), ['Not just better. Free.', 'Help before they ask', 'The rest of your support desk', 'Try it beside what you have', 'Ready when you are.']);
  assert.equal(await page.locator('#product .section-head p').count(), 0, 'the Product heading has no sub-line');
  assert.deepEqual(await page.locator('.parts > li h3').allInnerTexts(), ['Chat widget', 'Shared inbox', 'Help centre', 'Suggested replies']);
  assert.deepEqual(await page.locator('.parts > li > p').allInnerTexts(), [
    'Right on your website.',
    'Chat and email, in one place.',
    'Answers customers find themselves.',
    'Drafted from your own articles, with sources.',
  ]);
  assert.equal(await page.locator('.signals').count(), 0, 'the signals list is removed');
  assert.equal(await page.locator('#help-before-they-ask .split-copy > p').innerText(), 'Some customers who get stuck never write in. They just leave. When someone seems stuck, the widget offers a hand.');
  assert.equal(await page.locator('#help-before-they-ask .actions, #help-before-they-ask a').count(), 0, 'Help before they ask has no calls to action');
  assert.equal(await page.locator('#free .split-copy > p').innerText(), 'HappyToHelp is 100% free and open source. Free as in code, and free as in cost. It’s MIT licensed, so it’s yours to use, change and run however you like.');
  assert.deepEqual(await page.locator('#free .proof li').allInnerTexts(), ['No seats.', 'No plans.', 'No fees.']);
  assert.deepEqual(await page.locator('#free .actions a').allInnerTexts(), ['Get the code']);
  assert.equal(await page.locator('#move-in .split-copy > p').innerText(), 'Keep your current helpdesk running while you try it.');
  assert.deepEqual((await page.locator('#move-in .steps li').allInnerTexts()).map(text => text.replace(/\s+/g, ' ')), [
    'Install it. Codex or Claude can help.',
    'Bring your help centre. From Zendesk, Intercom or Freshdesk.',
    'Add the chat widget. One script tag on your site.',
  ]);
  assert.deepEqual(await page.locator('#move-in .steps li > b').allInnerTexts(), ['Install it.', 'Bring your help centre.', 'Add the chat widget.']);
  assert.deepEqual(await page.locator('#move-in .actions a').allInnerTexts(), ['Read the installation guide'], 'Move in has a text link and no pill');
  assert.deepEqual(await page.locator('#get-started').evaluate(section => [...section.children].map(child => child.textContent.trim())), ['Ready when you are.', 'Get the codeRead the docs'], 'the closing band is a heading and two links');
  assert.deepEqual(await page.locator('#get-started .actions a').allInnerTexts(), ['Get the code', 'Read the docs']);
  assert.equal(await page.locator('#get-started h2').evaluate(h2 => getComputedStyle(h2.closest('section')).textAlign), 'center', 'the closing band is centred');
  assert.equal(await page.locator('footer').count(), 1);
  assert.deepEqual(await page.locator('footer a').allInnerTexts(), ['HappyToHelp', 'Docs', 'GitHub', 'Workspace', 'Set up', 'Log in', 'MIT licence']);
  assert.ok(!(await page.locator('[class*="village"], [class*="parallax"]').count()), 'retired homepage markup is absent');
  // Free means free: nothing on the page, in its labels, title or description, names a price, a host, a provider or Run Edit Run.
  const pageText = await page.locator('.h2h-home').innerText();
  const labels = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => figure.getAttribute('aria-label')).join(' '));
  const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
  assert.equal(metaDescription, 'Customer support, solved. Your Codex or Claude fixes the problem and writes the reply; you press Send. Chat widget, shared inbox, help centre and suggested replies. 100% free and open source, MIT licensed.');
  const everything = `${pageText} ${labels} ${await page.title()} ${metaDescription}`.replace(/free as in cost|free of charge|No fees\./gi, '');
  assert.doesNotMatch(everything, /\$|£|€|\bUS\b|Cloudflare|\bhost(s|ing|ed)?\b|\bproviders?\b|run\s?edit\s?run|runeditrun|\bcosts?\b|\bfees?\b|\bpric(e|es|ed|ing)\b|\bpaid\b|\bbilling\b|invoice|Explain the change/i, 'no cost, hosting, provider, Run Edit Run or billing text anywhere on the page');
  // Truth: only Codex and Claude, never sending or deciding by themselves, no invented access levels, no figure but "100% free".
  assert.doesNotMatch(`${pageText} ${labels}`, /Cursor|Copilot|Gemini|Windsurf|Devin|ChatGPT|Aider|Cline|autonomous|autopilot|hands-free|no human|automatically|on its own|by itself|full access|admin access|read-write|sandbox|locked down|cloud agent|hosted agent|our agents|guaranteed|unlimited|forever/i, 'no claim the product cannot back');
  assert.deepEqual([...pageText.matchAll(/\d+\s?%[^.]*/g)].map(match => match[0].slice(0, 6)), ['100% f', '100% f'], '100% appears only in "100% free"');
  assert.ok(!/sends? (it|the reply|replies) (automatically|itself)/i.test(pageText));
  checks.push('headline, 14-word subhead, 100% free line and three caption steps; six sections in order (hero, Not just better. Free., Help before they ask, The rest of your support desk, Try it beside what you have, Ready when you are.); exact short copy for each; no cost, hosting, provider or Run Edit Run text; no unbacked claims; footer');

  // Links derive from package.json repository.url.
  const repository = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).repository.url;
  const links = await page.locator('.h2h-home a').evaluateAll(elements => elements.map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') })));
  const allowed = ['#top', '#product', repository, `${repository}/blob/main/README.md`, `${repository}/blob/main/docs/INSTALLER.md`, `${repository}/blob/main/LICENSE`, '/projects', '/setup', '/login'];
  assert.ok(links.every(link => allowed.includes(link.href)), JSON.stringify(links));
  const hrefOf = text => links.filter(link => link.text === text).map(link => link.href);
  assert.deepEqual(hrefOf('Get the code'), [repository, repository, repository, repository], 'the pill sits in the navigation, hero, Free section and closing band');
  assert.deepEqual(hrefOf('Read the docs'), [`${repository}/blob/main/README.md`, `${repository}/blob/main/README.md`]);
  assert.deepEqual(hrefOf('Read the installation guide'), [`${repository}/blob/main/docs/INSTALLER.md`]);
  assert.deepEqual(hrefOf('MIT licence'), [`${repository}/blob/main/LICENSE`]);
  assert.deepEqual(hrefOf('GitHub'), [repository, repository]);
  assert.ok(!links.some(link => /runeditrun|before-you-start/i.test(`${link.text} ${link.href}`)), 'no Run Edit Run or costs link');
  for (const href of ['/projects', '/setup', '/login']) assert.ok(links.some(link => link.href === href), href);
  checks.push('every link is the repository, its README, installer guide or licence, or a local workspace route; no Run Edit Run or costs link');

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
  const fontFiles = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname).filter(path => /\.woff2$/.test(path)));
  assert.ok(fontFiles.includes('/fonts/outfit/outfit-latin-wght-normal.woff2') && fontFiles.every(path => path.startsWith('/fonts/outfit/')), `only self-hosted Outfit files are requested: ${fontFiles}`);
  const thirdParty = requested.filter(request => /^https?:/.test(request) && new URL(request).origin !== new URL(origin).origin);
  assert.deepEqual(thirdParty, [], 'the homepage makes no third-party request');
  checks.push('all type is Outfit, self-hosted from /fonts/outfit, and the page makes no third-party request');

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
  assert.ok(cyan >= 6, `soft cyan accents inside the drawings (${cyan})`);
  const cyanPerDrawing = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => [...figure.querySelectorAll('*')].filter(el => {
    const style = getComputedStyle(el);
    return ([style.backgroundColor, style.borderTopColor, style.color].includes('rgb(143, 227, 238)') || style.boxShadow.includes('rgb(143, 227, 238)')) && el.getBoundingClientRect().width > 0;
  }).length));
  assert.ok(cyanPerDrawing.length === 8 && cyanPerDrawing.every(count => count > 0), `every drawing carries a #8FE3EE accent: ${cyanPerDrawing}`);
  const buttons = await page.locator('.pill--ink').evaluateAll(els => els.map(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).borderTopLeftRadius]));
  assert.ok(buttons.length === 4 && buttons.every(([bg, fg, radius]) => bg === 'rgb(20, 20, 20)' && fg === 'rgb(255, 255, 255)' && parseFloat(radius) >= 20), JSON.stringify(buttons));
  checks.push('warm paper with grain, near-black ink, black pill buttons, no colour outside the drawings');

  // Drawings: real DOM text, one accessible label each, no raster images, legible at every width.
  assert.equal(await page.locator('img').count(), 0);
  const drawings = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => ({ role: figure.getAttribute('role'), label: figure.getAttribute('aria-label') })));
  assert.equal(drawings.length, 8);
  assert.ok(drawings.every(drawing => drawing.role === 'img' && drawing.label.length > 40), JSON.stringify(drawings));
  assert.equal(await page.locator('.hero-art').getAttribute('aria-label'), "Drawing of a HappyToHelp conversation. Maya can't turn on the Spanish version of her store. Codex has fixed it: Spanish is live on her store. The reply is ready, and the next step is to press Send.");
  assert.equal(await page.locator('.offer-art').getAttribute('aria-label'), 'Drawing of a checkout page where the chat widget asks: Looks like you might be stuck. Would you like a hand with checkout? with Yes please and No thanks.');
  assert.equal(await page.locator('.licence-art').getAttribute('aria-label'), 'Drawing of the MIT licence: permission is granted, free of charge, to use, copy, modify, merge, publish and distribute HappyToHelp.');
  assert.equal(await page.locator('.import-art').getAttribute('aria-label'), 'Drawing of the help-centre import from Zendesk, complete with 128 articles and 9 categories.');
  assert.deepEqual(await page.locator('.parts figure.drawing').evaluateAll(figures => figures.map(figure => figure.getAttribute('aria-label'))), [
    'Drawing of the chat widget: a customer asks how to add their team and Casey answers.',
    'Drawing of the shared inbox with three conversations.',
    'Drawing of a help centre with a search field and three articles.',
    'Drawing of a suggested reply drafted from the Languages guide, with its source.',
  ]);
  assert.ok(await page.locator('.drawing .d-icon').evaluateAll(icons => icons.every(icon => icon.getAttribute('aria-hidden') === 'true')));
  assert.equal(await page.locator('.drawing a, .drawing button, .drawing input').count(), 0, 'drawn controls are not interactive');
  const wordsIn = text => text.split(/\s+/).filter(word => /[A-Za-z0-9]/.test(word)).length;
  const textOf = async selector => (await page.locator(selector).innerText()).replace(/\s+/g, ' ');
  // The hero drawing: one column, six strings, 27 words (the cap is 30).
  const heroNodes = await page.locator('.hero-art').evaluate(root => {
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.nodeValue.trim() && !node.parentElement.closest('[aria-hidden="true"]')) found.push(node.nodeValue.trim());
    return found;
  });
  assert.deepEqual(heroNodes, ['Maya', 'I can’t turn on the Spanish version of my store.', 'Codex', 'Fixed. Spanish is live on Maya’s store.', 'All done, Maya. Refresh and it’s there.', 'Send'], 'the hero drawing shows exactly its six strings');
  assert.equal(wordsIn(heroNodes.join(' ')), 27);
  const heroText = await textOf('.hero-art');
  for (const text of ['Maya Chen', 'maya@example.com', 'Open', 'Close', 'Local', '10:24', '10:31', 'Internal note', 'Local agent', 'Draft', 'Published Spanish', 'Checked the store', 'AI', 'Details', 'Work with your local agent', 'Ready', 'Mina', 'Resolve completed', 'Hola', 'Suggested replies', 'Use', 'Evidence and details', 'Verified', 'Type your reply']) assert.ok(!new RegExp(`\\b${text}\\b`).test(heroText), `hero drawing does not show ${text}`);
  assert.equal(await page.locator('.hero-art .hero-thread > *').count(), 3, 'one column of three elements');
  assert.equal(await page.locator('.hero-art .hc-composer .hc-text').innerText(), 'All done, Maya. Refresh and it’s there.', 'the reply is real text in the composer, not a placeholder');
  assert.equal(await page.locator('.hero-art .hc-send .d-btn--ink').innerText(), 'Send');
  assert.equal(await page.locator('.hero-art .d-btn--ink, .hero-art .d-bar i').evaluateAll(els => els.filter(el => el.textContent.trim() && el.matches('.d-btn--ink')).length), 1, 'Send is the only solid control');
  assert.equal(await page.locator('.hero-art .d-bar i').count(), 3, 'the window has three dots');
  assert.equal(await page.locator('.hero-art .d-marks--tick').count(), 1);
  assert.equal(await page.locator('.hero-art .d-marks--bracket').count(), 0);
  assert.equal(await page.locator('.hero-art .callout').count(), 3);
  assert.deepEqual(await page.locator('.hero-art .callout').evaluateAll(callouts => callouts.map(callout => callout.getAttribute('aria-hidden') + callout.textContent.trim())), ['true1', 'true2', 'true3']);
  assert.equal(await page.locator('.hero-art .hc-note').evaluate(note => getComputedStyle(note).backgroundColor), 'rgb(214, 245, 250)', 'the note card is cyan-tinted');
  assert.equal(await page.locator('.hero-art .hc-note svg:not(.callout svg)').count(), 2, 'the note byline has the Codex glyph and a check-in-circle icon');
  assert.equal(await page.locator('.hero-art .hc-ring').count(), 1, 'one cyan stroke circles Send');
  // The licence card: the real LICENSE file, drawn.
  const licenceText = await textOf('.licence-art');
  assert.equal(licenceText, 'MIT License Permission is hereby granted, free of charge, use, copy, modify, merge, publish, distribute');
  assert.equal(await page.locator('.licence-art .licence-mark').innerText(), 'free of charge');
  assert.equal(wordsIn(licenceText), 15);
  // The offer, the product drawings and the import.
  const offerText = await textOf('.offer-art');
  assert.equal(offerText, 'Checkout Pay now Looks like you might be stuck. Would you like a hand with checkout? Yes please No thanks');
  assert.equal(wordsIn(offerText), 20);
  assert.equal(await page.locator('.offer-art .d-btn--ink').innerText(), 'Yes please');
  assert.doesNotMatch(offerText, /Casey|Support assistant/, 'the offer has no assistant footer');
  assert.equal(await page.locator('.offer-art .offer-close').count(), 0, 'the offer has no close control');
  assert.equal((await page.locator('.parts .product-art').nth(0).innerText()).replace(/\s+/g, ' '), 'C Casey How do I add my team? Go to Settings and choose Invite. Message...');
  assert.equal((await page.locator('.parts .product-art').nth(1).innerText()).replace(/\s+/g, ' '), 'Inbox M Maya Chen Can’t turn on Spanish T Tom Reyes The widget isn’t loading P Priya Shah Where do I change my logo?');
  assert.equal((await page.locator('.parts .product-art').nth(2).innerText()).replace(/\s+/g, ' '), 'Search the Help Center Turn on another language Reset your password Invite team members');
  assert.equal((await page.locator('.reply-art').innerText()).replace(/\s+/g, ' '), 'Suggestions Add a language in Store settings › Languages, then publish it. Source: Languages guide');
  assert.equal(await page.locator('.parts .inbox-list li').count(), 3);
  assert.equal(await page.locator('.parts .help-art li').count(), 3);
  const importText = await textOf('.import-art');
  assert.equal(importText, 'Import articles from Zendesk Import progress complete Articles: 128 · Categories: 9');
  assert.equal(await page.locator('.import-art .d-check').count(), 1, 'the cyan check marks only the finished import');
  assert.equal(await page.locator('.import-art input, .import-art .d-btn').count(), 0, 'the finished import takes no input');
  checks.push('eight labelled drawings built from real text (hero thread of six strings and 27 words, MIT licence card, checkout offer, widget, inbox, Help Center, suggestion, finished import), no raster images, no controls');

  // Layout at every width: no overflow, two-line headline on wide screens, legible drawings, nothing clipped.
  for (const width of [320, 390, 480, 641, 700, 723, 768, 860, 861, 959, 1100, 1200, 1280, 1440, 1920]) {
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
      return hasText && rect.width > 0 && rect.height > 0 && parseFloat(getComputedStyle(el).fontSize) < 12;
    }).map(el => `${el.className} ${getComputedStyle(el).fontSize} ${el.textContent.trim().slice(0, 24)}`)));
    assert.deepEqual(tiny, [], `drawing text under 12px at ${width}px`);
    const buttonsOk = await page.locator('.pill').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).every(el => el.getBoundingClientRect().height >= 40));
    assert.ok(buttonsOk, `pill targets at ${width}px`);
    if (width <= 390) {
      for (const name of ['Docs', 'GitHub', 'Get the code']) assert.ok(await page.locator('header nav').getByRole('link', { name, exact: true }).isVisible(), `header ${name} visible at ${width}px`);
      const fold = await page.evaluate(() => ({ h1: document.querySelector('h1').getBoundingClientRect().bottom, cta: document.querySelector('.hero .pill').getBoundingClientRect().bottom }));
      assert.ok(fold.h1 < 844 && fold.cta < 844, `headline and Get the code above the fold at ${width}px: ${JSON.stringify(fold)}`);
    }
    const hero = await page.evaluate(() => {
      // Measured flat: the window's tilt would otherwise move the boxes by a few pixels.
      const flat = document.createElement('style');
      flat.textContent = '.hero-window { transform: none !important; }';
      document.head.appendChild(flat);
      const box = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width }; };
      const smallest = [];
      const walker = document.createTreeWalker(document.querySelector('.hero-art'), NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.nodeValue.trim()) smallest.push(parseFloat(getComputedStyle(node.parentElement).fontSize));
      const measured = { message: box('.hc-message'), bubble: box('.hc-message .d-message'), note: box('.hc-note'), composer: box('.hc-composer'), send: box('.hc-send .d-btn'), art: box('.hero-art'), smallest: Math.min(...smallest) };
      flat.remove();
      return measured;
    });
    // Corner marks and the hero underline are seated on their own frame, the same way at every width. Measured flat so the
    // hero's tilt does not blur the numbers; the structure check below is what makes them follow the tilt.
    const seating = await page.evaluate(() => {
      const flat = document.createElement('style');
      flat.textContent = '.hero-window { transform: none !important; }';
      document.head.appendChild(flat);
      const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      const marks = [...document.querySelectorAll('figure.drawing')].map(figure => {
        const mark = figure.querySelector('.d-marks');
        const frame = rect(figure.querySelector('.d-window'));
        const m = rect(mark);
        const size = Math.max(m.width, m.height);
        return { name: figure.getAttribute('aria-label').slice(0, 28), size, gap: frame.top - m.bottom, across: ((m.left + m.right) / 2 - frame.right) / size };
      });
      const underline = document.querySelector('.hero-window > .d-underline');
      const frame = rect(document.querySelector('.hero-window'));
      const line = underline && rect(underline);
      const steps = rect(document.querySelector('.hero-steps'));
      // Every text line outside the drawings (headings, numerals, captions), as one rect per rendered line.
      const lines = [];
      const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.nodeValue.trim() || node.parentElement.closest('figure.drawing')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width && r.height) lines.push({ text: node.nodeValue.trim().slice(0, 28), left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      }
      const onText = [...document.querySelectorAll('figure.drawing .d-marks')].flatMap(mark => {
        const m = rect(mark);
        return lines.filter(t => t.left < m.right + 2 && t.right > m.left - 2 && t.top < m.bottom + 2 && t.bottom > m.top - 2).map(t => t.text);
      });
      const result = { marks, onText, line: line && { left: line.left - frame.left, right: line.right - frame.right, gap: line.top - frame.bottom, toCaptions: steps.top - line.bottom, span: frame.width },
        heroMarkInFrame: document.querySelectorAll('.hero-window > .d-marks').length, heroUnderlineInFrame: document.querySelectorAll('.hero-window > .d-underline').length };
      flat.remove();
      return result;
    });
    assert.equal(seating.marks.length, 8, `eight framed marks at ${width}px`);
    assert.equal(seating.heroMarkInFrame, 1, 'the hero tick is a child of the tilted frame, so it keeps the frame corner at every tilt');
    assert.equal(seating.heroUnderlineInFrame, 1, 'the hero underline is a child of the tilted frame, so it keeps the frame tilt');
    for (const mark of seating.marks) {
      assert.ok(mark.gap >= 2 && mark.gap <= Math.max(18, 0.4 * mark.size), `a mark floats just above its frame corner at ${width}px: ${JSON.stringify(mark)}`);
      assert.ok(Math.abs(mark.across) <= 0.6, `a mark sits over its frame's right corner at ${width}px: ${JSON.stringify(mark)}`);
    }
    assert.deepEqual(seating.onText, [], `no corner mark touches a heading, numeral or caption at ${width}px`);
    const gaps = seating.marks.map(mark => mark.gap), acrosses = seating.marks.map(mark => mark.across);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 8 && Math.max(...acrosses) - Math.min(...acrosses) <= 0.3, `all eight marks share one corner relation at ${width}px: ${JSON.stringify(seating.marks)}`);
    const slack = Math.max(8, 0.02 * seating.line.span);
    assert.ok(Math.abs(seating.line.left) <= slack && Math.abs(seating.line.right) <= slack, `the hero underline runs from the frame's bottom-left to its bottom-right corner at ${width}px: ${JSON.stringify(seating.line)}`);
    assert.ok(seating.line.gap >= 6 && seating.line.gap <= 36 && seating.line.toCaptions >= 6, `the hero underline sits a steady distance under the frame and clear of the captions at ${width}px: ${JSON.stringify(seating.line)}`);

    // One column of three stacked, left-aligned elements with room between them; Send sits inside the composer after the reply.
    assert.ok(hero.message.bottom <= hero.note.top - (width >= 1000 ? 28 : 8) && hero.note.bottom <= hero.composer.top - (width >= 1000 ? 28 : 8), `the thread elements are spaced apart at ${width}px: ${JSON.stringify(hero)}`);
    assert.ok(Math.abs(hero.message.left - hero.note.left) <= 14 && Math.abs(hero.note.left - hero.composer.left) <= 14, `the thread is left-aligned at ${width}px`);
    assert.ok(hero.send.left >= hero.composer.left && hero.send.right <= hero.composer.right && hero.send.top >= hero.composer.top && hero.send.bottom <= hero.composer.bottom, `Send sits inside the composer at ${width}px`);
    assert.ok(hero.bubble.bottom - hero.bubble.top < 4.5 * 17 * 1.55, `the customer bubble stays within two lines at ${width}px`);
    if (width === 1440) {
      const column = Math.max(hero.bubble.right, hero.note.right, hero.composer.right) - hero.message.left;
      assert.ok(column >= 440 && column <= 620, `the thread column is about 520px wide at 1440px (${column})`);
      assert.ok(hero.send.left > hero.composer.left + hero.composer.width * 0.55, 'Send sits at the right of the composer');
    }
    assert.ok(hero.smallest >= (width >= 723 ? 15 : 13), `every hero drawing text run is at least ${width >= 723 ? 15 : 13}px at ${width}px (smallest ${hero.smallest})`);
    if (width >= 1280) assert.ok(hero.art.top + (hero.art.bottom - hero.art.top) / 2 < 900, `at least half of the hero drawing is above the fold at ${width}px`);
    if (width === 390) {
      assert.equal(await page.locator('.hero-art .callout').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).length), 3, 'all three numerals stay at 390px');
      assert.ok(await page.locator('.import-art').isVisible() && await page.locator('.licence-art').isVisible(), 'the licence card and import window stay at 390px');
      assert.equal(await page.locator('.parts').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
    }
    if (width === 1440) assert.equal(await page.locator('.parts').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
  }
  checks.push('no horizontal overflow, headline breaking, drawing text of 12px or more (15px in the hero), contained marks, all eight corner marks seated alike on their frames and clear of every heading and caption, and the hero underline spanning the frame bottom at 15 widths from 320px to 1920px');

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

  // Accessibility: axe-core WCAG A and AA at the wide and narrow layouts.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.deepEqual(await axeViolations(), [], `axe-core violations at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  checks.push('axe-core reports no WCAG 2.x A or AA violation at 1440px and 390px');

  // Keyboard focus is a visible ink outline, never the browser's blue ring.
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur?.(); });
  const rings = [];
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press('Tab');
    rings.push(await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return [document.activeElement.textContent.trim(), style.outlineStyle, style.outlineColor, parseFloat(style.outlineWidth)]; }));
  }
  assert.ok(rings.every(([, style, color, width]) => style === 'solid' && color === 'rgb(20, 20, 20)' && width >= 2), JSON.stringify(rings));
  checks.push('keyboard focus shows a solid ink outline on the skip link, wordmark, navigation and calls to action');
  await page.goto(origin, { waitUntil: 'networkidle' });

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
