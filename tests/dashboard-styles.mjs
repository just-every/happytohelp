import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const styles = join(root, 'src/ui/dashboard/styles');
const require = createRequire(join(root, 'package.json'));
const iconDir = join(dirname(require.resolve('feather-icons/package.json')), 'dist/icons');
const packageIcons = readdirSync(iconDir).filter(name => name.endsWith('.svg')).map(name => name.slice(0, -4)).sort();

const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
  if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

test('the icon list is exactly the pinned feather-icons set', () => {
  const source = readFileSync(join(styles, 'foundation/_feather-icon-names.scss'), 'utf8');
  const listed = [...source.matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(listed, packageIcons);
});

test('every static fe-* icon class in the UI names a Feather icon', () => {
  const known = new Set(packageIcons);
  const used = new Map();
  for (const file of walk(join(root, 'src/ui')).filter(path => /\.(jsx?|tsx?)$/.test(path))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/(?<![\w-])fe-([a-z0-9]+(?:-[a-z0-9]+)*)(?![\w$-])/g)) {
      used.set(match[1], relative(root, file));
    }
  }
  assert.ok(used.size > 20, 'the dashboard references its line icons');
  const unknown = [...used].filter(([name]) => !known.has(name));
  assert.deepEqual(unknown, [], 'icon classes without a Feather icon');
});

test('the dashboard stylesheet compiles from first-party partials and Bootstrap only', () => {
  const sass = require('sass');
  const imported = [];
  const result = sass.compile(join(styles, 'dashboard.scss'), {
    loadPaths: [join(root, 'node_modules')],
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls', 'if-function'],
    logger: {warn() {}},
  });
  for (const url of result.loadedUrls) imported.push(relative(root, fileURLToPath(url)));
  const outside = imported.filter(path => !path.startsWith('src/ui/dashboard/styles/') && !/^node_modules\/(?:bootstrap|highlight\.js)\//.test(path));
  assert.deepEqual(outside, [], 'stylesheet inputs outside the dashboard styles, Bootstrap and highlight.js');
  const css = result.css;
  assert.doesNotMatch(css, /font-family:\s*["']?Feather/i);
  assert.doesNotMatch(css, /\/img\/masks\/|\/fonts\/feather\//);
  // Icon masks point at the package's SVGs, relative to foundation/_icons.scss.
  const star = css.match(/\.fe-star\s*\{\s*--fe-icon:\s*url\("?([^")]+)"?\)/);
  assert.ok(star, '.fe-star icon rule');
  assert.ok(existsSync(resolve(styles, 'foundation', star[1])), `icon path resolves: ${star[1]}`);
});

test('no purchased-theme source, font or mask remains in the product tree', () => {
  for (const path of ['src/ui/dashboard/styles/theme', 'public/img/masks', 'public/fonts/feather']) {
    assert.equal(existsSync(join(root, path)), false, path);
  }
});

test('the removal record accounts for every removed purchased-theme input', () => {
  const record = JSON.parse(readFileSync(join(root, 'src/ui/dashboard/asset-provenance.json'), 'utf8'));
  assert.ok(record.removed.length >= 60);
  for (const entry of record.removed) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, entry.source);
    assert.ok(entry.reason, entry.source);
    assert.equal(existsSync(join(root, entry.source)), false, `${entry.source} is recorded as removed`);
  }
  for (const path of ['public/img/masks/avatar-status.svg', 'public/fonts/feather/fonts/Feather.woff', 'src/ui/dashboard/styles/theme/_variables.scss']) {
    assert.ok(record.removed.some(entry => entry.source === path), path);
  }
});
