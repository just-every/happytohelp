import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// package.json "repository" is the one canonical public repository value.
// Files that cannot import it must carry exactly that value, so renaming the
// repository is a single package.json change plus a mechanical substitution
// that this test confirms.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const canonical = pkg.repository?.url;

test('package.json declares the canonical public repository as a GitHub web URL', () => {
  assert.equal(pkg.repository.type, 'git');
  assert.match(canonical, /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  assert.ok(!canonical.endsWith('.git'), 'use the web URL; clone commands append nothing');
  assert.equal(pkg.license, 'MIT');
});

test('LICENSE is MIT with the current copyright holder', async () => {
  const license = await read('LICENSE');
  assert.match(license, /^MIT License\n/);
  assert.match(license, /^Copyright \(c\) 2026 Peter Industries Pty Ltd as trustee for Peter Family Trust, trading as JustEvery$/m);
});

test('descriptors agree with the canonical repository and release version', async () => {
  const seed = JSON.parse(await read('seed.json'));
  assert.equal(seed.repository, canonical);
  assert.equal(seed.version, pkg.version);
  assert.equal(seed.license, 'MIT');
  const descriptor = JSON.parse(await read('rer-project.json'));
  assert.equal(`https://github.com/${descriptor.sourceRepository}`, canonical);
  assert.equal(descriptor.license, 'MIT');
  const managementProfile = JSON.parse(await read('management/integration/profile.json'));
  assert.equal(`https://github.com/${managementProfile.sourceRepository}`, canonical);
  const managementRecipe = JSON.parse(await read('management/integration/recipe.json'));
  assert.equal(`https://github.com/${managementRecipe.source}`, canonical);
  const changelog = await read('CHANGELOG.md');
  assert.match(changelog, new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')}\\b`, 'm'));
});

test('homepage derives its source and documentation links from package.json', async () => {
  const module = await read('src/ui/homepage/repository.ts');
  assert.match(module, /import \{ repository \} from '\.\.\/\.\.\/\.\.\/package\.json'/);
  assert.match(module, /sourceUrl = repository\.url/);
  for (const file of ['src/ui/homepage/repository.ts', 'src/ui/homepage/VillageHero.tsx', 'src/ui/homepage/VillageWorkshops.tsx', 'tests/homepage-browser.mjs']) {
    assert.ok(!/https:\/\/github\.com\/[^'"`\s]+/.test(await read(file)), `${file} must not hard-code a repository URL`);
  }
});

test('files that cannot import package.json carry exactly the canonical repository', async () => {
  const literalHolders = [
    'README.md',
    'SECURITY.md',
    'seed.json',
    'src/modules/widget/js/context/AppContext.jsx',
    'src/modules/ai-support/vendor/ensemble/model_providers/openrouter.js',
  ];
  for (const file of literalHolders) assert.ok((await read(file)).includes(canonical), `${file} must reference ${canonical}`);
});
