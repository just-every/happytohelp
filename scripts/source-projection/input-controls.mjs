// Private gate controls: authentic originals arrive only via an explicit path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {project} from './project.mjs';
import {originalInputFiles, readOriginalFile} from './inputs.mjs';
import {verifyInventoryInputs} from './inventory-controls.mjs';
import {json} from '../edition-authoring/files.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pins = JSON.parse(fs.readFileSync(new URL('./originals.json', import.meta.url)));

function run(script, args, cwd, env = {}) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/source-projection', script), ...args], {
    cwd, env: {...process.env, ...env}, encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function contents(directory) {
  return Object.fromEntries(fs.readdirSync(directory, {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile()).map(entry => {
      const filename = path.join(entry.parentPath, entry.name);
      return [path.relative(directory, filename), fs.readFileSync(filename).toString('base64')];
    }).sort(([a], [b]) => a.localeCompare(b)));
}

export function verifyOriginalInputs(directory, temporary) {
  const inputs = originalInputFiles(directory, pins);
  const regular = path.join(temporary, 'regular');
  fs.mkdirSync(regular, {recursive: true, mode: 0o700});
  const expected = new Map();
  for (const [index, pin] of pins.entries()) {
    const raw = readOriginalFile(inputs[index]);
    expected.set(pin.key, json(project(raw)));
    fs.writeFileSync(path.join(regular, pin.key + '.json'), raw, {mode: 0o600});
    for (const [index, env] of [{TZ: 'UTC', LC_ALL: 'C'}, {TZ: 'Pacific/Auckland', LC_ALL: 'en_US.UTF-8'}].entries()) {
      const output = path.join(temporary, pin.key + '-' + index + '.json');
      const input = index ? './regular/' + pin.key + '.json' : path.join(regular, pin.key + '.json');
      assert.equal(run('project.mjs', [input, output], temporary, env).status, 0, 'Regular pinned input must generate');
      assert.equal(fs.readFileSync(output, 'utf8'), expected.get(pin.key), 'Pinned input must reproduce exact public bytes');
    }
  }
  const name = pins.at(-1).key + '.json';
  fs.symlinkSync(path.join(regular, name), path.join(temporary, 'file-link'));
  fs.symlinkSync(path.join(temporary, 'absent-file'), path.join(temporary, 'dangling-file'));
  fs.symlinkSync(regular, path.join(temporary, 'directory-link'), 'dir');
  fs.symlinkSync(temporary, path.join(temporary, 'ancestor-link'), 'dir');
  fs.symlinkSync(path.join(temporary, 'absent-directory'), path.join(temporary, 'dangling-directory'), 'dir');
  const generatorRejected = ['file-link', 'dangling-file', 'directory-link/' + name, 'ancestor-link/regular/' + name, 'dangling-directory/' + name, 'directory-link/../regular/' + name];
  for (const input of generatorRejected) {
    const output = path.join(temporary, 'rejected-output.json');
    const result = run('project.mjs', [input, output], temporary);
    assert.notEqual(result.status, 0, 'Generator must reject linked original');
    assert.match(result.stderr, /Symlink in original archive input path/);
    assert.equal(fs.existsSync(output), false, 'Rejected input must not create a projection');
  }
  const candidate = path.join(temporary, 'candidate');
  fs.mkdirSync(path.join(candidate, '.edition/sources'), {recursive: true});
  fs.mkdirSync(path.join(candidate, 'scripts/source-projection'), {recursive: true});
  for (const file of ['edition.json', 'sources.lock.json', 'scripts/source-projection/projections.json']) {
    fs.copyFileSync(path.join(root, file), path.join(candidate, file));
  }
  let generated;
  for (const [index, env] of [{TZ: 'UTC', LC_ALL: 'C'}, {TZ: 'Pacific/Auckland', LC_ALL: 'en_US.UTF-8'}].entries()) {
    const input = index ? path.relative(candidate, regular) : regular;
    assert.equal(run('retain.mjs', [input], candidate, env).status, 0, 'Regular pinned directory must regenerate');
    for (const file of ['edition.json', 'sources.lock.json', 'scripts/source-projection/projections.json']) {
      assert.equal(fs.readFileSync(path.join(candidate, file), 'utf8'), fs.readFileSync(path.join(root, file), 'utf8'));
    }
    assert.deepEqual(fs.readdirSync(path.join(candidate, '.edition/sources')).sort(), [...expected.values()].map(value => JSON.parse(value).key + '.json').sort());
    for (const projected of expected.values()) {
      assert.equal(fs.readFileSync(path.join(candidate, '.edition/sources', JSON.parse(projected).key + '.json'), 'utf8'), projected);
    }
    if (generated) assert.deepEqual(contents(candidate), generated, 'Repeated batch generation must preserve every output byte');
    generated = contents(candidate);
  }
  // Leave the destination empty so a failure after writing an earlier member
  // cannot masquerade as an unchanged, already-generated output.
  for (const name of fs.readdirSync(path.join(candidate, '.edition/sources'))) fs.unlinkSync(path.join(candidate, '.edition/sources', name));
  const before = contents(candidate);
  const retentionRejected = ['directory-link', 'ancestor-link/regular', 'dangling-directory', 'directory-link/../regular'];
  for (const input of retentionRejected) {
    const result = run('retain.mjs', [temporary + '/' + input], candidate);
    assert.notEqual(result.status, 0, 'Retention must reject linked directory');
    assert.match(result.stderr, /Symlink in original archive input path/);
    assert.deepEqual(contents(candidate), before, 'Rejected inputs must not mutate retained output');
  }
  for (const dangling of [false, true]) {
    const members = path.join(temporary, dangling ? 'dangling-member' : 'linked-member');
    fs.mkdirSync(members, {mode: 0o700});
    for (const pin of pins) fs.copyFileSync(path.join(regular, pin.key + '.json'), path.join(members, pin.key + '.json'));
    fs.unlinkSync(path.join(members, name));
    fs.symlinkSync(path.join(dangling ? path.join(temporary, 'absent') : regular, name), path.join(members, name));
    const result = run('retain.mjs', [members], candidate);
    assert.notEqual(result.status, 0, 'Retention must reject linked member');
    assert.match(result.stderr, /Symlink in original archive input path/);
    assert.deepEqual(contents(candidate), before, 'Rejected member must not mutate retained output');
    retentionRejected.push(dangling ? 'dangling-member' : 'linked-member');
  }
  const inventoryRejected = verifyInventoryInputs(regular, temporary, pins, (input, error, label) => {
    const result = run('retain.mjs', [input], candidate);
    assert.notEqual(result.status, 0, 'Retention must reject inventory: ' + label);
    assert.match(result.stderr, error);
    assert.equal(result.stdout, '', 'Rejected inventory must not report generated output');
    assert.deepEqual(contents(candidate), before, 'Rejected inventory must not mutate retained output');
  });
  return {regularArchives: pins.length, deterministicGenerations: pins.length * 2, deterministicBatchGenerations: 2, generatorRejected, retentionRejected, inventoryRejected};
}
