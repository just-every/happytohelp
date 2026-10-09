import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, mkdir, readFile, writeFile, copyFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {collectMigrations} from '../scripts/migrations.mjs';
import {findDatabase, snapshot} from './helpers/upgrade-snapshot.mjs';
import {expectedMigrationRows, migrationExceptions} from './helpers/upgrade-exceptions.mjs';

const run = promisify(execFile);
const root = resolve(new URL('..', import.meta.url).pathname);
const baselineSha = '59c6e2e1beb321e9f1cb5493efd05e20fc068638';
const directory = await mkdtemp(join(tmpdir(), 'h2h-upgrade-021-'));
const archive = join(directory, 'source.tar'), source = join(directory, 'source');
const evidence = process.env.H2H_EVIDENCE_DIR || directory;
await mkdir(source); await mkdir(evidence, {recursive: true});
const command = async (file, args, cwd = source) => {
  try { const result = await run(file, args, {cwd, maxBuffer: 32 * 1024 * 1024}); return result.stdout; }
  catch (error) { console.error(error.stdout, error.stderr); throw error; }
};
let runtime, stopped = false, success = false;
try {
  await command('git', ['archive', '--format=tar', '--output=' + archive, baselineSha], root);
  await command('tar', ['-xf', archive, '-C', source]);
  await command('pnpm', ['install', '--frozen-lockfile']);
  await command('pnpm', ['run', 'build']);
  const {createRuntime} = await import(pathToFileURL(join(source, 'tests/helpers/emitted-runtime.mjs')));
  runtime = await createRuntime();
  assert.equal(runtime.migrationCount, 37);
  const call = async (path, body, token, headers = {}) => {
    const response = await fetch(runtime.origin + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    const value = await response.json();
    assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  };
  // Genuine v0.2.1 setup and journey API writes, with no direct fixture INSERTs.
  const owner = await call('/api/identity/bootstrap', {name: 'Upgrade owner workspace', email: 'upgrade@example.test', password: 'upgrade-proof-password-2026', allowedOrigin: runtime.origin});
  const project = await call(`/api/identity/projects/${owner.projectId}`, undefined, owner.token);
  const visitor = await call('/api/identity/widget/session', {widgetKey: project.widget_key, name: 'Upgrade customer', email: 'customer@example.test'}, undefined, {Origin: runtime.origin});
  const conversation = await call('/api/conversations', {projectId: owner.projectId}, visitor.token);
  await call(`/api/conversations/${conversation.id}/messages`, {localId: 'upgrade-customer-message', content: 'Retain this exact transcript through upgrade.', expectedRevision: 0}, visitor.token);
  await call(`/api/knowledge/${owner.projectId}/articles`, {title: 'Upgrade knowledge', slug: 'upgrade-knowledge', content: 'Retain this published article through upgrade.', status: 'published'}, owner.token);
  await runtime.close(false); stopped = true;
  const database = await findDatabase(join(runtime.directory, 'state/v3/d1'));
  const before = snapshot(database);
  assert.equal(Object.keys(before).length, 97);
  for (const table of ['projects', 'users', 'memberships', 'sessions', 'contacts', 'conversations', 'messages', 'knowledge_articles']) assert.ok(before[table].rows.length > 0, `${table} must contain real journey rows`);
  const headMigrations = await collectMigrations();
  for (const name of JSON.parse(await command(process.execPath, ['scripts/migrations.mjs'])).files) {
    assert.equal(await readFile(join(source, '.generated/migrations', name), 'utf8'), await readFile(join(headMigrations.directory, name), 'utf8'), `Applied migration changed: ${name}`);
  }
  for (const name of headMigrations.files) await copyFile(join(headMigrations.directory, name), join(runtime.directory, 'migrations', name));
  await command(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'migrations', 'apply', 'DB', '--local', '--config', join(runtime.directory, 'wrangler.json'), '--persist-to', join(runtime.directory, 'state')], runtime.directory);
  const after = snapshot(database, before);
  const expected = expectedMigrationRows(before, after, headMigrations.files);
  const comparison = Object.entries(before).map(([table, value]) => ({table, columns: value.columns, beforeRows: value.rowCount, afterRows: after[table]?.rowCount, beforeSha256: value.sha256, afterSha256: after[table]?.sha256, identical: JSON.stringify(value.rows) === JSON.stringify(after[table]?.rows), matchesExpected: JSON.stringify(expected[table] ?? value.rows) === JSON.stringify(after[table]?.rows), ...(JSON.stringify(value.rows) === JSON.stringify(after[table]?.rows) ? {} : {removedRows: value.rows.filter(row => !after[table]?.rows.includes(row)), addedRows: after[table]?.rows.filter(row => !value.rows.includes(row))})}));
  const failures = comparison.filter(row => !row.matchesExpected);
  const receipt = {baselineSha, sourceSha: (await command('git', ['rev-parse', 'HEAD'], root)).trim(), baselineTables: 97, baselineMigrations: runtime.migrationCount, finalTables: Object.keys(after).length, finalMigrations: after.d1_migrations.rowCount, migrationNames: headMigrations.files, database, originalColumnsOnly: true, migrationLedger: 'd1_migrations intentionally appends applied migration rows; compared separately', comparison: comparison.filter(row => row.table !== 'd1_migrations'), failures: failures.filter(row => row.table !== 'd1_migrations').map(row => row.table)};
  receipt.migrationExceptions = migrationExceptions;
  await writeFile(join(evidence, 'upgrade.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`v0.2.1: 97 tables / 37 migrations; head: ${receipt.finalTables} tables / ${receipt.finalMigrations} migrations`);
  console.log(`Row comparison: ${receipt.comparison.filter(row => row.identical).length}/${receipt.comparison.length} original application tables identical; evidence: ${join(evidence, 'upgrade.json')}`);
  console.log(`Expected migration transformations: ${receipt.comparison.filter(row => row.matchesExpected).length}/${receipt.comparison.length} tables passed`);
  assert.equal(receipt.finalMigrations, headMigrations.files.length);
  assert.deepEqual(receipt.failures, [], 'Pre-existing application rows changed outside exact migration exceptions');
  success = true;
} finally {
  if (runtime && !stopped) await runtime.close(false);
  if (success) await rm(directory, {recursive: true, force: true});
  else console.error('Upgrade failure evidence retained:', directory);
}
