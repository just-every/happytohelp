import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validCompiledLiveEditSnapshot} from '../src/editor/live-edit-contracts.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const snapshot = JSON.parse(await readFile(new URL('../src/editor/visual-edits.json', import.meta.url), 'utf8'));
assert.ok(validCompiledLiveEditSnapshot(snapshot), 'Invalid compiled visual edit snapshot');
for (const args of [['run', 'source:check'], ['run', 'typecheck'], ['run', 'build']]) {
  const result = spawnSync('pnpm', args, {cwd:root, stdio:'inherit'});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `pnpm ${args.join(' ')} failed`);
}
for (const test of ['tests/visual-edit-browser.mjs', 'tests/visual-hydration-browser.mjs']) {
  const browser = spawnSync(process.execPath, [test], {cwd:root, stdio:'inherit'});
  if (browser.error) throw browser.error;
  assert.equal(browser.status, 0, `${test} failed`);
}
