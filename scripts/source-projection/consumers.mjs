import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {snapshot} from '../edition-authoring/sources.mjs';
import {extract, compare} from '../edition-authoring/updates.mjs';
import {git, writeTree, json, hash} from '../edition-authoring/files.mjs';
export function selections(root) {
  const recipe = JSON.parse(fs.readFileSync(path.join(root, 'edition.json')));
  return [{id: 'parent', ref: {...recipe.parent, excludeSnapshots: true}}, ...recipe.components.filter(c => c.source.origin).map(c => ({id: c.id, ref: c.source.origin}))];
}
export function candidate(temp, saved) {
  const root = path.join(temp, saved.key);
  const prefix = saved.origin.selection?.path || saved.origin.path;
  const files = Object.fromEntries(Object.entries(saved.files).map(([name, file]) => [prefix && prefix !== '.' ? prefix + '/' + name : name, file]));
  writeTree(root, files);
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.name', 'Source comparison fixture');
  git(root, 'config', 'user.email', 'fixture@example.test');
  git(root, 'add', '.'); git(root, 'commit', '--quiet', '-m', 'Comparison input');
  return root;
}
export function consume(root, selection, upstream, output, projection, editionFiles) {
  const saved = snapshot(root, selection.ref);
  const extracted = extract(root, selection.id, output);
  assert.equal(extracted.files, Object.keys(saved.files).length);
  for (const [name, file] of Object.entries(saved.files)) {
    const actual = fs.readFileSync(path.join(output, name));
    assert.equal(hash(actual), hash(Buffer.from(file.data, 'base64')));
    assert.equal(!!(fs.statSync(path.join(output, name)).mode & 0o111), file.executable);
  }
  const result = compare(root, selection.id, upstream, projection, editionFiles);
  return {saved, extracted, result};
}
export function semantics(result) {
  // Origin/digest provenance is checked separately: it must differ truthfully.
  const {baseline, incoming, ...semantic} = result;
  return semantic;
}
export function mutateCandidate(upstream, saved) {
  const prefix = saved.origin.selection?.path || saved.origin.path;
  const name = Object.keys(saved.files).find(n => /\.(mjs|ts|tsx|js)$/.test(n));
  assert.ok(name, 'Every retained comparison has executable source');
  const filename = path.join(upstream, prefix && prefix !== '.' ? prefix : '', name);
  fs.appendFileSync(filename, '\n// A substantive comparison probe, never adopted.\n');
  fs.chmodSync(filename, saved.files[name].executable ? 0o644 : 0o755);
  git(upstream, 'add', '.'); git(upstream, 'commit', '--quiet', '-m', 'Real source and mode difference');
  return name;
}
