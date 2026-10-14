import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {product, record, run, fixture, write, findings, git} from './helpers/base-copy-fixture.mjs';
import {originFixture} from './helpers/base-origin-fixture.mjs';

// Default inputs are real local Git test data. Explicit --base qualifies the
// actual private origin, preserving the selected revision and all controls.
const args = process.argv.slice(2).filter(arg => arg !== '--');
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--base'),
  'Usage: node tests/base-origin-verification.mjs [--base /absolute/base-checkout]');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function qualify({base, record: inputRecord, product: inputProduct}) {
  assert.equal(inputRecord.schemaVersion, 1);
  for (const revision of new Set(inputRecord.copies.map(copy => copy.revision))) {
    assert.equal(git(base, 'rev-parse', '--verify', revision + '^{commit}').toString().trim(), revision,
      'qualify each selected immutable Git input');
  }
  for (const copy of inputRecord.copies) for (const [name, digest] of Object.entries(copy.files)) {
    const originPath = copy.originPath + name.slice(copy.path.length);
    const bytes = git(base, 'show', copy.revision + ':' + originPath);
    assert.equal(sha(bytes), digest, 'recorded digest matches selected origin: ' + name);
    assert.deepEqual(bytes, fs.readFileSync(path.join(inputProduct, name)),
      'product bytes match selected origin: ' + name);
  }
  const positive = root => {
    const result = run(root, '--base', base);
    assert.equal(result.status, 0, result.error);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.repository, inputRecord.repository);
    assert.equal(result.report.origin, 'local Base checkout');
    assert.deepEqual(result.report.drift, []);
    assert.deepEqual(result.report.unrecordedCopies, []);
    assert.deepEqual(result.report.copies.map(({path, originPath, revision, files}) => ({path, originPath, revision, files})), inputRecord.copies.map(copy => ({
      path: copy.path, originPath: copy.originPath, revision: copy.revision, files: Object.keys(copy.files).length,
    })));
  };
  positive(inputProduct);
  for (const kind of ['origin-mismatch', 'origin-missing', 'unrecordedCopies', 'origin-mode']) {
    const {root, close} = fixture(inputRecord);
    try {
      positive(root);
      const name = 'scripts/delivery/base/paths.mjs';
      const changedRecord = structuredClone(inputRecord);
      const copy = changedRecord.copies.find(copy => copy.path === name);
      if (kind === 'origin-mismatch') {
        const bytes = Buffer.concat([fs.readFileSync(path.join(root, name)), Buffer.from('\n// deliberate forged record test\n')]);
        write(root, name, bytes);
        copy.files[name] = sha(bytes);
      }
      if (kind === 'origin-missing') copy.originPath = 'operations/product-absent-test.mjs';
      if (kind === 'origin-mode') {
        copy.modes[name] = '100755';
        fs.chmodSync(path.join(root, name), 0o755);
      }
      if (kind === 'unrecordedCopies') write(root, 'product-outside-copy-test.mjs', fs.readFileSync(path.join(root, name)));
      write(root, 'base-copies.json', JSON.stringify(changedRecord));
      // These controls preserve local-record equality; only actual-origin verification can refuse them.
      assert.equal(run(root, '--offline').status, 0);
      const negative = run(root, '--base', base);
      assert.equal(negative.status, 1, kind);
      assert.equal(negative.report.ok, false, kind);
      if (kind === 'unrecordedCopies') {
        assert.deepEqual(negative.report.drift, []);
        assert.equal(negative.report.unrecordedCopies.length, 1);
        const [finding] = negative.report.unrecordedCopies;
        assert.equal(finding.path, 'product-outside-copy-test.mjs');
        // Base also ships this file in its portable reference export. Either
        // committed identical source proves the undeclared-copy refusal.
        assert.equal(git(base, 'rev-parse', '--verify', finding.revision + '^{commit}').toString().trim(), finding.revision);
        assert.deepEqual(git(base, 'show', finding.revision + ':' + finding.originPath), fs.readFileSync(path.join(root, finding.path)));
      } else {
        assert.deepEqual(findings(negative.report), [[kind, name]]);
        assert.deepEqual(negative.report.unrecordedCopies, []);
        assert.equal(negative.report.drift[0].originPath, copy.originPath);
        assert.equal(negative.report.drift[0].revision, copy.revision);
      }
    } finally { close(); }
  }
}

test(args.length ? 'actual product copies match immutable Base and independent forged-origin/outside-copy controls are refused' :
  'all product copies match a committed local Git origin fixture and independent forged-origin/outside-copy controls are refused', () => {
  // Real origin verification owns authenticity; portable fixtures exercise refusal behavior.
  assert.equal(record.schemaVersion, 1);
  if (args.length) {
    qualify({base: fs.realpathSync(args[1]), record, product});
  } else {
    const context = originFixture();
    try { qualify(context); } finally { context.close(); }
  }
});
