import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
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
  assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(release.date).toISOString().slice(0, 10), release.date);
  assert.equal(typeof release.breaking, 'boolean');
  nonempty(release.agentUpdateInstructions);
  assert.ok(release.contractChanges && typeof release.contractChanges === 'object' && !Array.isArray(release.contractChanges));
  // Published extension-point meanings and older clauses are retained; 0.4 adds
  // explicit clauses for the reviewed new workflows and the dated identity decision.
  const contract = await readFile(new URL('../CONTRACT.md', import.meta.url), 'utf8');
  for (const [id, change] of Object.entries(release.contractChanges)) {
    assert.match(id, /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9]{3}$/);
    assert.ok(contract.includes('**' + id + ' —'), 'actual stable contract clause: ' + id);
    assert.equal(change.change, 'added'); nonempty(change.summary);
    assert.deepEqual(Object.keys(change).sort(), (change.migrationIds ? ['change', 'summary', 'migrationIds'] : ['change', 'summary']).sort());
    for (const migrationId of change.migrationIds || []) assert.ok(release.migrations.some(m => m.id === migrationId));
  }
  assert.deepEqual(release.extensionPointChanges, []);
  assert.ok(Object.values(seed.extensionPoints).every(points => Array.isArray(points) && points.length === 0));
  assert.ok(Array.isArray(release.proseChanges));
  for (const change of release.proseChanges) {
    assert.match(change.date,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(change.date).toISOString().slice(0,10),change.date);
    assert.ok(change.date<=release.date,'Prose changes are dated no later than the prepared release');
    for(const field of ['document','summary','now','ownerAction'])nonempty(change[field]);
    assert.ok(['added','changed'].includes(change.change));
    if(change.change==='changed')nonempty(change.was);
    const document=await readFile(new URL('../'+change.document,import.meta.url),'utf8');
    assert.ok(document.trim());
    if(change.section)assert.ok(document.split('\n').some(line=>/^#{1,6} /.test(line)&&line.replace(/^#{1,6} /,'')===change.section));
  }
  assert.ok(Array.isArray(release.migrations));
  for (const migration of release.migrations) {
    assert.deepEqual(Object.keys(migration).sort(), ['buyerSteps', 'id']); nonempty(migration.buyerSteps);
    assert.ok((await readFile(new URL('../migrations/' + migration.id, import.meta.url), 'utf8')).trim());
  }
  // Preserve every predecessor SQL property: the already-applied identity
  // migration remains immutable and its owner obligations are still recorded.
  const sql = await readFile(new URL('../migrations/0109_magic_signins.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE magic_signins\(/);
  assert.match(sql, /CREATE INDEX magic_signins_expiry ON magic_signins\(expires_at\)/);
  assert.doesNotMatch(sql, /\b(?:ALTER|DROP|UPDATE|DELETE)\b/i);
  for (const pattern of [/before starting the updated Worker/, /magic_signins table/, /magic_signins_expiry index/, /backup and restore/, /expiry and consumption state/, /does not rewrite existing rows, create accounts, send email or configure a provider/, /APP_ORIGIN/, /password sign-in remains available/]) {
    assert.match(release.agentUpdateInstructions, pattern);
  }
  assert.equal(release.breaking, release.migrations.length > 0, 'Base marks required pre-runtime owner migration steps as breaking');
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
  assert.equal(packaging.project.sourceRepository, 'just-every/run-happytohelp');
  assert.equal(generated.projectId, project.projectId);
  assert.equal(generated.sourceRepository, project.sourceRepository);
  assert.equal(generated.sourceRepository, 'https://github.com/' + packaging.project.sourceRepository);
  assert.equal(packagingConfig({...packaging,project:{...packaging.project,sourceRepository:'https://github.com/just-every/run-happytohelp'}}).project.sourceRepository,'https://github.com/just-every/run-happytohelp');
  for (const sourceRepository of ['https://gıthub.com/just-every/run-happytohelp','https://github.com/just-every/run-happytohelp?token=invalid','https://github.com/just-every/run-happytohelp/extra']) assert.throws(()=>packagingConfig({...packaging,project:{...packaging.project,sourceRepository}}),/sourceRepository/);
  assert.equal(generated.deployment.artifactFile, project.deployment.artifactFile);
  assert.equal(typeof release.publicReleaseNotes, 'string');
  assert.ok(release.publicReleaseNotes.trim());
  assert.equal(project.sourceRepository, 'https://github.com/just-every/run-happytohelp');
  for (const file of ['capabilities.mjs', 'mcp.mjs', 'providers/codex-app-server.mjs']) {
    const source = await readFile(new URL('../local-agent/lib/' + file, import.meta.url), 'utf8');
    assert.match(source, /version: AGENT_VERSION/);
    assert.doesNotMatch(source, /version: ['"]0\.2/);
  }
});

test('public Base selection keeps licensed local source and only selected comparison archives', async () => {
  // Read through the retained authoring validator, rather than accepting a
  // publication-only interpretation of the recipe.
  const recipe = manifest(fileURLToPath(new URL('../', import.meta.url)));
  assert.equal(recipe.parent, undefined);
  for (const id of ['runeditrun/base', 'runeditrun/onboarding', 'runeditrun/sendgrid-email', 'runeditrun/import-kit', 'runeditrun/mail']) {
    const component = recipe.components.find(component => component.id === id);
    assert.ok(component, id + ': original capability identity retained');
    assert.equal(component.source.kind, 'local');
    assert.equal(component.source.origin.repository, recipe.components.find(c=>c.role==='foundation').source.origin.repository);
    assert.ok(component.source.origin.paths.length > 0);
    assert.ok(component.source.mappings.length > 0);
  }
  assert.equal(recipe.toolchain.id, 'runeditrun/edition-authoring');

  const selected = new Set();
  const references = recipe.components.map(component => component.source.kind === 'git' ? component.source : component.source.origin).filter(Boolean);
  if (recipe.parent) references.push({...recipe.parent, excludeSnapshots: true});
  for (const reference of references) {
    assert.equal(reference.repository, recipe.components.find(c=>c.role==='foundation').source.origin.repository, 'one selected maintained origin');
  }
  for (const component of recipe.components.filter(c => c.source.origin)) {
    for (const mapping of component.source.mappings) {
      assert.ok(component.source.paths.some(path => mapping.path === path || mapping.path.startsWith(path + '/')));
      assert.ok(component.source.origin.paths.some(path => mapping.originPath === path || mapping.originPath.startsWith(path + '/') || path.startsWith(mapping.originPath + '/')));
    }
  }
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
    for (const component of recipe.components.filter(component => component.source.origin && canonicalJson(component.source.origin.paths) === canonicalJson(archive.origin.paths))) {
      for (const mapping of component.source.mappings) {
        const files = Object.entries(archive.files).filter(([path]) => path === mapping.originPath || path.startsWith(mapping.originPath + '/'));
        assert.ok(files.length, 'mapped Base source exists');
        for (const [path, entry] of files) {
          const localPath = mapping.path + path.slice(mapping.originPath.length);
          const originBytes = Buffer.from(entry.data, 'base64');
          let expected = originBytes;
          if (localPath === 'scripts/delivery/base/setup-manifest.mjs') {
            assert.equal(path, 'modules/delivery-producer/setup-manifest.mjs');
            // The immutable official exporter rewrites exactly these two references.
            // Assert its complete rewrite block too, so a future export change is reviewed.
            const exporter = Buffer.from(archive.files['modules/delivery-producer/export.mjs'].data, 'base64').toString('utf8');
            assert.ok(exporter.includes(`if (name === 'setup-manifest.mjs') {
        const portable = bytes.toString('utf8')
          .replace("from '../../schema/setup-validation.mjs'", "from './schema/setup-validation.mjs'")
          .replace("new URL('../../schema/SETUP.schema.json', import.meta.url)", "new URL('./schema/SETUP.schema.json', import.meta.url)");
        bytes = Buffer.from(portable, 'utf8');
      }`), 'official portable-export transformation retained');
            const source = originBytes.toString('utf8');
            for (const reference of ["from '../../schema/setup-validation.mjs'", "new URL('../../schema/SETUP.schema.json', import.meta.url)"]) {
              assert.equal(source.split(reference).length - 1, 1, 'exactly one official source reference: ' + reference);
            }
            expected = Buffer.from(source
              .replace("from '../../schema/setup-validation.mjs'", "from './schema/setup-validation.mjs'")
              .replace("new URL('../../schema/SETUP.schema.json', import.meta.url)", "new URL('./schema/SETUP.schema.json', import.meta.url)"), 'utf8');
          }
          assert.deepEqual(await readFile(new URL('../' + localPath, import.meta.url)), expected, 'exact official Base source/export: ' + localPath);
        }
      }
    }
    selected.add(key);
    for (const dependency of archive.dependencies || []) queue.push(dependency.key);
  }
  const archives = await readdir(new URL('../.edition/sources/', import.meta.url)).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  assert.deepEqual(archives.sort(), [...selected].map(key => key + '.json').sort(), 'only selected immutable comparison archives may ship');
  const license = await readFile(new URL('../docs/licenses/base-MIT.txt', import.meta.url), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Run Edit Run/);
});

test('native MCP initialization reports the packaged connector version without executing work', async () => {
  let response = '';
  await serveMcp({}, {
    input: Readable.from([JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize'}) + '\n']),
    output: new Writable({write(chunk, encoding, done) { response += chunk; done(); }}),
  });
  assert.equal(JSON.parse(response).result.serverInfo.version, AGENT_VERSION);
});
