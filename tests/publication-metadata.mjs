import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Readable, Writable} from 'node:stream';
import {serveMcp} from '../local-agent/lib/mcp.mjs';
import {AGENT_VERSION} from '../local-agent/lib/version.mjs';
import {packagingConfig} from '../scripts/delivery/base/package.mjs';
import {manifest} from '../scripts/edition-authoring/manifest.mjs';
import {hash, json as canonicalJson, digest} from '../scripts/edition-authoring/files.mjs';
import {fileURLToPath} from 'node:url';
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('release authoring source excludes private verification and preparation receipts', async () => {
  const sourceEntries = await readdir(new URL('../', import.meta.url));
  assert.ok(!sourceEntries.includes('verification'),
    'private verification and prepared release receipts belong outside the published source');
});

test('release metadata carries the Base release contract and actionable migration custody', async () => {
  const [release, seed] = await Promise.all(['../RELEASE.json', '../seed.json'].map(json));
  // Base schema/RELEASE.schema.json requires these fields even though the
  // delivery producer accepts a smaller publication-notes input.
  const required = ['version', 'contractChanges', 'extensionPointChanges', 'migrations', 'breaking', 'agentUpdateInstructions'];
  for (const field of required) assert.ok(Object.hasOwn(release, field), 'required release field: ' + field);
  const allowed = new Set([...required, 'previousVersion', 'date', 'proseChanges', 'publicReleaseNotes']);
  for (const field of Object.keys(release)) assert.ok(allowed.has(field), 'known release field: ' + field);
  const nonempty = value => { assert.equal(typeof value, 'string'); assert.ok(value.trim()); };
  const semver = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
  assert.match(release.version, semver);
  assert.match(release.previousVersion, semver);
  assert.equal(release.previousVersion, '0.2.2');
  assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(release.date).toISOString().slice(0, 10), release.date);
  assert.equal(typeof release.breaking, 'boolean');
  nonempty(release.agentUpdateInstructions);
  assert.ok(release.contractChanges && typeof release.contractChanges === 'object' && !Array.isArray(release.contractChanges));
  // The 0.2.2 contract and published extension-point lists retain their meaning.
  assert.deepEqual(release.contractChanges, {});
  assert.deepEqual(release.extensionPointChanges, []);
  assert.ok(Object.values(seed.extensionPoints).every(points => Array.isArray(points) && points.length === 0));
  assert.ok(Array.isArray(release.proseChanges));
  assert.equal(release.proseChanges.length, 2);
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const change of release.proseChanges) {
    assert.equal(change.document, 'README.md');
    assert.equal(change.change, 'changed');
    assert.equal(change.date, release.date);
    for (const field of ['section', 'summary', 'was', 'now', 'ownerAction']) nonempty(change[field]);
    assert.ok(readme.includes('## ' + change.section));
    assert.deepEqual(Object.keys(change).sort(), ['document', 'section', 'change', 'date', 'summary', 'was', 'now', 'ownerAction'].sort());
  }
  assert.ok(Array.isArray(release.migrations));
  assert.deepEqual(release.migrations.map(migration => migration.id), ['0109_magic_signins.sql']);
  const [migration] = release.migrations;
  assert.deepEqual(Object.keys(migration).sort(), ['buyerSteps', 'id']);
  nonempty(migration.buyerSteps);
  const sql = await readFile(new URL('../migrations/' + migration.id, import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE magic_signins\(/);
  assert.match(sql, /CREATE INDEX magic_signins_expiry ON magic_signins\(expires_at\)/);
  assert.doesNotMatch(sql, /\b(?:ALTER|DROP|UPDATE|DELETE)\b/i);
  for (const pattern of [/before starting the updated Worker/, /magic_signins table/, /magic_signins_expiry index/, /backup and restore/, /expiry and consumption state/, /does not rewrite existing rows, create accounts, send email or configure a provider/, /APP_ORIGIN/, /password sign-in remains available/]) {
    assert.match(migration.buyerSteps, pattern);
  }
  assert.equal(release.breaking, true, 'Base marks required pre-runtime owner migration steps as breaking');
  for (const pattern of [/0109_magic_signins\.sql before the updated Worker/, /explicit operator Send/, /schema-2/, /raw payload sidecars/, /accessibility checker HOLD/]) {
    assert.match(release.agentUpdateInstructions, pattern);
  }
});

test('release, packaging and all local connector protocol identities share the public version and edition', async () => {
  const [pkg, seed, release, agent, edition, project, packaging] = await Promise.all([
    '../package.json', '../seed.json', '../RELEASE.json', '../local-agent/package.json', '../edition.json', '../rer-project.json', '../scripts/delivery/base/packaging.json',
  ].map(json));
  for (const manifest of [seed, release, agent]) assert.equal(manifest.version, pkg.version);
  assert.equal(AGENT_VERSION, pkg.version);
  assert.equal(edition.components.filter(component => component.role === 'edition').length, 1);
  assert.equal(packaging.edition.componentId, edition.id);
  assert.equal(packaging.project.projectId, project.projectId);
  const generated = packagingConfig(packaging).project;
  assert.equal(packaging.project.sourceRepository, 'just-every/happytohelp');
  assert.equal(generated.projectId, project.projectId);
  assert.equal(generated.sourceRepository, packaging.project.sourceRepository);
  assert.equal('https://github.com/' + generated.sourceRepository, project.sourceRepository);
  assert.equal(generated.deployment.artifactFile, project.deployment.artifactFile);
  assert.equal(typeof release.publicReleaseNotes, 'string');
  assert.ok(release.publicReleaseNotes.trim());
  assert.equal(project.sourceRepository, 'https://github.com/just-every/happytohelp');
  for (const file of ['capabilities.mjs', 'mcp.mjs', 'providers/codex-app-server.mjs']) {
    const source = await readFile(new URL('../local-agent/lib/' + file, import.meta.url), 'utf8');
    assert.match(source, /version: AGENT_VERSION/);
    assert.doesNotMatch(source, /version: ['"]0\.2/);
  }
});

test('public Base selection keeps licensed local source without private comparison archives', async () => {
  // Read through the retained authoring validator, rather than accepting a
  // publication-only interpretation of the recipe.
  const recipe = manifest(fileURLToPath(new URL('../', import.meta.url)));
  assert.equal(recipe.parent, undefined);
  for (const id of ['runeditrun/base', 'runeditrun/onboarding', 'runeditrun/sendgrid-email']) {
    const component = recipe.components.find(component => component.id === id);
    assert.ok(component, id + ': original capability identity retained');
    assert.equal(component.source.kind, 'local');
    assert.equal(component.source.origin, undefined);
    assert.equal(component.source.mappings, undefined);
  }
  assert.deepEqual(recipe.components.find(component => component.id === 'runeditrun/base').source.paths,
    ['src/base', 'scripts/edition-authoring', 'scripts/operations.mjs']);
  assert.equal(recipe.toolchain.id, 'runeditrun/edition-authoring');
  assert.equal(recipe.toolchain.version, '1.1.0');

  const selected = new Set();
  const references = recipe.components.map(component => component.source.kind === 'git' ? component.source : component.source.origin).filter(Boolean);
  if (recipe.parent) references.push({...recipe.parent, excludeSnapshots: true});
  const queue = references.map(reference => hash(canonicalJson({
    repository: reference.repository, revision: reference.revision,
    path: reference.path || '.', paths: reference.paths || null,
    excludeSnapshots: !!reference.excludeSnapshots,
  })));
  while (queue.length) {
    const key = queue.pop();
    if (selected.has(key)) continue;
    const archive = await json('../.edition/sources/' + key + '.json');
    assert.equal(archive.key, key);
    assert.equal(hash(canonicalJson(archive.origin)), key);
    assert.equal(digest(archive.files), archive.digest);
    selected.add(key);
    for (const dependency of archive.dependencies || []) queue.push(dependency.key);
  }
  const archives = await readdir(new URL('../.edition/sources/', import.meta.url)).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  assert.deepEqual(archives.sort(), [...selected].map(key => key + '.json').sort(), 'only selected immutable comparison archives may ship');
  const attribution = await readFile(new URL('../docs/SOURCE-PROVENANCE.md', import.meta.url), 'utf8');
  for (const revision of ['d840a75b4c41ddc1feae99695d6632c8b0a451d2', 'ac90a05c0549e1f8a65a94f64ac6e2d629f4d5e1', '390328736c8dae82f87c86e5af4c17cca6bb9c00', 'd1343b638afd254679bc2b35819fc1d268bb6cc7']) {
    assert.ok(attribution.includes(revision), 'historical donor attribution retained: ' + revision);
  }
  const license = await readFile(new URL('../docs/licenses/base-MIT.txt', import.meta.url), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Run Edit Run/);
});

const avatarImageDigests = {
  "female-1-ai-large-color.png": "35e60e4fa276439a590c8ea26daba6639dbfa832c8c69cb4653ff8cc7e932365",
  "female-1-ai.png": "fb8457649e80afd98fde5972f02891a54b0dd00a141da2780fc49f914036184e",
  "female-1-large-color.png": "77675dd0b71398226542653c90f57f0109455a2f9faa02351490d87660660101",
  "female-1-large.png": "5081ddb8e69267f1694ae554caff49bbe6c6e9bb6330e12942f1c40d6ea6e5b6",
  "female-1.png": "63238616ba342f1f76d7b60dcc69a44062645a87a86392d4df504996023152fd",
  "female-2-ai-large-color.png": "50c357025f0c3a8ab5593559d97fb0bef3d591116fc3f40526f262573ddede19",
  "female-2-ai.png": "e9af7ae0a9641311bc6d3f18707075bd1fa4f652ffee6e4e6c8ce6447b6dae8d",
  "female-2-large-color.png": "3c349415891efd6b41218063b479548224c7d65c8b7b1f2dd78e3536e05fb61d",
  "female-2-large.png": "10a516f17dd90593dd68dd31881c24f6a6833f9c4bd59e860bb4def7cf731a36",
  "female-2.png": "f976881ead36060aee8a022cd91070c9c9204a7fda285e071ceca02a8e227a64",
  "male-1-ai-large-color.png": "8fd6d5741c23a4ed47eef0c82bd9ed7d5aaf53093670d338e2c769d64354d667",
  "male-1-ai.png": "782da3a0ee480a9954dc22b7eab44a1c0f1a6a8d425b648793f5bc9a3415e658",
  "male-1-large-color.png": "6697df911931500fb1504aa4982b6b9a69ba8735e51273d38d6a0fa6116cd6ba",
  "male-1-large.png": "5341ad8ec681c2f0945e58cd2d7ff8499b3f224baeb0df596bbc617c71cf540e",
  "male-1.png": "1c25d608947dce60a3fc9ebfcedca0be735a2ff55f37bbba151addb51e0c77ba",
  "male-2-ai-large-color.png": "61b44ec8ccd688727cfa2dbaf4d3f41235d95f799d28710b83328d2aae10fa33",
  "male-2-ai.png": "f0b827b8333d9a6404416b43f9f3be00de5ea447c336f3d9489ce204ad9c0aff",
  "male-2-large-color.png": "47ce5bc122fd137c0eb594393698420efc9903d459e4f4dd9235564bcc850eca",
  "male-2-large.png": "848a9cc5e7f1862c5fdea8d2834027340e790152fd480978403f83f0170de8e0",
  "male-2.png": "fc1eba5687aaa1eeab57ecb07f908ce00493d56935843922803de013c8e74f60"
};
test('published avatars preserve compressed pixels and contain no text or C2PA identity metadata', async () => {
  for (const [name, digest] of Object.entries(avatarImageDigests)) {
    const bytes = await readFile(new URL('../src/modules/widget/img/avatars/' + name, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
    const image = createHash('sha256');
    let offset = 8;
    while (offset < bytes.length) {
      const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8);
      assert.ok(offset + length + 12 <= bytes.length, name + ': complete PNG chunk');
      assert.ok(!['tEXt', 'iTXt', 'zTXt', 'caBX'].includes(kind), name + ': no text or C2PA metadata');
      if (kind === 'IDAT') image.update(bytes.subarray(offset + 8, offset + 8 + length));
      else assert.ok(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(bytes.toString('latin1', offset + 8, offset + 8 + length)), name + ': no email in non-pixel chunks');
      offset += length + 12;
    }
    assert.equal(image.digest('hex'), digest, name + ': original pixel bytes');
  }
});

test('native MCP initialization reports the packaged connector version without executing work', async () => {
  let response = '';
  await serveMcp({}, {
    input: Readable.from([JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize'}) + '\n']),
    output: new Writable({write(chunk, encoding, done) { response += chunk; done(); }}),
  });
  assert.equal(JSON.parse(response).result.serverInfo.version, AGENT_VERSION);
});


test('reviewed avatar email findings bind unchanged PNGs with no textual chunks', async () => {
  const reviewed = await json('../.publish-check/reviewed.json');
  const reason = 'email-shaped bytes inside compressed pixel data; the PNG has no text chunk';
  for (const [name, blob] of [
    ['female-2-large.png', '26750379df4697291bd5f968712bd94f428f044f'],
    ['male-2-large.png', '08d7e02bd8109a87c23b75811c78eeab78e8e89d'],
  ]) {
    const path = 'src/modules/widget/img/avatars/' + name;
    const matches = reviewed.findings.filter(finding => finding.rule === 'hygiene.email' && finding.path === path);
    assert.equal(matches.length, 1, path + ' has one exact review');
    const review = matches[0];
    assert.equal(review.blob, blob);
    assert.equal(review.reason, reason);
    assert.ok(review.reviewer.trim());
    assert.equal(new Date(review.date).toISOString().slice(0, 10), review.date);
    const bytes = await readFile(new URL('../' + path, import.meta.url));
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), blob);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const chunks = [];
    let offset = 8;
    while (offset < bytes.length) {
      assert.ok(offset + 12 <= bytes.length, 'complete PNG chunk header and CRC');
      const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
      assert.ok(offset + 12 + length <= bytes.length, 'chunk payload stays within PNG');
      chunks.push(type);
      assert.ok(!['tEXt', 'zTXt', 'iTXt'].includes(type), path + ' contains no text chunk');
      offset += 12 + length;
    }
    assert.equal(offset, bytes.length);
    assert.equal(chunks[0], 'IHDR');
    assert.ok(chunks.includes('IDAT'));
    assert.equal(chunks.at(-1), 'IEND');
  }
});
