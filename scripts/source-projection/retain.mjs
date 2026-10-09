// Maintainer-only transition/reproduction; the directory is supplied explicitly.
import fs from 'node:fs';
import path from 'node:path';
import {project} from './project.mjs';
import {originalInputFiles, readOriginalFile} from './inputs.mjs';
import {hash, json} from '../edition-authoring/files.mjs';
const [directory] = process.argv.slice(2);
if (!directory || process.argv.length !== 3) throw Error('Usage: retain.mjs <explicit-original-directory>');
const pins = JSON.parse(fs.readFileSync(new URL('./originals.json', import.meta.url)));
const inputs = originalInputFiles(directory, pins);
// Authenticate the complete input set before writing any projection.
const projections = inputs.map((input, index) => {
  const projected = project(readOriginalFile(input));
  if (projected.origin.original.key !== pins[index].key) throw Error('Original archive filename does not match pinned identity');
  return projected;
});
const recipe = JSON.parse(fs.readFileSync('edition.json'));
const lock = JSON.parse(fs.readFileSync('sources.lock.json'));
const mappings = [];
for (const [index, pin] of pins.entries()) {
  const projected = projections[index];
  const reference = {key: projected.key, sha256: hash(json(projected))};
  const filename = path.join('.edition/sources', projected.key + '.json');
  if (fs.existsSync(filename) && fs.readFileSync(filename, 'utf8') !== json(projected)) throw Error('Existing projection differs');
  fs.writeFileSync(filename, json(projected));
  let selected = false;
  for (const [ref, baseline] of [[recipe.parent, lock.parent], ...recipe.components.map(c => [c.source.origin, lock.components.find(l => l.id === c.id)?.baseline])]) {
    if (ref && (baseline?.key === pin.key || ref.projection?.key === projected.key)) {
      delete ref.repository; delete ref.revision;
      ref.projection = reference;
      selected = true;
    }
  }
  if (!selected) throw Error('Original is not selected by recipe/lock');
  mappings.push({original: pin, projection: {...reference, digest: projected.digest, members: Object.keys(projected.files).length}, changes: projected.changes});
}
fs.writeFileSync('edition.json', json(recipe));
fs.writeFileSync('scripts/source-projection/projections.json', json(mappings));
// Only remove originals after every input has been authenticated and selected.
for (const pin of pins) fs.rmSync(path.join('.edition/sources', pin.key + '.json'), {force: true});
console.log(json(mappings.map(m => ({original: m.original.key, projection: m.projection.key}))));
