import test from 'node:test';
import assert from 'node:assert/strict';
import { on, once } from 'node:events';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { docsSite } from '../src/ui/docs/build/plugin.ts';

// `vite dev` keeps the docs in sync with the Markdown: the docs plugin alone, in a Vite server over a fixture repository,
// serves the edited file, refuses a broken link on the docs pages only, follows docs/site.json, and survives folders
// removed with their files, dropping a page whose Markdown went with its folder. The routes' own loader is evaluated
// once and stays fresh throughout, as it does in the Worker, which is never reloaded.
const loaderPath = join(dirname(fileURLToPath(import.meta.url)), '../src/ui/docs/load.ts');
const until = async (check, label) => {
  const deadline = Date.now() + 5000;
  for (;;) {
    try { return await check(); } catch (error) {
      if (Date.now() > deadline) throw new Error(`${label} within 5 s: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};
const site = pages => JSON.stringify({ sections: [{ title: 'Guide', pages }], githubOnly: [] });
const home = { slug: '', source: 'README.md', label: 'Home' };

test('the docs plugin follows edits to Markdown and docs/site.json in a running dev server', { timeout: 60000 }, async ({ signal }) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'h2h-docs-sync-')));
  await mkdir(join(root, 'docs'));
  const files = {
    'package.json': JSON.stringify({ repository: { url: 'https://github.com/just-every/run-happytohelp' } }),
    'docs/site.json': site([home, { slug: 'guide', source: 'docs/GUIDE.md', label: 'Guide' }]),
    'README.md': '# Fixture\n\nRead [the second part](docs/GUIDE.md#second).\n',
    'docs/GUIDE.md': '# Guide\n\n## Second\n',
  };
  for (const [path, text] of Object.entries(files)) await writeFile(join(root, path), text);
  // No WebSocket server: the plugin's full-reload goes nowhere here, and no fixed HMR port is taken.
  // Poll through Vite's real watcher on every host: native filesystem streams can omit events for a new
  // fixture tree even after 'ready'. A short interval keeps real edit/add/remove delivery inside the assertions' bound.
  const server = await createServer({
    root, configFile: false, logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: { usePolling: true, interval: 100 } },
    plugins: [docsSite()],
  });
  // What each environment is sent: the browser's full reload when the docs change, an error if the plugin throws.
  const sent = [];
  for (const environment of Object.values(server.environments)) {
    const send = environment.hot.send.bind(environment.hot);
    environment.hot.send = (payload, ...rest) => { sent.push({ environment: environment.name, ...payload }); return send(payload, ...rest); };
  }
  const errors = () => sent.filter(payload => payload.type === 'error');
  const reloaded = () => [...new Set(sent.filter(payload => payload.type === 'full-reload').map(payload => payload.environment))];
  // Observe real filesystem events before checking the plugin: a fixed sleep can read the previous manifest
  // or remove a folder before the watcher has seen its files.
  // The public-door assertions still have their own 5 s bound; the test timeout bounds filesystem event delivery.
  const observe = async (event, path) => {
    for await (const [file] of on(server.watcher, event, { signal })) if (file === join(root, path)) return;
  };
  try {
    if (!server.watcher._readyEmitted) await once(server.watcher, 'ready', { signal });
    const page = async slug => (await server.ssrLoadModule(`virtual:happytohelp-docs/page/${slug}`)).default;
    const index = () => server.ssrLoadModule('virtual:happytohelp-docs');
    const { loadDocsPage } = await server.ssrLoadModule(loaderPath);
    assert.match((await page('guide')).html, /<h2 id="second">Second<\/h2>/);
    assert.match((await page('index')).html, /<a href="\/docs\/guide#second">the second part<\/a>/);
    const first = await loadDocsPage('guide');
    assert.match(first.page.html, /<h2 id="second">Second<\/h2>/);

    const guideChanged = observe('change', 'docs/GUIDE.md');
    await writeFile(join(root, 'docs/GUIDE.md'), '# Guide\n\n## Second\n\n## Third\n');
    await guideChanged;
    await until(async () => assert.match((await page('guide')).html, /<h2 id="third">Third<\/h2>/), 'an edited page is served');
    const edited = await loadDocsPage('guide');
    assert.match(edited.page.html, /<h2 id="third">Third<\/h2>/);
    // A page served before the edit can tell: src/ui/docs/useCurrentDocs.ts reloads it.
    assert.ok(edited.version > first.version, 'the docs version moves on with the edit');
    assert.equal((await index()).version, edited.version);

    const readmeBroken = observe('change', 'README.md');
    await writeFile(join(root, 'README.md'), '# Fixture\n\nRead [the missing part](docs/MISSING.md).\n');
    await readmeBroken;
    await until(async () => {
      const error = await page('index').then(() => null, rejection => rejection);
      assert.ok(error, 'a broken link fails the load');
      assert.match(error.message, /README\.md: docs\/MISSING\.md/);
    }, 'a broken link is reported');
    // The index module still loads, so the routes that do not show docs keep working; the docs routes throw its problem.
    const broken = await index();
    assert.match(broken.problem, /README\.md: docs\/MISSING\.md/);
    assert.deepEqual(Object.keys(broken.pages), ['', 'guide']);
    await assert.rejects(loadDocsPage('guide'), /README\.md: docs\/MISSING\.md \(docs\/MISSING\.md does not exist\)/);

    const thirdAdded = [observe('add', 'docs/THIRD.md'), observe('change', 'docs/site.json')];
    await writeFile(join(root, 'README.md'), files['README.md']);
    await writeFile(join(root, 'docs/THIRD.md'), '# Third page\n');
    await writeFile(join(root, 'docs/site.json'), site([home, { slug: 'guide', source: 'docs/GUIDE.md', label: 'Guide' }, { slug: 'third', source: 'docs/THIRD.md', label: 'Third' }]));
    await Promise.all(thirdAdded);
    await until(async () => {
      const { sections, repository } = await loadDocsPage('third');
      assert.deepEqual(sections[0].pages.map(entry => entry.href), ['/docs', '/docs/guide', '/docs/third']);
      assert.deepEqual(repository, { url: 'https://github.com/just-every/run-happytohelp', branch: 'main' });
    }, 'a page added to docs/site.json is listed');
    assert.equal((await page('third')).title, 'Third page');
    assert.equal((await index()).problem, null);

    // A folder removed with its files, as tests/delivery-base.mjs does in the repository root: nothing to do with the docs.
    sent.length = 0;
    const scratchAdded = [observe('add', '.scratch/inner/notes.md'), observe('add', '.scratch/inner/data.txt')];
    await mkdir(join(root, '.scratch/inner'), { recursive: true });
    await writeFile(join(root, '.scratch/inner/notes.md'), '# Scratch\n');
    await writeFile(join(root, '.scratch/inner/data.txt'), 'scratch\n');
    await Promise.all(scratchAdded);
    await until(async () => assert.deepEqual(reloaded(), ['client']), 'the scratch Markdown addition finishes reloading');
    sent.length = 0;
    const scratchRemoved = [observe('unlink', '.scratch/inner/notes.md'), observe('unlink', '.scratch/inner/data.txt'), observe('unlinkDir', '.scratch')];
    await rm(join(root, '.scratch'), { recursive: true, force: true });
    await Promise.all(scratchRemoved);
    await until(async () => assert.deepEqual(reloaded(), ['client']), 'the scratch Markdown removal finishes reloading');
    assert.deepEqual(errors(), [], 'removing a folder sends no error');

    // A published page whose Markdown is removed with its folder is dropped, not served from the cache.
    sent.length = 0;
    const subAdded = [observe('add', 'docs/sub/PAGE.md'), observe('change', 'docs/site.json')];
    await mkdir(join(root, 'docs/sub'));
    await writeFile(join(root, 'docs/sub/PAGE.md'), '# Sub page\n\n## Inside\n');
    await writeFile(join(root, 'docs/site.json'), site([home, { slug: 'sub', source: 'docs/sub/PAGE.md', label: 'Sub' }]));
    await Promise.all(subAdded);
    await until(async () => assert.match((await loadDocsPage('sub')).page.html, /<h2 id="inside">Inside<\/h2>/), 'the added docs folder is served');
    // Drain the addition's browser reload before observing the removal; the plugin's cache holds the page.
    await until(async () => assert.deepEqual(reloaded(), ['client']), 'the added docs folder finishes reloading');
    sent.length = 0;
    const subRemoved = [observe('unlink', 'docs/sub/PAGE.md'), observe('unlinkDir', 'docs/sub')];
    await rm(join(root, 'docs/sub'), { recursive: true, force: true });
    await Promise.all(subRemoved);
    await until(async () => assert.deepEqual(reloaded(), ['client']), 'the browser reloads when a docs folder is removed');
    assert.deepEqual(errors(), [], 'removing a docs folder sends no error');
    assert.match((await index()).problem ?? '', /docs\/sub\/PAGE\.md" does not exist/);
    await assert.rejects(loadDocsPage('sub'), /docs\/sub\/PAGE\.md" does not exist/, 'the removed page no longer loads');
    await assert.rejects(page('sub'), /docs\/sub\/PAGE\.md" does not exist/);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
