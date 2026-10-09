import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {originalInputPath, readOriginalFile} from './inputs.mjs';

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'original-input-'));
  try {
    const directory = path.join(temp, 'regular');
    fs.mkdirSync(directory);
    const file = path.join(directory, 'archive.json');
    fs.writeFileSync(file, 'test archive bytes\n');
    return run({temp, directory, file});
  } finally {fs.rmSync(temp, {recursive: true, force: true});}
}

test('original input reader preserves regular bytes and relative paths', () => fixture(({temp, directory, file}) => {
  const expected = fs.readFileSync(file);
  for (const input of [file, path.relative(process.cwd(), file), directory + '/../regular/./archive.json']) {
    assert.deepEqual(readOriginalFile(input), expected);
  }
  assert.equal(originalInputPath(directory, 'directory'), directory);
  assert.throws(() => readOriginalFile(directory), /unsupported file type/);
  assert.throws(() => readOriginalFile(path.join(temp, 'missing')), {code: 'ENOENT'});
}));

test('original inputs reject linked files and every linked ancestor, including dangling links', () => fixture(({temp, directory, file}) => {
  const linkedFile = path.join(temp, 'file-link');
  const danglingFile = path.join(temp, 'dangling-file');
  const linkedDirectory = path.join(temp, 'directory-link');
  const danglingDirectory = path.join(temp, 'dangling-directory');
  fs.symlinkSync(file, linkedFile);
  fs.symlinkSync(path.join(temp, 'absent-file'), danglingFile);
  fs.symlinkSync(directory, linkedDirectory, 'dir');
  fs.symlinkSync(path.join(temp, 'absent-directory'), danglingDirectory, 'dir');
  fs.mkdirSync(path.join(directory, 'nested'));
  fs.copyFileSync(file, path.join(directory, 'nested/archive.json'));
  for (const input of [linkedFile, danglingFile, linkedDirectory + '/archive.json', linkedDirectory + '/nested/archive.json', danglingDirectory + '/archive.json', linkedDirectory + '/../regular/archive.json']) {
    assert.throws(() => readOriginalFile(input), /Symlink in original archive input path/);
    assert.throws(() => readOriginalFile(path.relative(process.cwd(), temp) + input.slice(temp.length)), /Symlink in original archive input path/);
  }
  for (const input of [linkedDirectory, danglingDirectory, linkedDirectory + '/../regular']) {
    assert.throws(() => originalInputPath(input, 'directory'), /Symlink in original archive input path/);
  }
}));

test('single-file generator refuses a link before archive parsing and creates no output', () => fixture(({temp, file}) => {
  const script = fileURLToPath(new URL('./project.mjs', import.meta.url));
  const linked = path.join(temp, 'linked.json');
  const output = path.join(temp, 'projection.json');
  fs.symlinkSync(file, linked);
  const result = spawnSync(process.execPath, [script, linked, output], {encoding: 'utf8'});
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Symlink in original archive input path/);
  assert.equal(fs.existsSync(output), false);
}));
