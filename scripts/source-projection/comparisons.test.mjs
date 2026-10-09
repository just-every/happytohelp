import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {snapshot} from '../edition-authoring/sources.mjs';
import {compare} from '../edition-authoring/updates.mjs';
import {candidate, consume, selections, mutateCandidate} from './consumers.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('actual selected component and whole-parent extraction/comparison works offline', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'public-comparisons-'));
  try {
    for (const selection of selections(root)) {
      const saved = snapshot(root, selection.ref);
      const upstream = candidate(path.join(temp, 'candidates'), saved);
      const {result} = consume(root, selection, upstream, path.join(temp, 'extracts', saved.key));
      assert.deepEqual(result.upstreamChanges, []);
      if (selection.id === 'runeditrun/onboarding') assert.equal(result.localChanges, null, 'Unmapped source stays explicitly unmapped');
      else assert.ok(Array.isArray(result.localChanges));
      const changed = mutateCandidate(upstream, saved);
      const mutated = compare(root, selection.id, upstream);
      assert.deepEqual(mutated.upstreamChanges.map(c => [c.path, c.change]), [[changed, 'modified']]);
      assert.notEqual(mutated.upstreamChanges[0].before.executable, mutated.upstreamChanges[0].after.executable);
      assert.notEqual(mutated.upstreamChanges[0].before.sha256, mutated.upstreamChanges[0].after.sha256);
    }
  } finally {fs.rmSync(temp, {recursive: true, force: true});}
});
