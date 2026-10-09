import fs from 'node:fs';
import path from 'node:path';
import {hash, json, digest, noLinks, safe} from './files.mjs';
const sha256 = /^[a-f0-9]{64}$/;
export function projectionReference(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'key,sha256' || !sha256.test(value.key) || !sha256.test(value.sha256)) throw Error('Projection requires exact key and artifact SHA-256');
}
export function validateProjection(saved) {
  const origin = saved.origin;
  if (origin?.kind !== 'sanitized-public-projection' || origin.policy !== 'h2h-source-public-v1' ||
      !/^[a-f0-9]{40}$/.test(origin.original?.revision) ||
      !['key', 'sha256', 'digest', 'originSha256'].every(k => sha256.test(origin.original?.[k])) ||
      saved.key !== hash(json(origin)) || saved.digest !== digest(saved.files) ||
      !Array.isArray(saved.changes) || saved.dependencies?.length !== 0) throw Error('Corrupt public projection');
  const seen = new Set();
  for (const [name, file] of Object.entries(saved.files)) {
    safe(name);
    if (typeof file.data !== 'string' || typeof file.executable !== 'boolean' || Buffer.from(file.data, 'base64').toString('base64') !== file.data) throw Error('Corrupt projected member');
  }
  for (const change of saved.changes) {
    safe(change.path);
    if (seen.has(change.path) || !sha256.test(change.before) || !sha256.test(change.after) ||
        !saved.files[change.path] || change.after !== hash(Buffer.from(saved.files[change.path].data, 'base64')) ||
        change.before === change.after || !Array.isArray(change.operations) || !change.operations.length) throw Error('Corrupt projection change receipt');
    seen.add(change.path);
  }
  return saved;
}
export function projectedSnapshot(root, ref) {
  projectionReference(ref.projection);
  const relative = '.edition/sources/' + ref.projection.key + '.json';
  noLinks(root, relative);
  // Missing projections fail closed. A private original is never fetched.
  const raw = fs.readFileSync(path.join(root, relative));
  if (hash(raw) !== ref.projection.sha256) throw Error('Projection artifact differs from selected SHA-256');
  const saved = validateProjection(JSON.parse(raw));
  if (saved.key !== ref.projection.key || json(saved.origin.selection) !== json({path: ref.path || '.', paths: ref.paths || null, excludeSnapshots: !!ref.excludeSnapshots})) throw Error('Projection selection mismatch');
  return saved;
}
// Byte identity remains explicit in the receipt. Comparisons treat only the
// pinned, authorized original/projected pair as equivalent; arbitrary edits
// (even on the same path) retain their actual digest and remain visible.
export function comparisonIdentities(files, projection) {
  const changes = new Map((projection?.changes || []).map(c => [c.path, c]));
  return Object.fromEntries(Object.entries(files).map(([name, file]) => {
    let sha256 = hash(Buffer.from(file.data, 'base64'));
    const change = changes.get(name);
    if (change && sha256 === change.before) sha256 = change.after;
    return [name, {sha256, executable: file.executable}];
  }));
}
