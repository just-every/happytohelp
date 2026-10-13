import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The site's /docs pages are built from the repository's Markdown listed in docs/site.json (src/ui/docs/build). These
// checks need no build: they import the same build modules the Vite plugin runs.
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFile(join(root, path), 'utf8');
const { readManifest } = await import('../src/ui/docs/build/manifest.ts');
const { absolutePath, buildSite, pathKind, readRepository } = await import('../src/ui/docs/build/site.ts');
const { renderPage } = await import('../src/ui/docs/build/render.ts');
const { createSlugger } = await import('../src/ui/docs/build/slug.ts');

const site = buildSite(root);
const repository = readRepository(root).url;

test('the manifest rules are enforced: one home first, clean unique slugs, existing unique sources, reasons', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'h2h-docs-manifest-')));
  try {
    await mkdir(join(fixture, 'docs'));
    for (const file of ['README.md', 'A.md', 'B.md']) await writeFile(join(fixture, file), `# ${file}\n`);
    const check = async manifest => {
      await writeFile(join(fixture, 'docs/site.json'), JSON.stringify(manifest));
      return assert.throws(() => readManifest(fixture));
    };
    const page = (slug, source, label = 'Label') => ({ slug, source, label });
    const valid = { sections: [{ title: 'S', pages: [page('', 'README.md'), page('a', 'A.md')] }], githubOnly: [{ source: 'B.md', reason: 'Kept on GitHub' }] };
    await writeFile(join(fixture, 'docs/site.json'), JSON.stringify(valid));
    assert.equal(readManifest(fixture).pages.length, 2);
    await check({ ...valid, sections: [{ title: 'S', pages: [page('a', 'A.md'), page('', 'README.md')] }] });
    await check({ ...valid, sections: [{ title: 'S', pages: [page('', 'README.md'), page('index', 'A.md')] }] });
    await check({ ...valid, sections: [{ title: 'S', pages: [page('', 'README.md'), page('Install', 'A.md')] }] });
    await check({ ...valid, sections: [{ title: 'S', pages: [page('', 'README.md'), page('a', 'A.md'), page('a', 'B.md')] }], githubOnly: [] });
    await check({ ...valid, sections: [{ title: 'S', pages: [page('', 'README.md'), page('a', 'MISSING.md')] }] });
    await check({ ...valid, githubOnly: [{ source: 'A.md', reason: 'Twice' }] });
    await check({ ...valid, githubOnly: [{ source: 'B.md', reason: ' ' }] });
    await check({ ...valid, githubOnly: [{ source: 'GONE.md', reason: 'Stale' }] });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('every Markdown file at the root, under docs/ or as a top-level README is published or listed as GitHub-only', () => {
  const manifest = readManifest(root);
  const listed = new Set([...manifest.pages, ...manifest.githubOnly].map(entry => entry.source));
  const inScope = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(file => /^([^/]+\.md|docs\/.+\.md|[^./][^/]*\/README\.md)$/.test(file));
  assert.ok(inScope.includes('README.md'),'the documented checkout is inspected');
  const unlisted = inScope.filter(file => !listed.has(file));
  assert.deepEqual(unlisted, [], `Add ${unlisted.join(', ')} to docs/site.json, as a published page or under githubOnly with a reason`);
  assert.equal(listed.size, manifest.pages.length + manifest.githubOnly.length, 'no source is listed twice');
});

test('the docs build renders every page with no problems, one title, unique ids and only safe, resolvable links', () => {
  assert.deepEqual(site.problems, []);
  assert.equal(site.pages.length, readManifest(root).pages.length);
  const published = new Map(site.pages.map(page => [page.href, new Set(page.ids)]));
  const kind = pathKind(root);
  const reproducible = /const absolutePath = (\/.+\/g);/.exec(readFileSync(join(root, 'tests/reproducible-build.mjs'), 'utf8'))[1];
  assert.equal(String(absolutePath), reproducible, 'the docs build refuses the same machine paths as tests/reproducible-build.mjs');
  for (const page of site.pages) {
    const markdown = readFileSync(join(root, page.source), 'utf8');
    assert.equal(page.title, /^# (.+)$/m.exec(markdown)[1].replace(/`/g, ''), `${page.source} title`);
    assert.match(markdown.replace(/^(\s*<[^\n]*(\n(?!\n)[^\n]*)*\n)+/, '').trimStart(), /^# /, `${page.source} starts with its H1, after any HTML banner block`);
    assert.doesNotMatch(page.html, /<h1\b/, `${page.source} has exactly one H1, rendered by the page`);
    assert.equal(new Set(page.ids).size, page.ids.length, `${page.source} heading ids are unique`);
    assert.doesNotMatch(page.html, /\s(style|on[a-z]+)=|<script/i, `${page.source} has no inline style, handler or script`);
    assert.doesNotMatch(page.html, new RegExp(absolutePath.source), `${page.source} names no machine path`);
    for (const [, href] of page.html.matchAll(/<a href="([^"]+)"/g)) {
      const decoded = href.replaceAll('&amp;', '&');
      if (decoded.startsWith('/docs')) {
        const [path, hash] = decoded.split('#');
        assert.ok(published.has(path), `${page.source}: ${href} is a published page`);
        if (hash) assert.ok(published.get(path).has(decodeURIComponent(hash)), `${page.source}: ${href} names a heading`);
      } else if (decoded.startsWith('#')) {
        assert.ok(page.ids.includes(decodeURIComponent(decoded.slice(1))), `${page.source}: ${href} names a heading on the page`);
      } else if (decoded.startsWith(`${repository}/`) && !markdown.includes(`](${decoded})`) && !markdown.includes(`<${decoded}>`)) {
        // A relative link the build rewrote to GitHub (links written as full URLs in the Markdown stay as they are).
        const match = new RegExp(`^${repository}/(blob|tree)/main/([^#]+)`).exec(decoded);
        assert.ok(match, `${page.source}: ${href} is a blob or tree link on main`);
        assert.equal(kind(match[2]), match[1] === 'blob' ? 'file' : 'directory', `${page.source}: ${href} names an existing path`);
      } else assert.match(decoded, /^(https?:|mailto:)/, `${page.source}: ${href} is external`);
    }
  }

});

// A link context for in-memory fixtures: one published page and a few repository paths.
const fixtureContext = (source = 'docs/PAGE.md') => ({
  source,
  repository: { url: 'https://github.com/just-every/happytohelp', branch: 'main' },
  published: new Map([['docs/PAGE.md', '/docs/page'], ['docs/OTHER.md', '/docs/other']]),
  kind: path => ({ 'docs/PAGE.md': 'file', 'docs/OTHER.md': 'file', 'docs/INTERNAL.md': 'file', 'docs/licenses': 'directory', LICENSE: 'file', 'docs/media/diagram.png': 'file' })[path] ?? null,
});
const render = (body, source) => renderPage(`# Fixture page\n\n${body}\n`, fixtureContext(source));

test('heading ids match GitHub, including duplicates, em dashes, backticks and parentheses', () => {
  const slug = createSlugger();
  assert.equal(slug('Request limits (`RATE_LIMITS`)'), 'request-limits-rate_limits');
  assert.equal(slug('Updates, backup and recovery'), 'updates-backup-and-recovery');
  assert.equal(slug('Current final disposition — FAIL / confirmed owner HOLD'), 'current-final-disposition--fail--confirmed-owner-hold');
  assert.deepEqual([slug('Added'), slug('Added'), slug('Added')], ['added', 'added-1', 'added-2']);
  const page = render('## Request limits (`RATE_LIMITS`)\n\n### Added\n\n### Added\n\n### Added');
  assert.deepEqual(page.ids, ['fixture-page', 'request-limits-rate_limits', 'added', 'added-1', 'added-2']);
  assert.match(page.html, /<h2 id="request-limits-rate_limits">Request limits \(<code>RATE_LIMITS<\/code>\)<\/h2>/);
  assert.deepEqual(page.toc, [
    { depth: 2, id: 'request-limits-rate_limits', text: 'Request limits (RATE_LIMITS)' },
    { depth: 3, id: 'added', text: 'Added' }, { depth: 3, id: 'added-1', text: 'Added' }, { depth: 3, id: 'added-2', text: 'Added' },
  ]);
  assert.equal(page.title, 'Fixture page');
  assert.equal(page.titleId, 'fixture-page');
});

test('tables, code, callouts and raw HTML render safely with classes only', () => {
  const table = render('| Name | Count |\n|:----:|------:|\n| a | 1 |').html.trim();
  assert.match(table, /^<div class="docs-table" role="region" tabindex="0" aria-label="Table: Name, Count"><table>/);
  assert.match(table, /<th class="docs-align-center">Name<\/th><th class="docs-align-right">Count<\/th>/);
  assert.doesNotMatch(table, /style=|align=/);
  const long = render(`| ${Array.from({ length: 12 }, (_, i) => `Column number ${i}`).join(' | ')} |\n|${'---|'.repeat(12)}`).html;
  assert.ok(/aria-label="([^"]+)"/.exec(long)[1].length <= 80, 'the table label stays short');
  const code = render('```sh\n# install\npnpm install --frozen-lockfile\n```').html;
  assert.match(code, /^<pre><code class="language-sh"><span class="hljs-comment"># install<\/span>\npnpm install --frozen-lockfile<\/code><\/pre>$/);
  assert.doesNotMatch(code, /class="(?:[^"]*\s)?hljs[\s"]/, 'the global dark .hljs theme never applies');
  assert.equal(render('```\nplain <b>text</b>\n```').html, '<pre><code>plain &lt;b&gt;text&lt;/b&gt;</code></pre>');
  assert.equal(render('```unknownlang\nx = 1\n```').html, '<pre><code class="language-unknownlang">x = 1</code></pre>');
  assert.equal(render('Use `pnpm run verify` first, please.').html, '<p>Use <code>pnpm run verify</code> first, please.</p>');
  const warning = render('> [!WARNING]\n> Back up the database first.').html;
  assert.equal(warning, '<div class="docs-callout docs-callout--warning" role="note"><p class="docs-callout-label">Warning</p>\n<p>Back up the database first.</p>\n</div>');
  assert.match(render('> Just a quote.').html, /^<blockquote>\n<p>Just a quote\.<\/p>\n<\/blockquote>$/);
  const raw = render('Hello <script>alert(1)</script> <img src=x onerror=alert(1)>').html;
  assert.doesNotMatch(raw, /<script|<img/);
  assert.match(raw, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('links go to published pages, to GitHub for everything else, or are reported', () => {
  const page = render([
    '[same page](#fixture-page) [other](OTHER.md) [other heading](OTHER.md#part) [internal](INTERNAL.md) [licences](licenses)',
    '[licence](../LICENSE) [site](https://example.com/a?b=c) [mail](mailto:team@example.com)',
  ].join('\n\n'));
  assert.deepEqual(page.problems, []);
  assert.deepEqual([...page.html.matchAll(/href="([^"]+)"/g)].map(match => match[1]), [
    '#fixture-page', '/docs/other', '/docs/other#part', 'https://github.com/just-every/happytohelp/blob/main/docs/INTERNAL.md',
    'https://github.com/just-every/happytohelp/tree/main/docs/licenses', 'https://github.com/just-every/happytohelp/blob/main/LICENSE',
    'https://example.com/a?b=c', 'mailto:team@example.com',
  ]);
  assert.deepEqual(page.anchors, [{ source: 'docs/PAGE.md', id: 'fixture-page' }, { source: 'docs/OTHER.md', id: 'part' }]);
  assert.deepEqual(render('[gone](MISSING.md) [up](../../outside.md) [js](javascript:alert(1)) [rooted](/docs/x) [hash](../LICENSE#x)').problems, [
    'MISSING.md (docs/MISSING.md does not exist)', '../../outside.md (outside the repository)', 'javascript:alert(1) (unsupported link scheme)',
    '/docs/x (use a path relative to docs/PAGE.md)', '../LICENSE#x (an anchor can only point into a Markdown file)',
  ]);
});

test('images come only from docs/media, with alt text', () => {
  const good = render('![A diagram](media/diagram.png)');
  assert.deepEqual(good.problems, []);
  assert.deepEqual(good.images, ['docs/media/diagram.png']);
  assert.match(good.html, /<img src="__DOCS_IMAGE_0__" alt="A diagram" loading="lazy" decoding="async"\/>/);
  assert.deepEqual(render('![Outside](../LICENSE) ![External](https://example.com/a.png) ![](media/diagram.png) ![Missing](media/none.png)').problems, [
    '../LICENSE (images must be files in docs/media/)', 'https://example.com/a.png (images must be files in docs/media/)',
    'media/diagram.png (image has no alt text)', 'media/none.png (docs/media/none.png does not exist)',
  ]);
});

test('a page has one H1, first, and a description from its first real paragraph', () => {
  assert.deepEqual(renderPage('Intro first.\n\n# Title\n', fixtureContext()).problems, ['the first block must be the page\'s H1', 'an H1 that is not the first block (a page has exactly one H1, first)']);
  assert.deepEqual(renderPage('<b>x</b>\n\n# Title\n', fixtureContext()).problems, ['the first block must be the page\'s H1', 'an H1 that is not the first block (a page has exactly one H1, first)']);
  assert.deepEqual(renderPage('# One\n\n# Two\n', fixtureContext()).problems, ['an H1 that is not the first block (a page has exactly one H1, first)']);
  const page = render(`**Short line.**\n\nThis paragraph explains what the page covers in more than eight words, ${'and keeps going '.repeat(12)}until the end.`);
  assert.ok(page.description.startsWith('This paragraph explains what the page covers in more than eight words, and keeps going'));
  assert.ok(page.description.length <= 160 && page.description.endsWith('…'), page.description);
  assert.equal(render('Too short.').description, 'Fixture page: HappyToHelp documentation.');
});

test('broken links and anchors across pages fail the site build, naming the file and the link', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'h2h-docs-site-')));
  try {
    await mkdir(join(fixture, 'docs'));
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ repository: { url: 'https://github.com/just-every/happytohelp' } }));
    await writeFile(join(fixture, 'docs/site.json'), JSON.stringify({ sections: [{ title: 'S', pages: [{ slug: '', source: 'README.md', label: 'Home' }, { slug: 'guide', source: 'docs/GUIDE.md', label: 'Guide' }] }], githubOnly: [{ source: 'NOTES.md', reason: 'Maintainer notes' }] }));
    await writeFile(join(fixture, 'README.md'), '# Home\n\n[guide](docs/GUIDE.md#second) [bad](docs/GUIDE.md#third) [notes](NOTES.md#kept) [gone](NOTES.md#lost) [missing](docs/MISSING.md) [self](#nowhere)\n');
    await writeFile(join(fixture, 'docs/GUIDE.md'), '# Guide\n\n## Second\n');
    await writeFile(join(fixture, 'NOTES.md'), '# Notes\n\n## Kept\n');
    const built = buildSite(fixture);
    assert.deepEqual(built.problems, [
      'README.md: docs/MISSING.md (docs/MISSING.md does not exist)',
      'README.md: #third (no such heading in docs/GUIDE.md)',
      'README.md: #lost (no such heading in NOTES.md)',
      'README.md: #nowhere (no such heading in README.md)',
    ]);
    assert.match(built.pages[0].html, /href="\/docs\/guide#second"/);
    assert.match(built.pages[0].html, /href="https:\/\/github\.com\/just-every\/happytohelp\/blob\/main\/NOTES\.md#kept"/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('the site links point at the docs pages', async () => {
  const module = await read('src/ui/homepage/repository.ts');
  const value = name => new RegExp(`export const ${name} = '([^']+)';`).exec(module)?.[1];
  assert.equal(value('docsUrl'), site.pages.find(page => page.source === 'README.md').href);
  assert.equal(value('installerUrl'), site.pages.find(page => page.source === 'docs/INSTALLER.md').href);
});

test('every published page gets its own title stroke, the same one on every build, drawn in the drawings\' pen', async () => {
  const { assignTitleStrokes, titleStrokes, titleStrokeHeight } = await import('../src/ui/docs/title-strokes.ts');
  const { sections } = readManifest(root);
  const slugs = sections.flatMap(section => section.pages.map(page => page.slug));
  assert.ok(titleStrokes.length >= slugs.length, 'at least as many strokes as published pages');
  assert.equal(new Set(titleStrokes.map(stroke => stroke.name)).size, titleStrokes.length, 'stroke names are unique');
  assert.equal(new Set(titleStrokes.map(stroke => stroke.d)).size, titleStrokes.length, 'no two strokes share a shape');
  for (const stroke of titleStrokes) {
    assert.ok(stroke.width >= 160 && stroke.width <= 320 && stroke.reach > 0.4 && stroke.reach < 0.9, `${stroke.name} size`);
    const numbers = stroke.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.match(stroke.d, /^M[\d.\s]+C[\d.\s]+(?:M[\d.\s]+(?:C)?[\d.\s]+)*$/, `${stroke.name} is moves and curves only`);
    assert.ok(numbers.every((value, index) => index % 2 ? value >= 0 && value <= titleStrokeHeight : value >= 0 && value <= stroke.width), `${stroke.name} stays inside its box`);
  }
  const assigned = assignTitleStrokes(sections);
  assert.deepEqual([...assigned.keys()], slugs, 'every published page has a stroke');
  assert.equal(new Set([...assigned.values()].map(stroke => stroke.name)).size, slugs.length, 'no two published pages share a stroke');
  for (const section of sections) {
    const names = section.pages.map(page => assigned.get(page.slug).name);
    assert.equal(new Set(names).size, names.length, `${section.title}: no two pages in the section share a stroke`);
  }
  // Deterministic: the same manifest gives the same strokes; a page added later in the manifest leaves the others alone.
  assert.deepEqual([...assignTitleStrokes(structuredClone(sections)).entries()].map(([slug, stroke]) => [slug, stroke.name]), [...assigned.entries()].map(([slug, stroke]) => [slug, stroke.name]));
  const grown = assignTitleStrokes([...sections, { pages: [{ slug: 'a-new-page' }] }]);
  for (const slug of slugs) assert.equal(grown.get(slug), assigned.get(slug), `${slug} keeps its stroke when a page is added after it`);
  // A section with more pages than there are strokes still never repeats one until every stroke is used.
  const many = assignTitleStrokes([{ pages: Array.from({ length: titleStrokes.length }, (_, index) => ({ slug: `page-${index}` })) }]);
  assert.equal(new Set([...many.values()]).size, titleStrokes.length);
  // The pen: ink, round caps and joins, one width that does not scale with the box, hidden from assistive technology.
  const component = await read('src/ui/docs/DocsTitleStroke.tsx');
  for (const attribute of ['stroke="currentColor"', 'strokeLinecap="round"', 'strokeLinejoin="round"', 'aria-hidden="true"', 'vectorEffect="non-scaling-stroke"', 'pathLength={1}']) assert.ok(component.includes(attribute), attribute);
  const css = await read('src/ui/docs/docs.css');
  assert.doesNotMatch(css, /\.docs-title::after/, 'the old single swash is gone');
  assert.match(css, /\.h2h-docs \.docs-title-stroke \{[^}]*color: var\(--ink\)/, 'the stroke is ink');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.h2h-docs \.docs-title-stroke path \{ animation: h2h-flourish [^}]* both; \}/, 'drawn in once, only when motion is welcome');
});

test('docs.css is scoped to .h2h-docs, uses one monospace family and nothing third-party', async () => {
  const raw = await read('src/ui/docs/docs.css');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(match => match[1]);
  assert.ok(selectors.length > 40, 'docs.css has rules');
  for (const selector of selectors.flatMap(group => group.split(/,(?![^(]*\))/).map(part => part.trim()))) {
    assert.match(selector, /^\.h2h-docs\b/, `docs.css: "${selector}" must be scoped to .h2h-docs`);
  }
  const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map(match => match[1]);
  assert.equal(families.length, 1);
  assert.match(families[0], /^ui-monospace,/);
  const urls = [...css.matchAll(/url\(("[^"]*"|'[^']*'|[^)]*)\)/g)].map(match => match[1].replace(/^["']|["']$/g, ''));
  assert.ok(urls.every(url => url.startsWith('data:image/svg+xml,')), 'only inline drawings, no fetched resource');
  assert.doesNotMatch(css.replace(/url\("data:[^"]*"\)/g, ''), /https?:\/\/|url\(\s*['"]?\/\//, 'no third-party URL');
});

test('source discipline: small components, build modules kept out of the app, /docs reserved from help centre aliases', async () => {
  for (const file of (await readdir(join(root, 'src/ui/docs'))).filter(name => name.endsWith('.tsx'))) {
    assert.ok((await read(`src/ui/docs/${file}`)).split('\n').length < 60, `${file} stays small`);
  }
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts', 'vite.config.ts'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(file => /\.(m?[jt]sx?|cjs)$/.test(file) && !file.startsWith('src/ui/docs/build/') && file !== 'vite.config.ts');
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /from\s+['"][^'"]*docs\/build\b|import\(\s*['"][^'"]*docs\/build\b/, `${file} must not import the docs build modules (they read the file system)`);
    if (file.startsWith('src/ui/docs/')) assert.doesNotMatch(source, /from\s+['"]\.\/build\//, `${file} must not import the docs build modules`);
  }
  assert.match(await read('vite.config.ts'), /import \{ docsSite \} from '\.\/src\/ui\/docs\/build\/plugin\.ts'/);
  assert.match(await read('src/modules/public-site/help-center.tsx'), /export const reserved=new Set\(\[[^\]]*'docs'[^\]]*\]\)/);
});
