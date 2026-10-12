import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const product = fileURLToPath(new URL('../../', import.meta.url));
export const cli = path.join(product, 'scripts/edition-authoring/cli.mjs');
export const record = JSON.parse(fs.readFileSync(path.join(product, 'base-copies.json'), 'utf8'));
export const copiedFiles = record.copies.flatMap(copy => Object.keys(copy.files));
export const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {stdio: 'pipe'});
export function write(root, name, bytes) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, bytes);
}
export function run(root, ...args) {
  const result = spawnSync(process.execPath, [cli, 'verify-base', ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: {...process.env, GIT_NO_REPLACE_OBJECTS: '1'},
  });
  if (result.error) throw result.error;
  return {status: result.status, error: result.stderr, report: result.stdout.trim() ? JSON.parse(result.stdout) : null};
}
export function fixture(inputRecord = record) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'product-base-copies-'));
  try {
    git(root, 'init', '--quiet');
    write(root, 'base-copies.json', JSON.stringify(inputRecord));
    for(const copy of inputRecord.copies)for(const name of Object.keys(copy.files)){write(root,name,fs.readFileSync(path.join(product,name)));fs.chmodSync(path.join(root,name),copy.modes?.[name]==='100755'?0o755:0o644);}
    git(root, 'add', '--all');
    return {root, close: () => fs.rmSync(root, {recursive: true, force: true})};
  } catch (error) {
    fs.rmSync(root, {recursive: true, force: true});
    throw error;
  }
}
export const findings = report => report.drift.map(item => [item.kind, item.path]);
