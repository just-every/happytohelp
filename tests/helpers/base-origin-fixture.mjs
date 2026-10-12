import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {product, record as productRecord, write, git, fixture} from './base-copy-fixture.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function files(name) {
  const stat = fs.lstatSync(path.join(product, name));
  if (stat.isDirectory()) return fs.readdirSync(path.join(product, name)).sort().flatMap(child => files(name + '/' + child));
  assert.ok(stat.isFile(), 'test data must be a real regular product file: ' + name);
  return [name];
}

// A real, locally committed Git origin made from product bytes and recorded
// mappings. This is test data, not evidence of private Base identity or authenticity.
export function originFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'product-origin-data-'));
  let seed;
  try {
    git(base, 'init', '--quiet');
    const copies = productRecord.copies.map(({path: name, originPath}) => {
      const names = files(name);
      const digests = {},modes={};
      for (const file of names) {
        const bytes = fs.readFileSync(path.join(product, file));
        write(base, originPath + file.slice(name.length), bytes);
        digests[file] = sha(bytes);
        modes[file]=(fs.statSync(path.join(product,file)).mode&0o100)?'100755':'100644';
        fs.chmodSync(path.join(base,originPath+file.slice(name.length)),modes[file]==='100755'?0o755:0o644);
      }
      return {path: name, originPath, files: digests,modes};
    });
    git(base, 'add', '--all');
    git(base, '-c', 'user.name=Product origin fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Locally constructed origin test data');
    const pin = git(base, 'rev-parse', 'HEAD').toString().trim();
    const record = {schemaVersion: 1, repository: base, copies: copies.map(copy => ({...copy, revision: pin}))};
    seed = fixture(record);
    return {base, pin, record, product: seed.root, close() { seed.close(); fs.rmSync(base, {recursive: true, force: true}); }};
  } catch (error) {
    seed?.close();
    fs.rmSync(base, {recursive: true, force: true});
    throw error;
  }
}
