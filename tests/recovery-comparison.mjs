import {readArtifact} from './helpers/artifact-payloads.mjs';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, rm, copyFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {recoveryRuntime} from './helpers/recovery/runtime.mjs';
import {snapshot, compareSnapshots, summarize, sha256} from './helpers/recovery/snapshot.mjs';
import {seedJourney, verifyAccess, verifyFreshLogin, setupToken} from './helpers/recovery/journey.mjs';

const [profile, buildDirectory, outputDirectory] = process.argv.slice(2);
assert.equal(profile, 'first-run', 'Usage: node tests/recovery-comparison.mjs first-run BUILD_DIRECTORY NEW_OUTPUT_DIRECTORY');
assert.ok(buildDirectory && outputDirectory, 'Build and output directories are required');
const buildRoot = resolve(buildDirectory), output = resolve(outputDirectory);
const build = JSON.parse(await readFile(join(buildRoot, 'build.json')));
const bytes = await readFile(join(buildRoot, 'delivery-artifact/artifact.json'));
assert.equal(sha256(bytes), build.artifactSha256, 'Artifact does not match build receipt');
const artifact = await readArtifact(join(buildRoot, 'delivery-artifact/artifact.json'));
const migrationNames = artifact.deploymentSpec.migrations.map(migration => migration.name);
assert.ok(migrationNames.length > 0, 'Recovery requires the real emitted migration ledger');
assert.equal(new Set(migrationNames).size, migrationNames.length, 'Each emitted migration must apply once');
assert.deepEqual(artifact.deploymentSpec.migrations.map(({name, sha256}) => ({name, sha256})), build.migrations);
await mkdir(output); // Refuse to silently reuse a previous run's state or receipt.
const startedAt = new Date().toISOString();
const port = Number(process.env.H2H_RECOVERY_PORT || 18260);
const variables = {H2H_SETUP_TOKEN: setupToken};
let original, restored;
try {
  original = await recoveryRuntime(artifact, {directory: join(output, 'source-runtime'), port, inspectorPort: port + 1, variables});
  await original.start();
  const journey = await seedJourney(original);
  await original.close();
  let before;
  await original.withStorage(async storage => {
    // Distinct object metadata and a zero-byte object exercise more than the
    // authenticated upload alone; pagination is intentionally bounded to two.
    for (const [suffix, bytes] of [['metadata', [0, 3, 255]], ['empty', []]]) {
      await storage.inspect({key: `${journey.owner.projectId}/recovery/${suffix}`, bytes, options: {httpMetadata: {contentType: 'application/octet-stream', cacheControl: 'private, max-age=73', contentDisposition: `attachment; filename="${suffix}.bin"`}, customMetadata: {purpose: 'recovery-comparison', unicode: 'café'}}});
    }
    before = await snapshot(storage);
    const migrations = before.rows.d1_migrations.map(row => JSON.parse(row).name).sort();
    assert.deepEqual(migrations, artifact.deploymentSpec.migrations.map(m => m.name).sort(), 'Applied migration rows must match the emitted artifact');
    assert.ok(before.rows.messages.length > 0 && before.rows.sessions.length > 0 && before.rows.media.length > 0, 'Recovery requires populated native records');
    assert.ok(before.objects.length >= 3);
    const project = before.rows.projects.map(row => JSON.parse(row)).find(row => row.id === journey.owner.projectId);
    assert.match(project.verification_secret, /^[a-f0-9]{64}$/, 'Project verification secret must survive full row comparison');
  });
  const exportFile = join(output, 'native-export.sql');
  await original.run(['d1', 'export', 'DB', '--local', '--output', exportFile]);
  restored = await recoveryRuntime(artifact, {directory: join(output, 'restored-runtime'), port: port + 2, inspectorPort: port + 3, variables, restoreFile: exportFile});
  let after;
  await restored.withStorage(async storage => {
    assert.deepEqual((await snapshot(storage)).objects, [], 'Fresh target R2 must be empty');
    for (const object of before.objects) await storage.inspect({key: object.key, bytes: object.bytes, options: {httpMetadata: object.httpMetadata, customMetadata: object.customMetadata}});
    after = await snapshot(storage);
    compareSnapshots(before, after);
  });
  const repeatExport = join(output, 'restored-export.sql');
  await restored.run(['d1', 'export', 'DB', '--local', '--output', repeatExport]);
  assert.deepEqual(await readFile(repeatExport), await readFile(exportFile), 'Native SQL re-export differs');
  await restored.start();
  await verifyAccess(restored, journey, journey.owner.token);
  await verifyFreshLogin(restored, journey);
  await restored.close();
  const receipt = {
    profile, sourceSha: build.sourceSha, artifactSha256: build.artifactSha256, startedAt, finishedAt: new Date().toISOString(), node: process.version,
    tables: Object.keys(before.rows).length, migrations: artifact.deploymentSpec.migrations.length,
    nativeExportSha256: sha256(await readFile(exportFile)), restoredExportSha256: sha256(await readFile(repeatExport)),
    before: summarize(before), restored: summarize(after),
    checks: ['actual native D1 export and fresh D1 import', 'every schema definition and row compared', 'applied migration identities match artifact', 'empty fresh R2 target', 'all R2 bytes and HTTP/custom metadata compared', 'byte-identical native SQL re-export before login', 'retained session authenticated media and transcript', 'fresh password login authenticated media and transcript', 'unauthenticated media refused', 'restored setup stays closed'],
    boundaries: ['local emitted Worker, D1 and R2 only', 'no provider credentials supplied or live-provider qualification', 'Durable Object storage not exported', 'not complete RER export or production recovery qualification', 'the actual complete migrated schema and every row are compared without a fixed inventory'],
  };
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({profile, sourceSha: build.sourceSha, tables: receipt.tables, migrations: receipt.migrations, objects: before.objects.length, result: 'PASS'}));
} finally {
  for (const runtime of [original, restored].filter(Boolean)) {
    await runtime.close();
    await copyFile(join(runtime.directory, 'runtime.log'), join(output, runtime === original ? 'source-runtime.log' : 'restored-runtime.log'));
    await rm(runtime.directory, {recursive: true, force: true});
  }
}
