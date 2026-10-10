import { createHash } from 'node:crypto';
import { lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join,dirname } from 'node:path';

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
export function validateArtifact(raw, expectedDigest, payloads) {
  if (raw.length > 200 * 1024 * 1024 || digest(raw) !== expectedDigest) fail();
  const artifact = JSON.parse(raw);
  if (artifact.schema !== 2 || artifact.mainModule !== 'index.js') fail();
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
  const collected = [], payloadNames = new Set(); let totalBytes=0;
  for (const [kind, files] of [['modules', artifact.modules], ['assets', artifact.assets]]) {
    if (!Array.isArray(files) || !files.length || files.length > 20000) fail();
    const seen = new Set();
    for (const file of files) {
      const path = safePath(kind === 'modules' ? file.name : file.path?.slice(1));
      if (kind === 'assets' && !file.path.startsWith('/')) fail();
      if (kind === 'modules' && (file.type !== (path.endsWith('.js') ? 'esm' : path.endsWith('.wasm') ? 'compiled-wasm' : 'text'))) fail();
      if (seen.has(path)) fail();
      seen.add(path);
      if (!/^payload\/(modules|assets)\/[0-9]{6}$/.test(file.payload) || !file.payload.startsWith(`payload/${kind}/`) ||
          file.role !== (kind === 'modules' ? 'module' : 'asset') || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 25 * 1024 * 1024 ||
          !/^[a-f0-9]{64}$/.test(file.sha256) || 'contentBase64' in file) fail();
      if(payloadNames.has(file.payload))fail();payloadNames.add(file.payload);
      totalBytes+=file.size;if(totalBytes>200*1024*1024)fail();
      const content = payloads?.get(file.payload);
      if (!Buffer.isBuffer(content) || content.length !== file.size || digest(content) !== file.sha256) fail();
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
  const raw = await readFile(file);
  if (digest(raw) !== expectedDigest) fail();
  const manifest = JSON.parse(raw), payloads = new Map(); let total = 0;
  for (const entry of [...(manifest.modules || []), ...(manifest.assets || [])]) {
    if (typeof entry.payload !== 'string' || !/^payload\/(modules|assets)\/[0-9]{6}$/.test(entry.payload) || payloads.has(entry.payload)) fail();
    let path = dirname(file);
    const parts = entry.payload.split('/');
    for (const [i,part] of parts.entries()) {
      path = join(path,part); const info = await lstat(path);
      if (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile())) fail();
      if (i === parts.length - 1 && (info.size !== entry.size || info.size > 25 * 1024 * 1024)) fail();
    }
    const content = await readFile(path); total += content.length;
    if (total > 200 * 1024 * 1024) fail(); payloads.set(entry.payload,content);
  }
  const collected = validateArtifact(raw, expectedDigest, payloads);
  // output is a new private directory created by the controller, never extracted
  // from an archive. There are no build-supplied links or configuration files.
  for (const entry of collected) {
    const destination = join(output, entry.path);
    await mkdir(join(destination, '..'), {recursive:true});
    await writeFile(destination, entry.bytes, {flag:'wx',mode:0o600});
  }
}
