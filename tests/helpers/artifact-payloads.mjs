import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
const locations = new WeakMap();
export async function readArtifact(path) {
 const artifact = JSON.parse(await readFile(path));
 assert.equal(artifact.schema, 2);
 locations.set(artifact, dirname(resolve(path)));
 for (const entry of [...artifact.modules, ...artifact.assets]) await payloadBytes(artifact, entry);
 return artifact;
}
export async function payloadBytes(artifact, entry) {
 assert.equal(artifact.schema, 2);
 const directory = locations.get(artifact);
 assert.ok(directory, 'Load schema-2 artifacts through readArtifact');
 assert.match(entry.payload, /^payload\/(modules|assets)\/\d+$/);
 const path = await realpath(resolve(directory, entry.payload));
 assert.ok(path.startsWith((await realpath(directory)) + sep));
 const bytes = await readFile(path);
 assert.equal(bytes.length, entry.size);
 assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
 return bytes;
}
