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
const productPin = record.copies[0].revision;

function qualify({base, pin, record: inputRecord, product: inputProduct}) {
  assert.equal(git(base, 'rev-parse', 'HEAD').toString().trim(), pin, 'qualify the selected immutable Git input');
  assert.ok(inputRecord.copies.every(copy => copy.revision === pin));
  assert.equal(inputRecord.schemaVersion, 1);
  const positive = root => {
    const result = run(root, '--base', base);
    assert.equal(result.status, 0, result.error);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.repository, inputRecord.repository);
    assert.equal(result.report.origin, 'local Base checkout');
    assert.deepEqual(result.report.drift, []);
    assert.deepEqual(result.report.unrecordedCopies, []);
    assert.equal(result.report.copies.length, inputRecord.copies.length);
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
        assert.equal(finding.revision, pin);
        // Base also ships this file in its portable reference export. Either
        // committed identical source proves the undeclared-copy refusal.
        assert.deepEqual(git(base, 'show', pin + ':' + finding.originPath), fs.readFileSync(path.join(root, finding.path)));
      } else {
        assert.deepEqual(findings(negative.report), [[kind, name]]);
        assert.deepEqual(negative.report.unrecordedCopies, []);
        assert.equal(negative.report.drift[0].originPath, copy.originPath);
        assert.equal(negative.report.drift[0].revision, pin);
      }
    } finally { close(); }
  }
}

test(args.length ? 'actual product copies match immutable Base and independent forged-origin/outside-copy controls are refused' :
  'all product copies match a committed local Git origin fixture and independent forged-origin/outside-copy controls are refused', () => {
  // Real origin verification owns authenticity; portable fixtures exercise refusal behavior.
  assert.equal(record.schemaVersion, 1);
  assert.ok(record.copies.every(copy => copy.revision === productPin));
  if (args.length) {
    qualify({base: fs.realpathSync(args[1]), pin: productPin, record, product});
  } else {
    const context = originFixture();
    try { qualify(context); } finally { context.close(); }
  }
});
