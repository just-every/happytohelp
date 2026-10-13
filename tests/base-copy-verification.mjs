import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {product, record, copiedFiles, run, fixture, write, findings} from './helpers/base-copy-fixture.mjs';

// Exercise the official CLI with real product records and bytes, without a donor fetch.
test('portable product verification refuses each copied-path drift independently', () => {
  const positive = root => {
    const result = run(root, '--offline');
    assert.equal(result.status, 0, result.error);
    assert.equal(result.report.ok, true);
    assert.deepEqual(result.report.drift, []);
    assert.deepEqual(result.report.unrecordedCopies, []);
    assert.deepEqual(result.report.copies, record.copies.map(copy => ({path: copy.path, originPath: copy.originPath, revision: copy.revision, files: Object.keys(copy.files).length})));
    assert.equal(result.report.copies.reduce((sum, copy) => sum + copy.files, 0), copiedFiles.length);
  };
  positive(product);
  const name = 'scripts/delivery/base/paths.mjs';
  const original = fs.readFileSync(path.join(product, name));
  for (const kind of ['modified', 'missing', 'unrecorded', 'not-a-file', 'mode']) {
    const {root, close} = fixture();
    try {
      positive(root);
      let expectedPath = name;
      if (kind === 'modified') write(root, name, Buffer.concat([original, Buffer.from('\n// deliberate test drift\n')]));
      if (kind === 'mode') fs.chmodSync(path.join(root,name),0o755);
      if (kind === 'missing') fs.unlinkSync(path.join(root, name));
      if (kind === 'unrecorded') {
        expectedPath = 'src/base/product-unrecorded-test.mjs';
        write(root, expectedPath, 'export const testOnly = true;\n');
      }
      if (kind === 'not-a-file') {
        fs.unlinkSync(path.join(root, name));
        fs.symlinkSync('artifact.mjs', path.join(root, name));
      }
      const result = run(root, '--offline');
      assert.equal(result.status, 1, kind);
      assert.equal(result.report.ok, false, kind);
      assert.deepEqual(findings(result.report), [[kind, expectedPath]], kind);
      assert.deepEqual(result.report.unrecordedCopies, []);
    } finally { close(); }
  }
});
