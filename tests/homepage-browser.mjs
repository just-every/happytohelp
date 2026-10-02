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

  // Content, in order.
  await page.getByRole('heading', { level: 1, name: 'Customer Support, Solved.', exact: true }).waitFor();
  assert.equal(await page.locator('h1').count(), 1);
  const subhead = await page.locator('.hero-sub').innerText();
  assert.equal(subhead, 'Hand the conversation to Codex or Claude on your own computer. It finds the cause, fixes it with the tools you already use, confirms it works and writes the reply. You check it and press Send.');
  assert.equal(subhead.split(/\s+/).length, 36, 'the subhead stays at 36 words');
  assert.equal(await page.locator('.hero-free').innerText(), 'Free and open source.');
  assert.equal((await page.locator('.hero-examples').innerText()).replace(/\s+/g, ' '), 'The same move for: “I never got the invite.” · “My export is stuck.” · “I can’t turn on dark mode.”');
  assert.deepEqual(await page.locator('.hero-steps li').allInnerTexts(), ['The customer asks', 'The agent fixes it', 'You press Send']);
  assert.deepEqual(await page.locator('.hero-copy .actions a').allInnerTexts(), ['Get the code', 'Read the docs'], 'the hero has two controls and no third');
  assert.deepEqual(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id)), ['top', 'free', 'help-before-they-ask', 'product', 'move-in', 'yours-to-run']);
  assert.deepEqual(await page.locator('main h2').allInnerTexts(), ['Not just better. Free.', 'Help before they ask', 'The rest of your support desk', 'Try it beside what you have', 'Yours to run']);
  assert.equal(await page.locator('#product .section-head p').innerText(), 'Chat, email, a help centre and suggested replies, in one shared inbox.');
  assert.deepEqual(await page.locator('.parts > li h3').allInnerTexts(), ['Chat widget', 'Shared inbox', 'Help centre', 'AI-suggested replies that cite their sources']);
  assert.deepEqual(await page.locator('.parts > li > p').allInnerTexts(), [
    'Customers reach you from your site or app, and can send files and screenshots.',
    'Chat and email in one place, with assignments, internal notes, saved replies and the customer’s details beside every conversation.',
    'Publish searchable articles so customers find answers themselves.',
    'Drafted from your own articles. Pick one, edit it and send it.',
  ]);
  assert.deepEqual(await page.locator('.signals li').allInnerTexts(), ['Lingering on a page', 'Sitting idle', 'Scrolling back up', 'Pausing at checkout']);
  assert.equal(await page.locator('#help-before-they-ask .split-copy > p').innerText(), 'Some customers who get stuck never write in. They just leave. When a visitor seems stuck, the widget offers a hand once, if they have agreed to it. Say no and it stays quiet. A person can always take over.');
  assert.equal(await page.locator('#free .split-copy > p').innerText(), 'HappyToHelp is open source under the MIT licence. There are no seats to buy, no plan to outgrow and no fee for each conversation it resolves, so adding your whole team costs nothing extra. It runs in your own Cloudflare account, where hosting starts at about US$5 a month. The agent is the Codex or Claude your team already uses, and AI is paid to your provider at their price, with nothing added by us.');
  assert.deepEqual(await page.locator('#free .proof li').allInnerTexts(), ['Seats: none.', 'Fee per resolution: none.', 'Licence: MIT.']);
  assert.deepEqual(await page.locator('#free .actions a').allInnerTexts(), ['Get the code', 'See what you need to run it']);
  assert.equal(await page.locator('#move-in .split-copy > p').first().innerText(), 'Keep your current helpdesk running while you try it. Nothing there changes.');
  assert.deepEqual((await page.locator('#move-in .steps li').allInnerTexts()).map(text => text.replace(/\s+/g, ' ')), [
    'Install it. The installer asks only for what it cannot find, and nothing is set up until you approve. Codex or Claude can fill it in.',
    'Bring your help centre. Import your articles and categories from Zendesk, Intercom or Freshdesk. Your old helpdesk is only read, never changed, and you can run the import again to pick up new edits.',
    'Add the chat widget. One script tag on your website.',
  ]);
  assert.equal(await page.locator('#move-in .split-copy > p').last().innerText(), 'Want to look around first? Every empty workspace can open a demo inbox with sample conversations.');
  assert.deepEqual(await page.locator('#move-in .actions a').allInnerTexts(), ['Read the installation guide'], 'Move in has a text link and no pill');
  // The billing example is gone everywhere on the page.
  assert.doesNotMatch(await page.locator('.h2h-home').innerText(), /billing|invoice|Explain the change/i, 'the billing example is removed');
  // Truth: only Codex and Claude, run on the owner's computer, never sending or deciding by themselves, no invented access levels.
  const pageText = await page.locator('.h2h-home').innerText();
  const labels = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => figure.getAttribute('aria-label')).join(' '));
  assert.doesNotMatch(`${pageText} ${labels}`, /Cursor|Copilot|Gemini|Windsurf|Devin|ChatGPT|Aider|Cline|autonomous|autopilot|hands-free|no human|automatically|on its own|by itself|full access|admin access|read-write|sandbox|locked down|cloud agent|hosted agent|our agents|100%|guaranteed/i, 'no claim the product cannot back');
  assert.ok(!/sends? (it|the reply|replies) (automatically|itself)/i.test(pageText));
  const yoursParagraphs = await page.locator('#yours-to-run .split-copy > p').allInnerTexts();
  assert.deepEqual(yoursParagraphs, [
    'Your Cloudflare account, your code, your data. Conversations and files live in your own account, and the code is yours to read, fork and change. No vendor sits between you and your customers, and there is no price to be raised.',
    'Rather not host it yourself? Hosted options are available through Run Edit Run.',
  ]);
  assert.deepEqual(await page.locator('#yours-to-run .actions a').allInnerTexts(), ['Get the code', 'Read the installation guide']);
  assert.equal(await page.locator('footer').count(), 1);
  assert.deepEqual(await page.locator('footer a').allInnerTexts(), ['HappyToHelp', 'Docs', 'GitHub', 'Workspace', 'Set up', 'Log in', 'MIT licence']);
  assert.ok(!(await page.locator('[class*="village"], [class*="parallax"]').count()), 'retired homepage markup is absent');
  checks.push('headline, 36-word subhead, free line, examples strip and three caption steps; six sections in order (hero, Not just better. Free., Help before they ask, The rest of your support desk, Try it beside what you have, Yours to run); exact copy for each; billing example gone; no unbacked claims; footer');

  // Links derive from package.json repository.url.
  const repository = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).repository.url;
  const links = await page.locator('.h2h-home a').evaluateAll(elements => elements.map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') })));
  const allowed = ['#top', '#product', repository, `${repository}#before-you-start`, 'https://runeditrun.com', `${repository}/blob/main/README.md`, `${repository}/blob/main/docs/INSTALLER.md`, `${repository}/blob/main/LICENSE`, '/projects', '/setup', '/login'];
  assert.ok(links.every(link => allowed.includes(link.href)), JSON.stringify(links));
  const hrefOf = text => links.filter(link => link.text === text).map(link => link.href);
  assert.deepEqual(hrefOf('Get the code'), [repository, repository, repository, repository]);
  assert.deepEqual(hrefOf('Read the docs'), [`${repository}/blob/main/README.md`]);
  assert.deepEqual(hrefOf('Read the installation guide'), [`${repository}/blob/main/docs/INSTALLER.md`, `${repository}/blob/main/docs/INSTALLER.md`]);
  assert.deepEqual(hrefOf('See what you need to run it'), [`${repository}#before-you-start`]);
  assert.deepEqual(hrefOf('Run Edit Run'), ['https://runeditrun.com']);
  assert.deepEqual(hrefOf('MIT licence'), [`${repository}/blob/main/LICENSE`]);
  assert.deepEqual(hrefOf('GitHub'), [repository, repository]);
  for (const href of ['/projects', '/setup', '/login']) assert.ok(links.some(link => link.href === href), href);
  checks.push('every link is the repository, its README, cost section, installer guide or licence, Run Edit Run, or a local workspace route');

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
  assert.ok(cyan >= 10, `soft cyan accents inside the drawings (${cyan})`);
  const cyanPerDrawing = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => [...figure.querySelectorAll('*')].filter(el => {
    const style = getComputedStyle(el);
    return [style.backgroundColor, style.borderTopColor, style.color].includes('rgb(143, 227, 238)') && el.getBoundingClientRect().width > 0;
  }).length));
  assert.ok(cyanPerDrawing.length === 9 && cyanPerDrawing.every(count => count > 0), `every drawing carries a #8FE3EE accent: ${cyanPerDrawing}`);
  const buttons = await page.locator('.pill--ink').evaluateAll(els => els.map(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).borderTopLeftRadius]));
  assert.ok(buttons.length === 4 && buttons.every(([bg, fg, radius]) => bg === 'rgb(20, 20, 20)' && fg === 'rgb(255, 255, 255)' && parseFloat(radius) >= 20), JSON.stringify(buttons));
  checks.push('warm paper with grain, near-black ink, black pill buttons, no colour outside the drawings');

  // Drawings: real DOM text, one accessible label each, no raster images, legible at every width.
  assert.equal(await page.locator('img').count(), 0);
  const drawings = await page.locator('figure.drawing').evaluateAll(figures => figures.map(figure => ({ role: figure.getAttribute('role'), label: figure.getAttribute('aria-label') })));
  assert.equal(drawings.length, 9);
  assert.ok(drawings.every(drawing => drawing.role === 'img' && drawing.label.length > 40), JSON.stringify(drawings));
  const heroLabel = await page.locator('.hero-art').getAttribute('aria-label');
  assert.equal(heroLabel, "Drawing of a HappyToHelp conversation. Maya Chen cannot turn on the Spanish version of her store. Codex, working on the team's own computer, has published Spanish and checked the store loads in Spanish: the Local panel shows Resolve completed and Verified, an internal note lists each step with its evidence, and the reply is in the composer, ready for the team to send.");
  assert.ok((await page.locator('.offer-art').getAttribute('aria-label')).includes('Yes please and No thanks'));
  assert.equal(await page.locator('.bill-art').getAttribute('aria-label'), 'Drawing of a bill: software, team seats and resolved conversations are free; hosting is your own Cloudflare account and AI is paid to your provider at their price. Paid to HappyToHelp: $0.');
  assert.equal(await page.locator('.import-art').getAttribute('aria-label'), 'Drawing of the help-centre import: Zendesk is chosen from Zendesk, Intercom and Freshdesk, the subdomain northwind is entered, and the import is complete with 128 articles and 9 categories.');
  assert.equal(await page.locator('.installer-art').getAttribute('aria-label'), 'Drawing of the HappyToHelp installer: Workspace and Your account are done, and Hosting & connections is choosing to publish online with Cloudflare, the team workspace address and Cloudflare Email Sending.');
  assert.ok((await page.locator('.reply-art').getAttribute('aria-label')).includes('citing the Languages guide as its source'));
  assert.ok(await page.locator('.drawing .d-icon').evaluateAll(icons => icons.every(icon => icon.getAttribute('aria-hidden') === 'true')));
  assert.equal(await page.locator('.drawing a, .drawing button, .drawing input').count(), 0, 'drawn controls are not interactive');
  const heroText = (await page.locator('.hero-art').innerText()).replace(/\s+/g, ' ');
  for (const text of ['Maya Chen', 'maya@example.com', 'Open', 'Close', 'Local', '10:24 AM', 'Hi, I can’t turn on the Spanish version of my store. The language switch is greyed out and half my customers speak Spanish.', 'Codex', 'Local agent', 'Internal note', '10:31 AM',
    'Spanish was set up but still in Draft, which kept the switch greyed out. It is now live and working.', 'Published Spanish:', 'Store settings › Languages, Spanish changed from Draft to Live', 'Checked the store in Spanish:', 'Home, product and checkout pages load in Spanish',
    'Hi Maya, done. Spanish is live on your store now. It was still saved as a draft, so we published it and checked your shop and checkout in Spanish. Refresh and the switch is there.', 'Send',
    'AI', 'Details', 'Work with your local agent', 'Delegate this conversation to Codex or Claude on your computer.', 'Ready', 'Codex on Mina’s Mac is ready for new work.', 'Workspace connection · 0 / 1 active tasks',
    'Resolve completed', 'Spanish was stuck in Draft. It is now live on Maya’s store.', 'Hola', 'Suggested replies', 'Spanish is live', 'Use', 'Evidence and details', 'Verified']) assert.ok(heroText.includes(text), `hero drawing shows ${text}`);
  // One consistent state: the finished job and the reply in the composer, never a running task, never a reply shown as sent, no placeholder.
  for (const text of ['Live progress', 'Working locally', 'Reply sent', 'Cancel', 'Queued', 'Follow-up actions', 'New task', 'Type your reply…', 'Investigate']) assert.ok(!heroText.includes(text), `hero drawing does not show ${text}`);
  assert.equal(heroText.split('Hi Maya, done.').length, 2, 'the reply text appears once in the hero drawing');
  assert.equal(await page.locator('.hero-art .callout').count(), 3);
  assert.deepEqual(await page.locator('.hero-art .callout').evaluateAll(callouts => callouts.map(callout => callout.getAttribute('aria-hidden') + callout.textContent.trim())), ['true1', 'true2', 'true3']);
  assert.equal(await page.locator('.hero-art .hc-send .d-btn--ink').innerText(), 'Send');
  assert.deepEqual(await page.locator('.hero-art .d-btn--active, .hero-art .hc-note, .hero-art .hl-job, .hero-art .hl-evidence .d-chip, .hero-art .hc-ring').evaluateAll(els => els.length), 5, 'cyan marks the Local button, the note, the job, Verified and the Send ring');
  assert.ok(heroText.length >= 700);
  const billText = (await page.locator('.bill-art').innerText()).replace(/\s+/g, ' ');
  for (const text of ['Your HappyToHelp bill', 'Software', 'Team seats', 'Resolved conversations', 'Free', 'Hosting', 'Your Cloudflare account', 'AI', 'Your provider, at their price', 'Paid to HappyToHelp:', '$0']) assert.ok(billText.includes(text), `bill drawing shows ${text}`);
  assert.equal(await page.locator('.bill-art .d-check').count(), 3, 'only the three free rows carry a check');
  const importText = (await page.locator('.import-art').innerText()).replace(/\s+/g, ' ');
  for (const text of ['Please choose which helpdesk you would like to import help articles from.', 'Zendesk', 'Intercom', 'Freshdesk', '‹ Choose another helpdesk', 'Import articles from Zendesk', 'Import uses this installation’s configured zendesk credentials. Account credentials cannot be entered here.', 'Subdomain', 'northwind', 'Import', 'Import progress', 'complete', 'Articles: 128 · Categories: 9', 'Refresh status']) assert.ok(importText.includes(text), `import drawing shows ${text}`);
  assert.equal(await page.locator('.import-front .d-btn--off').innerText(), 'Import', 'the Import button is drawn disabled');
  assert.equal(await page.locator('.import-art .d-btn--chosen').count(), 1, 'only Zendesk is chosen');
  const installerText = (await page.locator('.installer-art').innerText()).replace(/\s+/g, ' ');
  for (const text of ['Workspace', 'Your account', 'Hosting & connections', 'Install to', 'Run locally', 'Publish online with Cloudflare', 'Team workspace address', 'https://northwind-support.example.workers.dev', 'The HTTPS address your team will open to use HappyToHelp.', 'Email service', 'Cloudflare Email Sending', 'Continue']) assert.ok(installerText.includes(text), `installer drawing shows ${text}`);
  assert.equal(await page.locator('.installer-art .ins-rail .d-check').count(), 2, 'Workspace and Your account are done');
  assert.ok((await page.locator('.offer-art').innerText()).includes('Yes please') && (await page.locator('.offer-art').innerText()).includes('No thanks'));
  // Drawings mirror the real interface wording.
  const offerText = await page.locator('.offer-art').innerText();
  for (const text of ['Yes please', 'No thanks', 'Casey • Support assistant']) assert.ok(offerText.includes(text), text);
  const inboxNav = await page.locator('.inbox-nav li').allInnerTexts();
  assert.deepEqual(inboxNav.map(text => text.replace(/\s+/g, ' ').trim()), ['Inbox 3', 'Contacts', 'Insights', 'Settings']);
  const widgetText = await page.locator('.parts .product-art').nth(0).innerText();
  for (const text of ['Casey • Support assistant', 'Responds instantly', 'Hi, how do I add my team to the account?', 'Of course. Go to Settings and choose Invite.', 'Message...', 'We use Happy to Help!']) assert.ok(widgetText.replace(/\s+/g, ' ').includes(text), text);
  const helpText = await page.locator('.parts .product-art').nth(2).innerText();
  for (const text of ['Northwind Help Center', 'Search the Help Center', 'Search', 'Turn on another language', 'Publish your store in Spanish, French and more.', 'Reset your password', 'Invite team members']) assert.ok(helpText.includes(text), text);
  const inboxText = await page.locator('.inbox-art').innerText();
  for (const text of ['Maya Chen', 'Can’t turn on Spanish', 'Where do I change my logo?', 'Assigned to Ana', 'Assigned to AI']) assert.ok(inboxText.includes(text), text);
  const replyText = await page.locator('.reply-art').innerText();
  for (const text of ['Casey’s Suggestions', 'Share the language guide', 'Use when: a customer asks how to add a language', 'You can add a language in Store settings › Languages, then publish it. Your customers can switch to it straight away.', 'Source: Languages guide', 'Type your reply…', 'Send']) assert.ok(replyText.includes(text), text);
  checks.push('nine labelled drawings built from real text mirroring the interface (hero conversation with Local panel and callouts, bill, widget insight, widget, inbox, Help Center, suggestions, article import, installer), no raster images');

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
    if (width <= 390) {
      for (const name of ['Docs', 'GitHub', 'Get the code']) assert.ok(await page.locator('header nav').getByRole('link', { name, exact: true }).isVisible(), `header ${name} visible at ${width}px`);
      const fold = await page.evaluate(() => ({ h1: document.querySelector('h1').getBoundingClientRect().bottom, cta: document.querySelector('.hero .pill').getBoundingClientRect().bottom }));
      assert.ok(fold.h1 < 844 && fold.cta < 844, `headline and Get the code above the fold at ${width}px: ${JSON.stringify(fold)}`);
    }
    const heroBoxes = await page.evaluate(() => { const box = selector => document.querySelector(selector).getBoundingClientRect(); const thread = box('.hero-thread'), local = box('.hero-local'), art = box('.hero-art'); return { threadTop: thread.top, threadLeft: thread.left, threadBottom: thread.bottom, localLeft: local.left, localTop: local.top, artTop: art.top, artBottom: art.bottom, artHeight: art.height, artWidth: art.width }; });
    if (heroBoxes.artWidth > 660) assert.ok(heroBoxes.localLeft > heroBoxes.threadLeft + 100 && Math.abs(heroBoxes.localTop - heroBoxes.threadTop) < 40, `Local panel sits beside the conversation at ${width}px`);
    if (width >= 1280) assert.ok(heroBoxes.artTop + heroBoxes.artHeight / 2 < 900, `at least half of the handoff drawing is above the fold at ${width}px`);
    if (heroBoxes.artWidth <= 640) assert.ok(heroBoxes.localTop >= heroBoxes.threadBottom - 16 && Math.abs(heroBoxes.localLeft - heroBoxes.threadLeft) < 20, `Local panel stacks under the conversation at ${width}px`);
    if (width === 390) {
      assert.ok(await page.locator('.hero-local').isVisible(), 'narrow hero still shows the Local panel');
      for (const selector of ['.hl-job', '.hl-reply', '.hl-evidence']) assert.ok(await page.locator(selector).first().isVisible(), `${selector} stays at 390px`);
      assert.equal(await page.locator('.hero-art .callout').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).length), 3, 'all three numerals stay at 390px');
      assert.ok(!(await page.locator('.hl-connection').isVisible()) && !(await page.locator('.hl-shot').isVisible()), 'the connection card and screenshot are dropped at 390px');
      assert.ok(!(await page.locator('.import-back').isVisible()) && await page.locator('.import-front').isVisible(), 'only the front import window at 390px');
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
