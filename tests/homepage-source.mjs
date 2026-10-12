import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';

// Source-level guarantees for the approved "Customer Support, Solved." homepage (owner approval 2026-10-01).
const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');
const exists = path => access(url(path)).then(() => true, () => false);

test('the village homepage is removed completely', async () => {
  const removedPaths = ['public/homepage/village', 'src/ui/homepage/useVillageParallax.ts', 'src/ui/homepage/village.css', 'src/ui/homepage/village-workshops.css', 'src/ui/homepage/village-responsive.css', 'src/ui/homepage/VillageScene.tsx'];
  for (const path of removedPaths) assert.equal(await exists(path), false, `${path} must stay removed`);
  const files = (await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.(tsx?|css|json)$/.test(file));
  for (const file of files) assert.doesNotMatch(await read(`src/ui/homepage/${file}`), /village|parallax/i, file);
  assert.deepEqual((await readdir(url('public/homepage'))).sort(), ['media']);
  const provenance = JSON.parse(await read('src/ui/homepage/asset-provenance.json'));
  assert.deepEqual(provenance.map(entry => entry.source), ['homepage/media/brands/happytohelp-mark.svg', 'homepage/media/brands/happytohelp-favicon.svg', 'homepage/media/brands/happytohelp-favicon.png', 'homepage/media/brands/happytohelp-apple-touch-icon.png']);
  for (const entry of provenance) {
    const bytes = await readFile(url(`public/${entry.source}`));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
  }
  for (const path of ['CONTRACT.md', 'ACCEPTANCE.md', 'HANDOVER.md', 'docs/MODULES.md', 'docs/PUBLIC-SOURCE-PROVENANCE.md', 'docs/SOURCE-PROVENANCE.md', 'README.md', 'OPERATIONS.md', 'seed.json']) {
    assert.doesNotMatch(await read(path), /village|Support\. Free\. Yours/i, `${path} must not describe the retired village homepage`);
  }
});

test('the HappyToHelp mark has one geometry: the header draws it and the brand files are generated from it', async () => {
  const mark = await import('../src/ui/homepage/brand-mark.ts');
  assert.equal(await read('public/homepage/media/brands/happytohelp-mark.svg'), mark.markSvg(), 'the standalone mark is exactly markSvg()');
  assert.equal(await read('public/homepage/media/brands/happytohelp-favicon.svg'), mark.faviconSvg(), 'the favicon is exactly faviconSvg()');
  assert.deepEqual(await readdir(url('public/homepage/media/brands')), ['happytohelp-apple-touch-icon.png', 'happytohelp-favicon.png', 'happytohelp-favicon.svg', 'happytohelp-mark.svg']);
  for (const svg of [mark.markSvg(), mark.faviconSvg()]) {
    assert.doesNotMatch(svg, /<image|<text|href=|data:/, 'clean vector paths only');
    const favicon = svg === mark.faviconSvg();
    assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]), favicon ? [mark.bubble, ...mark.face] : [mark.bubble, ...mark.face, ...mark.sparks], favicon ? 'a bubble, two eyes and a smile: the favicon leaves the sparks out' : 'a bubble, two eyes, a smile and three sparks');
    assert.deepEqual([...new Set([...svg.matchAll(/(?:stroke|fill)="(#[0-9a-f]{6})"/g)].map(match => match[1]))].sort(), favicon ? ['#141414', '#f6f2ea'] : ['#8fe3ee'], favicon ? 'ink and paper only: no aqua in the favicon' : 'the drawings\' cyan sparks only');
  }
  assert.match(await read('src/ui/homepage/brand-tokens.css'), new RegExp(`--d-cyan: ${mark.sparkColour};`), 'the sparks use the drawings\' existing cyan');
  const png = async path => { const bytes = await readFile(url(path)); return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] }; };
  assert.deepEqual(await png('public/homepage/media/brands/happytohelp-favicon.png'), { width: 512, height: 512, colourType: 6 }, 'the PNG fallback is square, 512px and transparent');
  assert.deepEqual(await png('public/homepage/media/brands/happytohelp-apple-touch-icon.png'), { width: 180, height: 180, colourType: 2 }, 'the home-screen icon is 180px on an opaque background');
  const component = await read('src/ui/homepage/BrandMark.tsx');
  assert.match(component, /from '\.\/brand-mark'/);
  assert.match(component, /aria-hidden="true" focusable="false"/);
  assert.match(component, /stroke="currentColor"/);
  assert.match(await read('src/ui/homepage/SiteHeader.tsx'), /<BrandLockup home=\{home\} \/>/, 'the header carries the lockup');
  assert.match(await read('src/ui/homepage/BrandLockup.tsx'), /<a className="brand" href=\{home\}><BrandMark \/><BrandWord \/><span className="brand-name">HappyToHelp<\/span><\/a>/, 'one link: the mark, then the drawn wordmark, named by its hidden text');
  const root = await read('src/routes/__root.tsx');
  for (const link of [/rel: 'icon', type: 'image\/svg\+xml', sizes: 'any', href: `\$\{brands\}\/happytohelp-favicon\.svg`/, /rel: 'icon', type: 'image\/png', sizes: '512x512', href: `\$\{brands\}\/happytohelp-favicon\.png`/, /rel: 'apple-touch-icon', sizes: '180x180', href: `\$\{brands\}\/happytohelp-apple-touch-icon\.png`/]) assert.match(root, link);
  assert.equal([...root.matchAll(/\.\.\.favicons|links: favicons/g)].length, 2, 'the homepage, every other route and the 404 carry the icons');
  assert.match(await read('src/ui/dashboard/contexts/ChatContext.jsx'), /new Favcount\("\/homepage\/media\/brands\/happytohelp-favicon\.svg", "\/homepage\/media\/brands\/happytohelp-favicon\.svg"\)/, 'the unread count is drawn on the mark');
  for (const path of ['docs/PUBLIC-SOURCE-PROVENANCE.md', 'src/modules/public-site/README.md', 'src/ui/homepage/asset-provenance.json']) assert.doesNotMatch(await read(path), /\bhorse|\brider\b|owner-supplied happytohelp-favicon/i, `${path} describes the current mark`);
});

test('the HappyToHelp wordmark has one geometry: drawn strokes following Nunito, no font data', async () => {
  const word = await import('../src/ui/homepage/brand-word.ts');
  assert.equal(word.wordGlyphs.map(glyph => glyph.char).join(''), 'HappyToHelp', 'one stroked path per letter of HappyToHelp');
  assert.ok(word.wordGlyphs.every(glyph => /^[MLCHVZ0-9 .-]+$/.test(glyph.d)), 'each letter is plain path data');
  assert.equal(word.wordViewBox, '0 -95 608.5 120', 'the word box is 120 units (0.96em) tall');
  const mark = await import('../src/ui/homepage/brand-mark.ts'), markPen = mark.inkWidth / +mark.markViewBox.split(' ')[3] * 158;
  assert.match(await read('src/ui/homepage/homepage.css'), /\.h2h-home \.brand-mark \{[^}]*height: 1\.58em;/, 'the mark is drawn 1.58em tall');
  const wordPen = word.wordStrokeWidth * word.wordHeightEm * 100 / +word.wordViewBox.split(' ')[3];
  assert.ok(Math.abs(wordPen / markPen - 1) <= 0.05, `the word's pen (${wordPen.toFixed(2)} hundredths of an em) is the mark's pen within 5% (${markPen.toFixed(2)})`);
  const component = await read('src/ui/homepage/BrandWord.tsx');
  assert.match(component, /from '\.\/brand-word'/);
  assert.match(component, /aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth=\{wordStrokeWidth\} strokeLinecap="round" strokeLinejoin="round"/, 'decorative, unfocusable, a round-capped ink stroke at the geometry\'s width');
  const sources = [...(await readdir(url('src'), { recursive: true })).map(file => `src/${file}`), ...(await readdir(url('public'), { recursive: true })).map(file => `public/${file}`)].filter(file => /\.(tsx?|jsx?|css|svg|json|html)$/.test(file));
  const holders = [];
  for (const file of sources) { const text = await read(file); if (word.wordGlyphs.some(glyph => text.includes(glyph.d))) holders.push(file); }
  assert.deepEqual(holders, ['src/ui/homepage/brand-word.ts'], 'the letter paths live in brand-word.ts and nowhere else');
});

test('homepage styles are scoped so they cannot leak into the dashboard', async () => {
  for (const file of ['homepage.css', 'drawings.css']) {
    const css = (await read(`src/ui/homepage/${file}`)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes\s+[\w-]+\s*\{[^{}]*\{[^{}]*\}[^{}]*\{[^{}]*\}\s*\}/g, '');
    const selectors = [...css.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(match => match[1]).filter(selector => !/^(from|to|\d+%)$/.test(selector));
    assert.ok(selectors.length > 40, `${file} has rules`);
    for (const group of selectors) {
      for (const selector of group.split(/,(?![^(]*\))/).map(part => part.trim())) {
        assert.match(selector, /^(\.h2h-home\b|body:has\(\.h2h-home\)|html:has\(\.h2h-home\))/, `${file}: "${selector}" must be scoped to .h2h-home`);
      }
    }
  }
});

test('one open-licensed typeface is self-hosted and recorded', async () => {
  const route = await read('src/routes/index.tsx');
  assert.match(route, /rel: 'preload', href: '\/fonts\/outfit\/outfit-latin-wght-normal\.woff2', as: 'font'/);
  assert.doesNotMatch(route, /\bInter\b|https?:\/\//, 'no Inter typeface (Intercom in the meta description is the product it replaces) and no remote URL');
  const homepageSource = await Promise.all((await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.(tsx?|css)$/.test(file)).map(file => read(`src/ui/homepage/${file}`)));
  for (const text of homepageSource) assert.doesNotMatch(text, /fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|typekit/i);
  const faces = await read('src/ui/homepage/outfit.css');
  const fontUrls = [...faces.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual(fontUrls, ['/fonts/outfit/outfit-latin-wght-normal.woff2', '/fonts/outfit/outfit-latin-ext-wght-normal.woff2']);
  for (const font of fontUrls) assert.ok(await exists(`public${font}`), font);
  assert.match(faces, /font-family: Outfit;[\s\S]*font-weight: 100 900;/);
  const fallbacks = [...faces.matchAll(/@font-face \{[^}]*font-family: 'Outfit Fallback';[^}]*\}/g)].map(match => match[0]);
  assert.equal(fallbacks.length, 3, 'a metric-matched fallback face for the 400, 500 and 600 weights');
  for (const face of fallbacks) {
    assert.match(face, /src: local\('Arial(?: Bold)?'\)/, 'the fallback is a local system face, so it costs no request');
    for (const descriptor of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) assert.match(face, new RegExp(`${descriptor}: [\\d.]+%;`), `the fallback sets ${descriptor}`);
  }
  assert.match(await read('src/ui/homepage/homepage.css'), /font-family: Outfit, 'Outfit Fallback',/, 'the fallback comes straight after Outfit');
  assert.match(await read('src/ui/homepage/Homepage.tsx'), /import '\.\/outfit\.css';/);
  assert.match(await read('public/fonts/outfit/LICENSE.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.ok(JSON.parse(await read('edition.json')).components.some(component => component.source?.paths?.includes('public/fonts/outfit')), 'edition.json locks the font directory');
  const css = await read('src/ui/homepage/homepage.css') + await read('src/ui/homepage/drawings.css');
  assert.equal([...css.matchAll(/font-family:\s*([^;]+);/g)].length, 1, 'font-family is declared once, on the page root');
  assert.doesNotMatch(css, /ui-monospace|Menlo|Consolas|Georgia|Times|monospace/);
  const provenance = await read('docs/PUBLIC-SOURCE-PROVENANCE.md');
  assert.match(provenance, /Outfit typeface/);
  assert.match(provenance, /`public\/fonts\/outfit\/`/);
  assert.match(provenance, /SIL Open Font License 1\.1, `public\/fonts\/outfit\/LICENSE\.txt`/);
  assert.match(provenance, /SIL Open Font License 1\.1/);
});

test('the page is composed from one component per section', async () => {
  const home = await read('src/ui/homepage/Homepage.tsx');
  const order = ['SiteHeader', 'Hero', 'Free', 'HelpBeforeTheyAsk', 'Product', 'MoveIn', 'GetStarted', 'SiteFooter'];
  for (const name of order) {
    assert.ok(home.includes(`<${name} />`), name);
    assert.ok(await exists(`src/ui/homepage/${name}.tsx`), name);
  }
  assert.deepEqual(order.map(name => home.indexOf(`<${name} />`)), order.map(name => home.indexOf(`<${name} />`)).sort((a, b) => a - b), 'sections are composed in order: hero, free, help before they ask, the rest of the support desk, try it beside what you have, ready when you are');
  const retired = ['AgentInvestigates', 'AgentDrawing', 'HeroInbox', 'HandoffDetail', 'TaskFormDrawing', 'YoursDrawing', 'YoursToRun', 'BillDrawing', 'InstallerDrawing', 'HeroLocal'];
  for (const name of retired) {
    assert.ok(!home.includes(name) && !(await exists(`src/ui/homepage/${name}.tsx`)) && !(await exists(`src/ui/homepage/drawings/${name}.tsx`)), `${name} stays removed`);
  }
  const styles = await read('src/ui/homepage/drawings.css') + await read('src/ui/homepage/homepage.css');
  assert.doesNotMatch(styles, /\.tf-|\.task-art|\.task-form|\.hl-|\.hero-local|\.hero-examples|\.bill-|\.ins-|\.installer-art|\.import-back|\.signals|\.yours-card|\.d-marks--bracket/, 'the styles of the removed drawings, panels and strips stay removed');
  assert.doesNotMatch(styles, /\.hero-window|\.d-underline|\.callout|\.hc-ring|\.hc-note|\.hc-by|\.d-message|--bw\b/, 'the styles of the retired framed hero (window, tilt, underline, callouts, ring around Send, note byline) stay removed');
  for (const drawing of ['LicenceDrawing', 'ImportDrawing', 'HeroHandoff', 'HeroConversation', 'InkArrow', 'Flourish']) assert.ok(await exists(`src/ui/homepage/drawings/${drawing}.tsx`), drawing);
  assert.ok(!(await exists('src/ui/homepage/drawings/Callout.tsx')), 'the hero callouts stay removed');
  const heroSource = await read('src/ui/homepage/Hero.tsx');
  assert.match(heroSource, /<HeroHandoff \/>/);
  assert.match(heroSource, /<p className="hero-free">100% free, open source alternative to <strong>Zendesk<\/strong>, <strong>Intercom<\/strong>, <strong>Help&nbsp;Scout<\/strong> and <strong>Freshdesk<\/strong><\/p>\s*<Flourish \/>\s*<\/div>/, 'the flourish follows the copy column, under the calls to action');
  const ids = [['Hero', 'top'], ['Free', 'free'], ['HelpBeforeTheyAsk', 'help-before-they-ask'], ['Product', 'product'], ['MoveIn', 'move-in'], ['GetStarted', 'get-started']];
  for (const [name, id] of ids) assert.match(await read(`src/ui/homepage/${name}.tsx`), new RegExp(`id="${id}"`), `${name} keeps the anchor #${id}`);
  assert.match(home, /href="#product"/, 'the skip link still targets #product');
  const repository = await read('src/ui/homepage/repository.ts');
  assert.deepEqual([...repository.matchAll(/export const (\w+)/g)].map(match => match[1]), ['sourceUrl', 'docsUrl', 'installerUrl', 'licenseUrl'], 'only the repository links the page uses are exported');
  assert.match(repository, /^export const docsUrl = '\/docs';$/m, 'Docs and Read the docs open the documentation built from the repository Markdown');
  assert.match(repository, /^export const installerUrl = '\/docs\/install';$/m, 'Read the installation guide opens its docs page');
  assert.match(repository, /^export const licenseUrl = `\$\{sourceUrl\}\/blob\/main\/LICENSE`;$/m, 'MIT licence stays the repository\'s LICENSE');
  const route = await read('src/routes/index.tsx');
  assert.match(route, /Customer support, solved\. Your Codex or Claude fixes the problem and writes the reply; you press Send\. Chat widget, shared inbox, help centre and suggested replies\. 100% free, open source alternative to Zendesk, Intercom, Help Scout and Freshdesk\. MIT licensed\./);
  assert.match(route, /withVisualEdits\(Homepage\)/);
  for (const file of await readdir(url('src/ui/homepage'))) {
    if (/\.tsx$/.test(file)) assert.ok((await read(`src/ui/homepage/${file}`)).split('\n').length < 60, `${file} stays small`);
  }
});

test('every icon in the drawings is used and the hero drawing draws only its five strings', async () => {
  const icons = await read('src/ui/homepage/drawings/Icons.tsx');
  const names = [...icons.slice(icons.indexOf('const icons'), icons.indexOf('};')).matchAll(/^ {2}(\w+):/gm)].map(match => match[1]);
  assert.ok(names.length >= 8, 'the icon set is declared');
  const usage = (await Promise.all((await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.tsx$/.test(file) && !file.endsWith('Icons.tsx')).map(file => read(`src/ui/homepage/${file}`)))).join('\n');
  for (const name of names) assert.match(usage, new RegExp(`name="${name}"`), `icon ${name} is used`);
  const conversation = await read('src/ui/homepage/drawings/HeroConversation.tsx');
  const strings = [...conversation.replace(/\/\/.*$/gm, '').matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g)].map(match => match[1].trim());
  assert.deepEqual(strings, ['Maya', 'I can’t turn on the Spanish version of my store.', 'Fixed. Spanish is live on Maya’s store.', 'All done, Maya. Refresh and it’s there.', 'Send']);
  assert.equal(strings.join(' ').split(/\s+/).length, 26, 'the hero drawing carries the 26 words the spec lists');
  assert.doesNotMatch(conversation, /Codex|Callout|hc-ring/, 'the fix bubble has no Codex title, and the drawing has no callouts or ring');
  assert.match(conversation, /<div className="hc-bubble hc-composer">\s*<p className="hc-text">All done, Maya\. Refresh and it’s there\.<\/p>\s*<span className="d-btn d-btn--ink hc-send">Send<\/span>\s*<\/div>/, 'Send sits inside the reply bubble, after the reply');
  assert.deepEqual([...conversation.matchAll(/<InkArrow variant="(\w+)" \/>/g)].map(match => match[1]), ['long', 'short'], 'one ink arrow above the fix and one above the reply');
  assert.deepEqual([...conversation.matchAll(/<Icon name="(\w+)" \/>/g)].map(match => match[1]), ['code', 'person'], 'a code glyph beside the fix and a person glyph beside the reply');
});

test('the hero flourish is an inline svg that draws itself in once, and stands drawn under reduced motion', async () => {
  const flourish = await read('src/ui/homepage/drawings/Flourish.tsx');
  assert.match(flourish, /<svg className="hero-flourish" viewBox="0 0 640 150" fill="none" stroke="currentColor"[^>]* aria-hidden="true" focusable="false">/);
  assert.equal([...flourish.matchAll(/<path /g)].length, 1, 'one continuous pen stroke');
  assert.match(flourish, /<path pathLength=\{1\} d="M[^"]+" \/>/, 'the stroke is measured as length 1, so the dash animation is independent of its size');
  const css = await read('src/ui/homepage/drawings.css');
  assert.match(css, /\.h2h-home \.hero-flourish \{[^}]*aspect-ratio: 640 \/ 150;[^}]*color: var\(--d-cyan-deep\);/, 'its box is reserved from the first paint and it is drawn in the deep aqua');
  assert.match(css, /\.h2h-home \.hero-flourish path \{ stroke-dasharray: 1 2; stroke-dashoffset: 0; \}/, 'without animation the stroke is fully drawn');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.h2h-home \.hero-flourish path \{ animation: h2h-flourish 1\.5s cubic-bezier\([^)]+\) 0\.35s both; \}\s*\}/, 'it draws in once (no iteration count), only when motion is welcome');
  assert.match(css, /@keyframes h2h-flourish \{ from \{ stroke-dashoffset: 1\.02; \} to \{ stroke-dashoffset: 0; \} \}/, 'from hidden to fully drawn');
  assert.match(await read('src/ui/homepage/homepage.css'), /@media \(prefers-reduced-motion: reduce\) \{\s*\.h2h-home \*, \.h2h-home \*::before, \.h2h-home \*::after \{ animation: none !important;/, 'reduced motion removes every animation');
});

test('below the hero, each moment plays once on scroll through one small reveal mechanism, and rests on its final drawing', async () => {
  // The mechanism: one IntersectionObserver (reveal/observer.ts) and one hook (reveal/useReveal.ts), with no new dependency.
  const observer = await read('src/ui/homepage/reveal/observer.ts');
  const hook = await read('src/ui/homepage/reveal/useReveal.ts');
  assert.equal([...observer.matchAll(/new IntersectionObserver\(/g)].length, 1, 'one observer for every moment');
  assert.match(observer, /export const REVEAL_LINE = 0\.85;/);
  assert.match(observer, /forget\(entry\.target\);\s*play\?\.\(\);/, 'a moment is forgotten as it plays, so it plays once');
  assert.match(hook, /prefers-reduced-motion: reduce/, 'reduced motion never waits');
  assert.match(hook, /getBoundingClientRect\(\)\.top < window\.innerHeight \* REVEAL_LINE\) return;/, 'a moment already in view stays drawn');
  assert.match(hook, /setAttribute\('data-reveal', 'wait'\)[\s\S]*setAttribute\('data-reveal', 'play'\)/);
  const usage = (await Promise.all((await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.tsx$/.test(file)).map(async file => [file, await read(`src/ui/homepage/${file}`)])));
  assert.deepEqual(usage.filter(([, text]) => /useReveal/.test(text)).map(([file]) => file).sort(), ['Divider.tsx', 'Free.tsx', 'GetStarted.tsx', 'MoveIn.tsx', 'Product.tsx', 'drawings/Sketch.tsx'], 'the moments: the dividers, the promises, the closing line, the steps, each desk part and the revealing drawings');
  assert.deepEqual(usage.filter(([, text]) => /<Drawing [^>]*\breveal\b/.test(text)).map(([file]) => file).sort(), ['drawings/ImportDrawing.tsx', 'drawings/LicenceDrawing.tsx', 'drawings/OfferDrawing.tsx']);
  assert.doesNotMatch(usage.find(([file]) => file === 'Hero.tsx')[1] + usage.find(([file]) => file === 'drawings/HeroHandoff.tsx')[1], /reveal/i, 'the hero is not a reveal moment');
  const imports = (await Promise.all((await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.tsx?$/.test(file)).map(file => read(`src/ui/homepage/${file}`)))).flatMap(text => [...text.matchAll(/^import [^;]*?from '([^']+)';/gm)].map(match => match[1]));
  assert.deepEqual([...new Set(imports.filter(source => !source.startsWith('.')))].sort(), ['react'], 'the homepage imports no package but React: no animation or scroll library');
  // The choreography (motion.css): scoped, only under no-preference on screen, moving only paint and transform properties, once.
  const motion = await read('src/ui/homepage/motion.css');
  const body = motion.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = body.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const selectors = [...rules.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(match => match[1]).flatMap(group => group.split(/,(?![^(]*\))/).map(part => part.trim()));
  assert.ok(selectors.length > 40, 'motion.css has rules');
  for (const selector of selectors) assert.match(selector, /^\.h2h-home\b/, `motion.css: "${selector}" must be scoped to .h2h-home`);
  const blocks = [...rules.matchAll(/@media ([^{]+)\{/g)].map(match => match[1].trim());
  assert.ok(blocks.length >= 3 && blocks.every(query => query.startsWith('screen and (prefers-reduced-motion: no-preference)')), `every moment rule waits for motion to be welcome, on screen: ${blocks}`);
  assert.match(rules, /^\s*\.h2h-home \{ --ease-out[^}]*\}\s*@media/, 'outside those blocks only the easing tokens are set');
  const animations = [...rules.matchAll(/animation: (h2h-[\w-]+) ([\d.]+)s [^;]*?(backwards|none);/g)];
  assert.ok(animations.length >= 30, 'the moments animate');
  assert.ok(animations.every(([, , seconds, fill]) => Number(seconds) <= 1.3 && fill === 'backwards'), 'each animation is short and fills backwards only, so it rests on the final drawing');
  assert.doesNotMatch(rules, /infinite|animation-iteration-count|alternate/, 'nothing loops');
  const keyframes = [...body.matchAll(/@keyframes (h2h-[\w-]+) \{([^\n]*)\}\n/g)];
  assert.deepEqual(keyframes.map(match => match[1]).sort(), ['h2h-bloom', 'h2h-caret', 'h2h-dot', 'h2h-pen', 'h2h-pop', 'h2h-rise', 'h2h-slide', 'h2h-sweep', 'h2h-tick', 'h2h-type', 'h2h-typing']);
  for (const [, name, frames] of keyframes) {
    const properties = [...frames.matchAll(/([a-z-]+):/g)].map(match => match[1]);
    assert.ok(properties.every(property => ['opacity', 'translate', 'scale', 'clip-path', 'background-size', 'background-color', 'stroke-dasharray', 'stroke-dashoffset'].includes(property)), `${name} moves only paint and transform properties, never layout: ${properties}`);
  }
  // The final drawing carries no hidden state: every first frame is behind data-reveal="wait".
  for (const file of ['homepage.css', 'drawings.css', 'section-drawings.css']) {
    const css = (await read(`src/ui/homepage/${file}`)).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /data-reveal/, `${file} is the final drawing`);
  }
  const sections = (await read('src/ui/homepage/section-drawings.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const selector of [...sections.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(match => match[1]).flatMap(group => group.split(/,(?![^(]*\))/).map(part => part.trim()))) assert.match(selector, /^\.h2h-home\b/, `section-drawings.css: "${selector}" must be scoped to .h2h-home`);
  assert.match(await read('src/ui/homepage/Homepage.tsx'), /import '\.\/drawings\.css';\nimport '\.\/section-drawings\.css';\nimport '\.\/motion\.css';/);
});

test('the drawings below the hero speak the hero\'s language: blobs, the mark\'s sparks, frames only where they help', async () => {
  const mark = await import('../src/ui/homepage/brand-mark.ts');
  const sparks = await read('src/ui/homepage/drawings/Sparks.tsx');
  assert.match(sparks, /import \{ sparks \} from '\.\.\/brand-mark';/, 'the sparks are the mark\'s own paths');
  assert.match(sparks, /\{sparks\.map\(d => <path key=\{d\} d=\{d\} pathLength=\{1\} \/>\)\}/);
  assert.equal(mark.sparks.length, 3);
  assert.ok(!(await exists('src/ui/homepage/drawings/marks.ts')), 'the old corner marks are removed');
  const styles = ['homepage.css', 'drawings.css', 'section-drawings.css', 'motion.css'].map(file => `src/ui/homepage/${file}`);
  const allStyles = (await Promise.all(styles.map(read))).join('\n');
  assert.doesNotMatch(allStyles, /\.d-marks|h2h-draw\b|\.sk-pay-row|bar=\{false\}/, 'the corner marks and their draw-in are gone');
  const drawings = Object.fromEntries(await Promise.all(['LicenceDrawing', 'OfferDrawing', 'ProductDrawings', 'ImportDrawing', 'SuggestedReply'].map(async name => [name, await read(`src/ui/homepage/drawings/${name}.tsx`)])));
  assert.deepEqual(Object.entries(drawings).map(([name, text]) => [name, [...text.matchAll(/<SketchWindow\b/g)].length, [...text.matchAll(/<Sparks \/>/g)].length, [...text.matchAll(/<Blob shape="(\w+)" \/>/g)].map(match => match[1])]), [
    ['LicenceDrawing', 1, 1, ['left']],
    ['OfferDrawing', 1, 0, ['right']],
    ['ProductDrawings', 0, 2, ['left', 'right', 'pebble', 'long']],
    ['ImportDrawing', 1, 1, ['pebble']],
    ['SuggestedReply', 0, 0, []],
  ], 'windows kept for the editor, the checkout and the import; sparks on four cards; a blob behind every drawing');
  assert.match(drawings.OfferDrawing, /<span className="offer-avatar"><BrandMark \/><\/span>/, 'the widget\'s avatar is the speech-bubble mark');
  assert.match(drawings.OfferDrawing, /<span className="offer-typing"><i \/><i \/><i \/><\/span>/, 'typing dots before the offer');
  assert.doesNotMatch(drawings.ProductDrawings + drawings.SuggestedReply, /d-window|d-bar/, 'the desk cards drop their window chrome');
  assert.match(await read('src/ui/homepage/SiteFooter.tsx'), /<BrandLockup home=\{home\} \/>/, 'the footer signs off with the lockup');
  assert.match(await read('src/ui/homepage/Homepage.tsx'), /<Free \/><Divider \/><HelpBeforeTheyAsk \/><Product \/><Divider \/><MoveIn \/>/, 'dividers between Free and Help before they ask, and between the desk and Try it');
  assert.match(await read('src/ui/homepage/GetStarted.tsx'), /<h2 id="get-started-title" ref=\{reveal\}>Ready when you are\.<svg className="ready-line"[^>]*aria-hidden="true" focusable="false">/, 'the closing headline carries its aqua line, decorative');
  for (const [file, pattern] of [['Free.tsx', /<span className="proof-icon">/], ['Product.tsx', /<span className="step" aria-hidden="true">\{number\}<\/span>/]]) assert.match(await read(`src/ui/homepage/${file}`), pattern, file);
  const homepage = await read('src/ui/homepage/homepage.css');
  assert.match(homepage, /\.h2h-home \.step \{[^}]*border-radius: 50%; background: var\(--d-cyan\);/, 'the desk numbers sit on filled aqua discs');
  assert.match(homepage, /\.h2h-home \.steps li::before \{[^}]*border-radius: 50%; background: var\(--d-cyan\);/, 'so do the three steps');
  assert.match(homepage, /\.h2h-home \.site-header \.brand, \.h2h-home \.site-footer \.brand \{/, 'one lockup rule for the header and the footer');
});

test('the homepage source is free of cost, hosting, provider and Run Edit Run text', async () => {
  const files = [...(await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.tsx?$/.test(file)).map(file => `src/ui/homepage/${file}`), 'src/routes/index.tsx'];
  const banned = /US\$|\$0|\$\d|Cloudflare|\bhosting\b|\bhosted\b|\bproviders?\b|run\s?edit\s?run|runeditrun|costsUrl|hostedUrl|before-you-start|Paid to|per month|a month|Nothing there changes|Yours to run|yours-to-run|The same move for|(?<!100% )free and open source\./i;
  for (const file of files) assert.doesNotMatch(await read(file), banned, `${file} carries no cost, hosting, provider or Run Edit Run text`);
  const hero = await read('src/ui/homepage/Hero.tsx');
  assert.match(hero, /Your Codex or Claude fixes the problem and writes the reply\. You press Send\./);
  assert.match(hero, /100% free, open source alternative to <strong>Zendesk<\/strong>, <strong>Intercom<\/strong>, <strong>Help&nbsp;Scout<\/strong> and <strong>Freshdesk<\/strong>/);
  assert.match(await read('src/ui/homepage/homepage.css'), /\.hero-free strong \{ font-weight: 600; \}/, 'the company names take the page\'s bold weight');
  const free = await read('src/ui/homepage/Free.tsx');
  assert.match(free, /HappyToHelp is 100% free and open source\. Free as in code, and free as in cost\. It’s MIT licensed, so it’s yours to use, change and run however you like\./);
  assert.match(free, /\['No seats\.', 'No plans\.', 'No fees\.'\]/);
  assert.match(await read('src/ui/homepage/GetStarted.tsx'), /Ready when you are\./);
  assert.match(await read('src/ui/homepage/drawings/LicenceDrawing.tsx'), /MIT License[\s\S]*Permission is hereby granted, [\s\S]*free of charge[\s\S]*use, copy, modify, merge, publish, distribute/);
});

test('the 404 page uses the homepage language and its styles stay scoped', async () => {
  const css = (await read('src/ui/homepage/not-found.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(match => match[1]);
  assert.ok(selectors.length >= 4, 'not-found.css has rules');
  for (const selector of selectors.flatMap(group => group.split(',').map(part => part.trim()))) assert.match(selector, /^\.h2h-home\b/, `not-found.css: "${selector}" must be scoped to .h2h-home`);
  assert.doesNotMatch(css, /font-family|https?:\/\//i, 'the typeface comes from the page root and nothing is third-party');
  const component = await read('src/ui/homepage/NotFound.tsx');
  assert.match(component, /className="h2h-home"/);
  assert.match(component, /import '\.\/outfit\.css';/);
  assert.match(component, /href="\/">Back to the homepage/);
  assert.match(component, /href="\/projects">Open your workspace/);
  const root = await read('src/routes/__root.tsx');
  assert.match(root, /notFoundComponent: NotFound/);
  assert.doesNotMatch(root, /<h1>Not found<\/h1>/);
  assert.match(root, /Page not found · HappyToHelp/);
});

test('wherever HappyToHelp itself is the brand, it shows the mark, and the old smiley-circle mark is gone', async () => {
  assert.match(await read('src/ui/identity/IdentityFrame.tsx'), /<header className="id-header"><BrandLockup home="\/" \/><\/header>/, 'the identity pages carry the homepage lockup');
  assert.doesNotMatch(await read('src/ui/identity/IdentityFrame.tsx'), />HappyToHelp<\/a>/, 'no text-only wordmark in the identity header');
  const admin = await read('src/ui/native/AdminNavigation.jsx');
  assert.match(admin, /import \{ BrandMark \} from '\.\.\/homepage\/BrandMark';/);
  assert.match(admin, /<Link className="navbar-workspace-toggle" to="\/conversations"><BrandMark \/><span className="navbar-workspace-copy"><span className="navbar-workspace-label">HappyToHelp<\/span><span className="navbar-workspace-name">Administration<\/span><\/span><\/Link>/, 'the platform-admin rail draws the mark beside its label');
  assert.doesNotMatch(admin, /<img/, 'no image mark in the platform-admin rail');
  assert.match(await read('src/ui/native/Dashboard.tsx'), /export function DashboardError[\s\S]*?<h1 className="dashboard-error-brand"><BrandLockup home="\/" \/><\/h1>/, 'the dashboard load-error heading is the lockup');
  // The no-project Help Center page draws the lockup from the geometry files and links the application's own tab icons, in order.
  const platform = await read('src/modules/public-site/platform-brand.ts');
  assert.match(platform, /import \{ markSvg \} from '\.\.\/\.\.\/ui\/homepage\/brand-mark'/);
  assert.match(platform, /import \{ wordSvg \} from '\.\.\/\.\.\/ui\/homepage\/brand-word'/);
  const root = await read('src/routes/__root.tsx');
  const rootIcons = [...root.matchAll(/\{ rel: '([^']+)', (?:type: '([^']+)', )?sizes: '([^']+)', href: `\$\{brands\}\/([^`]+)` \}/g)].map(([, rel, type, sizes, file]) => `<link rel="${rel}"${type ? ` type="${type}"` : ''} sizes="${sizes}" href="\${brands}/${file}">`);
  assert.equal(rootIcons.length, 3, 'the application links three tab icons');
  assert.ok(platform.includes(`export const platformIcons = \`${rootIcons.join('')}\``), 'the no-project Help Center page links the same tab icons as every application page');
  assert.match(platform, /const brands = '\/homepage\/media\/brands'/);
  assert.match(root, /const brands = '\/homepage\/media\/brands'/);
  assert.match(await read('src/modules/public-site/not-found.ts'), /export function missingHelpCenterPage\(\) \{[\s\S]*?platform: true \}\)/, 'only the no-project page is HappyToHelp\'s');
  assert.equal([...(await read('src/modules/public-site/not-found.ts')).matchAll(/platform: true/g)].length, 1, 'project 404s keep the project\'s brand');
  const word = await import('../src/ui/homepage/brand-word.ts');
  assert.equal(word.wordSvg(), `<svg class="brand-word" viewBox="${word.wordViewBox}" width="${word.wordWidthEm}em" height="${word.wordHeightEm}em" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="${word.wordStrokeWidth}" stroke-linecap="round" stroke-linejoin="round">${word.wordGlyphs.map(({ x, d }) => `<path transform="translate(${x} 0)" d="${d}"/>`).join('')}</svg>`, 'wordSvg() is the element BrandWord.tsx renders');
  const removed = ['public/img/icon.svg', 'src/ui/dashboard/components/Robot.jsx', 'src/ui/dashboard/components/RobotMessage.jsx', 'src/ui/dashboard/styles/components/Robot.scss', 'src/ui/dashboard/styles/components/Robot.css', 'src/ui/dashboard/styles/components/Robot.css.map', 'src/ui/dashboard/styles/components/RobotMessage.scss', 'src/ui/dashboard/styles/components/RobotMessage.css', 'src/ui/dashboard/styles/components/RobotMessage.css.map', 'src/modules/widget/js/Footer.jsx', 'src/modules/widget/css/Footer.css', ...['icon', 'icon-circle', 'icon-circle-side', 'icon-smile', 'logo'].map(name => `src/modules/widget/img/${name}.svg`)];
  for (const path of removed) assert.equal(await exists(path), false, `${path} (old mark) stays removed`);
  const oldMark = /94\.61,0L83\.18|M8\.76,104\.72|M 94\.61 0|103\.26 104\.72|103\.3 104\.7|483\.71 104\.72/;
  const sources = [...(await readdir(url('src'), { recursive: true })).map(file => `src/${file}`), ...(await readdir(url('public'), { recursive: true })).map(file => `public/${file}`)].filter(file => /\.(tsx?|jsx?|s?css|svg|json|html|md)$/.test(file));
  for (const file of sources) assert.ok(!oldMark.test(await read(file)), `${file} holds no old smiley-circle geometry`);
  for (const file of sources.filter(file => /^src\/.*\.(tsx?|jsx?|s?css)$/.test(file))) assert.ok(!/img\/icon\.svg|navbar-workspace-platform-icon|app_logo/.test(await read(file)), `${file} holds no reference to the old mark`);
  // The widget's live stylesheet (inlined by Style.jsx) and its components carry no HappyToHelp attribution on customers' sites.
  assert.match(await read('src/modules/widget/js/Style.jsx'), /import styles from '\.\.\/css\/Root\.css\?inline';/);
  const widget = ['src/modules/widget/css/Root.css', ...(await readdir(url('src/modules/widget/js'), { recursive: true })).filter(file => /\.jsx?$/.test(file)).map(file => `src/modules/widget/js/${file}`)];
  for (const file of widget) assert.ok(!/happytohelp-footer|happytohelp-logo|We use/.test(await read(file)), `${file} carries no HappyToHelp attribution`);
});
