import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {hash, json, digest, safe} from '../edition-authoring/files.mjs';
import {validateProjection} from '../edition-authoring/projections.mjs';
import {readOriginalFile} from './inputs.mjs';
const originals = JSON.parse(fs.readFileSync(new URL('./originals.json', import.meta.url)));
const donor = 'd21e484252db2a87f8dae9d477c9d8d70e99644ad370e3d64773e6376fd766eb';
const emailMembers = new Set(['edition-authoring/lifecycle.test.mjs', 'edition-authoring/snapshot-integrity.test.mjs', 'edition-authoring/updates.test.mjs']);
export function originalArchive(raw) {
  const saved = JSON.parse(raw);
  const pin = originals.find(p => p.key === saved.key);
  if (!pin || hash(raw) !== pin.sha256 || saved.key !== hash(json(saved.origin)) || saved.digest !== pin.digest || digest(saved.files) !== pin.digest || Object.keys(saved.files).length !== pin.members || saved.dependencies?.length !== 0) throw Error('Original archive does not match byte-exact custody pin');
  return saved;
}
export function project(raw) {
  const original = originalArchive(raw);
  const files = {}, changes = [];
  for (const [name, file] of Object.entries(original.files)) {
    safe(name);
    let bytes = Buffer.from(file.data, 'base64');
    const before = hash(bytes), operations = [];
    if (original.key === donor && name === 'edition-authoring/README.md') {
      const text = bytes.toString('utf8');
      if (text.split(original.origin.repository).length !== 2) throw Error('Donor repository example changed');
      bytes = Buffer.from(text.replace(original.origin.repository, 'https://example.test/source.git'));
      operations.push('replace illustrative repository URL with reserved example domain');
    }
    if (original.key === donor && emailMembers.has(name)) {
      const text = bytes.toString('utf8');
      const replaced = text.replace(/\b(test|fixture)@example\.invalid\b/g, '$1@example.test');
      if (replaced === text) throw Error('Expected synthetic author email absent');
      bytes = Buffer.from(replaced);
      operations.push('use example.test for synthetic Git author email');
    }
    files[name] = {...file, data: bytes.toString('base64')};
    if (hash(bytes) !== before) changes.push({path: name, before, after: hash(bytes), operations});
  }
  const origin = {kind: 'sanitized-public-projection', policy: 'h2h-source-public-v1', original: {
    key: original.key, sha256: hash(raw), digest: original.digest, originSha256: hash(json(original.origin)), revision: original.origin.revision,
  }, selection: {path: original.origin.path, paths: original.origin.paths, excludeSnapshots: original.origin.excludeSnapshots}};
  return validateProjection({key: hash(json(origin)), origin, digest: digest(files), files, dependencies: [], changes});
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('Usage: project.mjs <explicit-original-file> <new-projection-file>');
  const result = project(readOriginalFile(input));
  fs.writeFileSync(output, json(result), {flag: 'wx'});
  console.log(json({key: result.key, digest: result.digest, sha256: hash(json(result)), changedMembers: result.changes.length}));
}
