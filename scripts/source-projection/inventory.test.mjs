import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {originalInputFiles} from './inputs.mjs';

const pins = JSON.parse(fs.readFileSync(new URL('./originals.json', import.meta.url)));
const names = pins.map(pin => pin.key + '.json');
const script = fileURLToPath(new URL('./retain.mjs', import.meta.url));
const inventoryError = /Original archive directory inventory does not match pinned inputs/;

function fixture(run) {
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'original-inventory-'));
  try {
    const directory = path.join(temporary, 'originals');
    fs.mkdirSync(directory);
    // Only the inventory is under test here; authentication remains the real
    // generator's next step and is exercised with authentic private originals.
    for (const name of [...names].reverse()) fs.writeFileSync(path.join(directory, name), 'inventory fixture\n');
    return run({temporary, directory});
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
}

test('original directory inventory accepts exactly four regular pinned names in pin order', () => fixture(({directory}) => {
  assert.equal(names.length, 4);
  const expected = names.map(name => path.join(directory, name));
  assert.deepEqual(originalInputFiles(directory, pins), expected);
  assert.deepEqual(originalInputFiles(path.relative(process.cwd(), directory), pins), expected);
}));

for (const name of names) {
  test('original directory inventory requires pinned member ' + name, () => fixture(({directory}) => {
    fs.unlinkSync(path.join(directory, name));
    assert.throws(() => originalInputFiles(directory, pins), inventoryError);
  }));
}

const rejected = [
  ['extra archive', directory => fs.copyFileSync(path.join(directory, names[0]), path.join(directory, '0'.repeat(64) + '.json')), inventoryError],
  ['malformed archive name', directory => fs.writeFileSync(path.join(directory, 'archive.json'), '{}'), inventoryError],
  ['hidden file', directory => fs.writeFileSync(path.join(directory, '.DS_Store'), ''), inventoryError],
  ['same-count substituted name', directory => fs.renameSync(path.join(directory, names[0]), path.join(directory, 'unexpected.json')), inventoryError],
  ['extra directory', directory => fs.mkdirSync(path.join(directory, 'nested')), /unsupported file type/],
  ['pinned directory', directory => {fs.unlinkSync(path.join(directory, names[0])); fs.mkdirSync(path.join(directory, names[0]));}, /unsupported file type/],
  ['extra symlink', directory => fs.symlinkSync(path.join(directory, names[0]), path.join(directory, 'linked.json')), /Symlink in original archive input path/],
  ['extra dangling symlink', directory => fs.symlinkSync(path.join(directory, 'absent'), path.join(directory, 'dangling.json')), /Symlink in original archive input path/],
  ['pinned dangling symlink', directory => {fs.unlinkSync(path.join(directory, names[0])); fs.symlinkSync(path.join(directory, 'absent'), path.join(directory, names[0]));}, /Symlink in original archive input path/],
  ['missing archive', directory => fs.unlinkSync(path.join(directory, names.at(-1))), inventoryError],
];
for (const [label, change, error] of rejected) {
  test('retention rejects ' + label + ' before parsing or output mutation', () => fixture(({temporary, directory}) => {
    change(directory);
    assert.throws(() => originalInputFiles(directory, pins), error);
    const candidate = path.join(temporary, 'candidate');
    fs.mkdirSync(path.join(candidate, '.edition/sources'), {recursive: true});
    fs.mkdirSync(path.join(candidate, 'scripts/source-projection'), {recursive: true});
    const protectedFiles = ['edition.json', 'sources.lock.json', 'scripts/source-projection/projections.json', '.edition/sources/retained.json'];
    for (const file of protectedFiles) fs.writeFileSync(path.join(candidate, file), 'unchanged ' + file + '\n');
    const before = protectedFiles.map(file => fs.readFileSync(path.join(candidate, file), 'utf8'));
    const result = spawnSync(process.execPath, [script, directory], {cwd: candidate, encoding: 'utf8'});
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
    assert.equal(result.stdout, '');
    assert.deepEqual(fs.readdirSync(path.join(candidate, '.edition/sources')), ['retained.json']);
    assert.deepEqual(protectedFiles.map(file => fs.readFileSync(path.join(candidate, file), 'utf8')), before);
  }));
}
