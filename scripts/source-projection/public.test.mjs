import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {snapshot} from '../edition-authoring/sources.mjs';
import {comparisonIdentities, validateProjection} from '../edition-authoring/projections.mjs';
import {compareFiles} from '../edition-authoring/updates.mjs';
import {hash, json, digest} from '../edition-authoring/files.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(path.join(root, 'edition.json')));
const mappings = JSON.parse(fs.readFileSync(new URL('./projections.json', import.meta.url)));
const refs = [recipe.parent, ...recipe.components.map(c => c.source.origin).filter(Boolean)];
test('all selected archives are distinct, pinned, offline public projections', () => {
  assert.equal(refs.length, 4);
  assert.equal(mappings.length, 4);
  assert.deepEqual(fs.readdirSync(path.join(root, '.edition/sources')).sort(), mappings.map(m => m.projection.key + '.json').sort());
  for (const ref of refs) {
    const saved = snapshot(root, {...ref, excludeSnapshots: ref === recipe.parent});
    const mapping = mappings.find(m => m.projection.key === saved.key);
    assert.ok(mapping);
    assert.equal(saved.origin.original.sha256, mapping.original.sha256);
    assert.notEqual(saved.key, mapping.original.key);
    assert.equal(saved.digest, mapping.projection.digest);
    assert.equal(Object.keys(saved.files).length, mapping.original.members);
    assert.equal(fs.existsSync(path.join(root, '.edition/sources', mapping.original.key + '.json')), false);
    for (const file of Object.values(saved.files)) {
      const text = Buffer.from(file.data, 'base64').toString('utf8');
      assert.doesNotMatch(text, /github\.com\/(?:runeditrun|zemaj)\//);
      for (const email of text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g) || []) assert.ok(email.endsWith('@example.test'));
    }
  }
});
test('missing, tampered and wrong-selection projections fail without acquisition', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'projection-negative-'));
  try {
    const ref = refs[1], saved = snapshot(root, ref);
    assert.throws(() => snapshot(temp, ref), /ENOENT/);
    const filename = path.join(temp, '.edition/sources', saved.key + '.json');
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, json({...saved, changes: []}));
    assert.throws(() => snapshot(temp, ref), /SHA-256/);
    fs.writeFileSync(filename, json(saved));
    assert.throws(() => snapshot(temp, {...ref, path: 'another'}), /selection mismatch/);
    const mutated = structuredClone(saved);
    const member = Object.keys(mutated.files)[0];
    mutated.files[member].data = Buffer.from('changed').toString('base64');
    assert.throws(() => validateProjection(mutated), /Corrupt/);
  } finally {fs.rmSync(temp, {recursive: true, force: true});}
});
test('comparison equivalence is exact per member and preserves executable/real-edit differences', () => {
  const original = {data: Buffer.from('original fixture').toString('base64'), executable: false};
  const projected = {data: Buffer.from('public fixture').toString('base64'), executable: false};
  const projection = {origin: {kind: 'sanitized-public-projection', policy: 'h2h-source-public-v1'}, changes: [{path: 'member', before: hash(Buffer.from(original.data, 'base64')), after: hash(Buffer.from(projected.data, 'base64'))}]};
  const component = {id: 'fixture/component', source: {kind: 'local', paths: ['local'], mappings: [{path: 'local', originPath: 'member'}]}};
  const saved = {...projection, files: {member: original}, digest: digest({member: original})};
  const incoming = {origin: {}, files: {member: projected}, digest: digest({member: projected})};
  assert.deepEqual(compareFiles(component, saved, incoming, {local: projected}, projection).upstreamChanges, []);
  assert.deepEqual(compareFiles(component, saved, incoming, {local: projected}, projection).localChanges, []);
  assert.notDeepEqual(comparisonIdentities({elsewhere: original}, projection), comparisonIdentities({elsewhere: projected}, projection));
  incoming.files.member = {...projected, executable: true};
  assert.equal(compareFiles(component, saved, incoming, {}, projection).upstreamChanges.length, 1);
  incoming.files.member = {data: Buffer.from('a real source edit').toString('base64'), executable: false};
  assert.equal(compareFiles(component, saved, incoming, {}, projection).upstreamChanges.length, 1);
});
