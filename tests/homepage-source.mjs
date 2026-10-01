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
  assert.deepEqual(provenance.map(entry => entry.source), ['homepage/media/brands/happytohelp-favicon.png']);
  for (const entry of provenance) {
    const bytes = await readFile(url(`public/${entry.source}`));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
  }
  for (const path of ['CONTRACT.md', 'ACCEPTANCE.md', 'HANDOVER.md', 'docs/MODULES.md', 'docs/PUBLIC-SOURCE-PROVENANCE.md', 'docs/SOURCE-PROVENANCE.md', 'README.md', 'OPERATIONS.md', 'seed.json']) {
    assert.doesNotMatch(await read(path), /village|Support\. Free\. Yours/i, `${path} must not describe the retired village homepage`);
  }
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
  assert.doesNotMatch(route, /Inter|https?:\/\//);
  const homepageSource = await Promise.all((await readdir(url('src/ui/homepage'), { recursive: true })).filter(file => /\.(tsx?|css)$/.test(file)).map(file => read(`src/ui/homepage/${file}`)));
  for (const text of homepageSource) assert.doesNotMatch(text, /fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|typekit/i);
  const faces = await read('src/ui/homepage/outfit.css');
  const fontUrls = [...faces.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual(fontUrls, ['/fonts/outfit/outfit-latin-wght-normal.woff2', '/fonts/outfit/outfit-latin-ext-wght-normal.woff2']);
  for (const font of fontUrls) assert.ok(await exists(`public${font}`), font);
  assert.match(faces, /font-family: Outfit;[\s\S]*font-weight: 100 900;/);
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
  const order = ['SiteHeader', 'Hero', 'HelpBeforeTheyAsk', 'Product', 'HandoffDetail', 'YoursToRun', 'SiteFooter'];
  for (const name of order) {
    assert.ok(home.includes(`<${name} />`), name);
    assert.ok(await exists(`src/ui/homepage/${name}.tsx`), name);
  }
  assert.deepEqual(order.map(name => home.indexOf(`<${name} />`)), order.map(name => home.indexOf(`<${name} />`)).sort((a, b) => a - b), 'sections are composed in order: hero handoff, help before they ask, product, handoff detail, yours to run');
  for (const retired of ['AgentInvestigates', 'AgentDrawing', 'HeroInbox']) {
    assert.ok(!home.includes(retired) && !(await exists(`src/ui/homepage/${retired}.tsx`)) && !(await exists(`src/ui/homepage/drawings/${retired}.tsx`)), `${retired} stays removed`);
  }
  assert.match(await read('src/ui/homepage/Hero.tsx'), /<HeroHandoff \/>/);
  assert.match(await read('src/routes/index.tsx'), /withVisualEdits\(Homepage\)/);
  for (const file of await readdir(url('src/ui/homepage'))) {
    if (/\.tsx$/.test(file)) assert.ok((await read(`src/ui/homepage/${file}`)).split('\n').length < 60, `${file} stays small`);
  }
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
