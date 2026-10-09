// Private gate: originals are accepted only through the explicit CLI argument.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {project, originalArchive} from './project.mjs';
import {originalInputFiles, readOriginalFile} from './inputs.mjs';
import {verifyOriginalInputs} from './input-controls.mjs';
import {candidate, consume, selections, semantics, mutateCandidate} from './consumers.mjs';
import {snapshot} from '../edition-authoring/sources.mjs';
import {compare} from '../edition-authoring/updates.mjs';
import {git, json, hash, tracked, writeTree} from '../edition-authoring/files.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const [directory] = process.argv.slice(2);
if (!directory || process.argv.length !== 3) throw Error('Usage: equivalence.mjs <explicit-original-directory>');
const pins = JSON.parse(fs.readFileSync(new URL('./originals.json', import.meta.url)));
const originalDirectory = path.dirname(originalInputFiles(directory, pins)[0]);
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'private-source-equivalence-'));
function archivedTests(tree, saved) {
  const tests = Object.keys(saved.files).filter(name => name.endsWith('.test.mjs'));
  if (!tests.length) return {tests: 0, outcomes: []};
  // These are the exact archived assertions/fixtures, run as real Node tests.
  let output;
  try {
    output = execFileSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...tests], {cwd: tree, encoding: 'utf8', stdio: 'pipe', maxBuffer: 4 * 1024 * 1024});
  } catch (error) { throw Error('Archived tests failed (exit ' + error.status + '): ' + tests.join(', ')); }
  const outcomes = output.split('\n').filter(line => /^(ok|not ok) \d+ - |^# (tests|pass|fail|cancelled|skipped|todo) /.test(line));
  for (const count of ['fail', 'cancelled', 'skipped', 'todo']) assert.ok(outcomes.includes('# ' + count + ' 0'), 'Archived tests must all execute successfully');
  return {files: tests.length, outcomes};
}
try {
  const inputControls = verifyOriginalInputs(originalDirectory, path.join(temp, 'input-controls'));
  const originalRoot = path.join(temp, 'original-edition');
  writeTree(originalRoot, tracked(root));
  git(originalRoot, 'init', '--quiet');
  const recipe = JSON.parse(fs.readFileSync(path.join(root, 'edition.json')));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'sources.lock.json')));
  const pairs = [];
  for (const selection of selections(root)) {
    const projected = snapshot(root, selection.ref);
    const raw = readOriginalFile(path.join(originalDirectory, projected.origin.original.key + '.json'));
    const original = originalArchive(raw);
    assert.throws(() => project(Buffer.concat([raw, Buffer.from('\n')])), /byte-exact custody pin/, 'Altered originals must be rejected');
    assert.equal(json(project(raw)), json(projected), 'Byte-exact deterministic reproduction');
    assert.deepEqual(Object.keys(original.files), Object.keys(projected.files), 'No member is dropped');
    for (const [name, file] of Object.entries(original.files)) {
      assert.equal(file.executable, projected.files[name].executable);
      const changed = projected.changes.find(c => c.path === name);
      if (!changed) assert.deepEqual(file, projected.files[name]);
      else {
        assert.equal(changed.before, hash(Buffer.from(file.data, 'base64')));
        assert.equal(changed.after, hash(Buffer.from(projected.files[name].data, 'base64')));
      }
    }
    fs.mkdirSync(path.join(originalRoot, '.edition/sources'), {recursive: true});
    fs.writeFileSync(path.join(originalRoot, '.edition/sources', original.key + '.json'), raw);
    const ref = {...original.origin}; delete ref.excludeSnapshots;
    const baseline = {key: original.key, digest: original.digest, sha256: hash(raw)};
    if (selection.id === 'parent') {recipe.parent = ref; lock.parent = baseline;}
    else {
      recipe.components.find(c => c.id === selection.id).source.origin = ref;
      lock.components.find(c => c.id === selection.id).baseline = baseline;
    }
    pairs.push({selection, original, projected});
  }
  fs.writeFileSync(path.join(originalRoot, 'edition.json'), json(recipe));
  fs.writeFileSync(path.join(originalRoot, 'sources.lock.json'), json(lock));
  git(originalRoot, 'add', '.');
  const receipts = [];
  for (const {selection, original, projected} of pairs) {
    const upstream = candidate(path.join(temp, 'candidates'), projected);
    const originalSelection = selections(originalRoot).find(s => s.id === selection.id);
    const a = consume(originalRoot, originalSelection, upstream, path.join(temp, 'extract-original', original.key), projected, tracked(root));
    const b = consume(root, selection, upstream, path.join(temp, 'extract-public', projected.key));
    assert.deepEqual(semantics(a.result), semantics(b.result));
    assert.deepEqual(b.result.upstreamChanges, []);
    const changed = mutateCandidate(upstream, projected);
    const originalChanged = compare(originalRoot, selection.id, upstream, projected, tracked(root));
    const publicChanged = compare(root, selection.id, upstream);
    assert.deepEqual(originalChanged.upstreamChanges, publicChanged.upstreamChanges);
    assert.deepEqual(publicChanged.upstreamChanges.map(c => c.path), [changed]);
    const originalTests = archivedTests(a.extracted.output, original);
    const projectionTests = archivedTests(b.extracted.output, projected);
    assert.deepEqual(originalTests, projectionTests, 'All retained test assertion outcomes match');
    receipts.push({selection: selection.id, original: {key: original.key, sha256: hash(readOriginalFile(path.join(originalDirectory, original.key + '.json')))}, projection: {key: projected.key, sha256: hash(json(projected))}, membersCompared: Object.keys(original.files).length, changedMembers: projected.changes.length, comparisons: ['snapshot', 'byte-exact extraction and modes', 'unmodified upstream', 'effective local changes', 'real source and executable-mode edit'], archivedTests: originalTests});
  }
  console.log(json({ok: true, inputControls, receipts}));
} finally {fs.rmSync(temp, {recursive: true, force: true});}
