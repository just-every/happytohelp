import { createHash } from 'node:crypto';
import { lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = () => { throw new Error('invalid-artifact'); };
const equal = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
export function safePath(value) {
  if (typeof value !== 'string' || value.length > 240 ||
      !/^[A-Za-z0-9_./@+()-]+$/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..' ||
        /^(?:\.git|\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.yarnrc(?:\.yml)?|\.netrc|\.pypirc)$/i.test(p)) ||
      /(?:^|\/)(?:package\.json|wrangler\.[^/]+|node_modules)(?:\/|$)/i.test(value)) fail();
  return value;
}
function bytes(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(25 * 1024 * 1024 / 3) * 4) fail();
  const data = Buffer.from(value, 'base64');
  // Canonical round-trip rejects forgiving decoder inputs without a repeated
  // regex whose engine stack can overflow on real multi-megabyte assets.
  if (data.length > 25 * 1024 * 1024 || data.toString('base64') !== value) fail();
  return data;
}
export function validateArtifact(raw, expectedDigest) {
  if (raw.length > 200 * 1024 * 1024 || digest(raw) !== expectedDigest) fail();
  const artifact = JSON.parse(raw);
  if (artifact.schema !== 1 || artifact.mainModule !== 'index.js') fail();
  const spec = artifact.deploymentSpec;
  // This adapter supports the documented native H2H topology. An added binding
  // or changed execution contract needs a reviewed controller change.
  if (!spec || spec.schema !== 1 || spec.compatibilityDate !== '2026-09-08' ||
      !equal(spec.compatibilityFlags, ['nodejs_compat']) ||
      !equal(spec.resources, [{kind:'d1',binding:'DB'},{kind:'r2',binding:'FILES'},{kind:'queue',binding:'JOBS'},{kind:'queue',binding:'JOBS_DEAD_LETTER'}]) ||
      !equal(spec.durableObjects, [{binding:'CONVERSATIONS',className:'ConversationSocket'}]) ||
      !equal(spec.durableObjectMigrations, [{tag:'v1',newSqliteClasses:['ConversationSocket']}]) ||
      !equal(spec.schedules, ['* * * * *']) ||
      !equal(spec.queueConsumers, [{binding:'JOBS',maxBatchSize:1,maxBatchTimeout:5,maxRetries:0,deadLetterBinding:'JOBS_DEAD_LETTER'}]) ||
      !equal(spec.publicVariables, {}) || spec.healthPath !== '/health') fail();
  const collected = [];
  for (const [kind, files] of [['modules', artifact.modules], ['assets', artifact.assets]]) {
    if (!Array.isArray(files) || !files.length || files.length > 20000) fail();
    const seen = new Set();
    for (const file of files) {
      const path = safePath(kind === 'modules' ? file.name : file.path?.slice(1));
      if (kind === 'assets' && !file.path.startsWith('/')) fail();
      if (kind === 'modules' && (file.type !== (path.endsWith('.js') ? 'esm' : path.endsWith('.wasm') ? 'compiled-wasm' : 'text'))) fail();
      if (seen.has(path)) fail();
      seen.add(path);
      const content = bytes(file.contentBase64);
      // A source-generated ignore file may not change which approved assets
      // Wrangler publishes. Asset inclusion belongs to this controller.
      if (kind !== 'assets' || path !== '.assetsignore') collected.push({path: `${kind}/${path}`, bytes: content});
    }
    if (kind === 'modules' && !seen.has('index.js')) fail();
  }
  if (!Array.isArray(spec.migrations) || !spec.migrations.length || spec.migrations.length > 1000) fail();
  const names = new Set();
  for (const migration of spec.migrations) {
    if (migration.binding !== 'DB' || !/^[0-9][A-Za-z0-9_.-]*\.sql$/.test(migration.name) ||
        names.has(migration.name) || typeof migration.sql !== 'string' || Buffer.byteLength(migration.sql) > 2 * 1024 * 1024 ||
        digest(migration.sql) !== migration.sha256) fail();
    names.add(migration.name);
    collected.push({path: `migrations/${migration.name}`, bytes: Buffer.from(migration.sql)});
  }
  return collected;
}
export async function materializeArtifact(file, output, expectedDigest) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.size > 200 * 1024 * 1024) fail();
  const collected = validateArtifact(await readFile(file), expectedDigest);
  // output is a new private directory created by the controller, never extracted
  // from an archive. There are no build-supplied links or configuration files.
  for (const entry of collected) {
    const destination = join(output, entry.path);
    await mkdir(join(destination, '..'), {recursive:true});
    await writeFile(destination, entry.bytes, {flag:'wx',mode:0o600});
  }
}
