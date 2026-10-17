import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Raw attachment bytes are capped at 256 MiB in aggregate; the complete JSON
// bundle is capped at 512 MiB. The caller must also cap its file before parsing.
export const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;
export const DEFAULT_MAX_JSON_BYTES = 512 * 1024 * 1024;
const supportedDisks = new Set(['s3', 'public']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function identifier(value, label) {
  if (!['string', 'number'].includes(typeof value) || !String(value).trim()) throw new Error(`Missing ${label}`);
  return String(value);
}

export function relativeKey(key) {
  if (typeof key !== 'string' || !key || /[\\\x00-\x1f\x7f]/.test(key) || path.posix.isAbsolute(key)
    || /^[A-Za-z]:/.test(key) || key.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid attachment source key');
  }
  return key;
}

function keySegment(value) {
  return encodeURIComponent(value).replace(/\./g, '%2E');
}

/** Enrich already project-scoped rows without replacing original columns. */
export function enrichMedia(tables) {
  if (!tables || typeof tables !== 'object') throw new Error('Missing legacy tables');
  const media = tables.media ?? [];
  if (!Array.isArray(media)) throw new Error('Invalid media table');
  if (!media.length) return [];
  if (!Array.isArray(tables.projects) || tables.projects.length !== 1) throw new Error('Attachments require exactly one scoped project');
  const projectId = identifier(tables.projects[0].id, 'project id');
  const seen = new Set();
  const entries = media.map(row => {
    const mediaId = identifier(row.id, 'media id');
    if (seen.has(mediaId)) throw new Error('Duplicate media id');
    seen.add(mediaId);
    if (row.project_id != null && String(row.project_id) !== projectId) throw new Error('Media belongs to another project');
    if (!supportedDisks.has(row.disk)) throw new Error(`Unsupported media disk: ${String(row.disk)}`);
    if (typeof row.filename !== 'string' || !row.filename || /[/\\\x00]/.test(row.filename)) throw new Error('Invalid media filename');
    const extension = row.extension ?? '';
    if (typeof extension !== 'string' || /[/\\\x00]/.test(extension)) throw new Error('Invalid media extension');
    if (row.directory != null && typeof row.directory !== 'string') throw new Error('Invalid media directory');
    // Plank Mediable stores the stem and extension separately; getDiskPath()
    // joins directory with that basename and trims its outside slashes.
    const basename = row.filename + (extension ? `.${extension}` : '');
    const sourceKey = relativeKey(`${row.directory || ''}/${basename}`.replace(/^\/+|\/+$/g, ''));
    const key = `legacy/projects/${keySegment(projectId)}/media/${keySegment(mediaId)}`;
    return { row, basename, entry: { key, disk: row.disk, sourceKey, mediaId } };
  });
  for (const { row, basename, entry } of entries) {
    row.object_key = entry.key;
    if (!row.original_filename) row.original_filename = row.filename_original || basename;
  }
  return entries.map(({ entry }) => entry);
}

function positiveLimit(value, fallback, label) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`Invalid ${label}`);
  return result;
}

export function mediaSize(row) {
  if (typeof row.size !== 'number' && (typeof row.size !== 'string' || !/^\d+$/.test(row.size))) throw new Error('Missing or invalid media byte size');
  const size = Number(row.size);
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid media byte size');
  return size;
}

// Count JSON without constructing a second copy of the complete bundle.
function jsonBytes(value, limit) {
  let size = 0;
  const ancestors = new Set();
  function add(count) {
    size += count;
    if (size > limit) throw new Error('Attachment bundle exceeds maxJsonBytes');
  }
  function visit(item) {
    if (item === null) return add(4);
    if (typeof item === 'string') {
      add(2 + Buffer.byteLength(item));
      for (let i = 0; i < item.length; i++) {
        const code = item.charCodeAt(i);
        if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code)) add(1);
        else if (code < 32) add(5);
        else if (code >= 0xd800 && code <= 0xdbff && item.charCodeAt(i + 1) >= 0xdc00 && item.charCodeAt(i + 1) <= 0xdfff) i++;
        else if (code >= 0xd800 && code <= 0xdfff) add(3);
      }
      return;
    }
    if (typeof item === 'boolean') return add(item ? 4 : 5);
    if (typeof item === 'number' && Number.isFinite(item)) return add(String(item).length);
    if (typeof item !== 'object' || ancestors.has(item)) throw new Error('Bundle must contain acyclic JSON values');
    ancestors.add(item);
    add(2);
    const entries = Array.isArray(item) ? item : Object.entries(item);
    for (let i = 0; i < entries.length; i++) {
      if (i) add(1);
      if (Array.isArray(item)) visit(entries[i]);
      else { visit(entries[i][0]); add(1); visit(entries[i][1]); }
    }
    ancestors.delete(item);
  }
  visit(value);
  return size;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function localBytes(root, sourceKey, expectedSize) {
  const target = await realpath(path.join(root, relativeKey(sourceKey)));
  if (!inside(root, target)) throw new Error('Attachment path escapes directory');
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== expectedSize) throw new Error('Attachment file type or size mismatch');
    // Read exactly the declared bytes, then probe once for growth. readFile()
    // would allocate without a limit if a file grew after stat().
    const bytes = Buffer.alloc(expectedSize);
    let offset = 0;
    while (offset < expectedSize) {
      const read = await file.read(bytes, offset, Math.min(1024 * 1024, expectedSize - offset), offset);
      if (!read.bytesRead) throw new Error('Attachment size changed during read');
      offset += read.bytesRead;
    }
    const extra = await file.read(Buffer.alloc(1), 0, 1, offset);
    if (extra.bytesRead || (await file.stat()).size !== expectedSize) throw new Error('Attachment size changed during read');
    return bytes;
  } finally { await file.close(); }
}

export function s3Environment(bucket, region) {
  if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes('..')) throw new Error('An explicit S3 bucket name is required');
  if (typeof region !== 'string' || !/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region)) throw new Error('An explicit AWS region is required');
  const access = process.env.LEGACY_AWS_ACCESS_KEY_ID;
  const secret = process.env.LEGACY_AWS_SECRET_ACCESS_KEY;
  if (!access || !secret) throw new Error('S3 reads require explicit LEGACY_AWS_ACCESS_KEY_ID and LEGACY_AWS_SECRET_ACCESS_KEY');
  // Deliberately do not inherit profiles, endpoints, credential providers,
  // proxies, CLI plugins, or the caller's AWS configuration.
  return {
    PATH: process.env.PATH || '/usr/bin:/bin',
    AWS_ACCESS_KEY_ID: access, AWS_SECRET_ACCESS_KEY: secret,
    ...(process.env.LEGACY_AWS_SESSION_TOKEN ? { AWS_SESSION_TOKEN: process.env.LEGACY_AWS_SESSION_TOKEN } : {}),
    AWS_REGION: region, AWS_DEFAULT_REGION: region,
    AWS_CONFIG_FILE: '/dev/null', AWS_SHARED_CREDENTIALS_FILE: '/dev/null',
    AWS_EC2_METADATA_DISABLED: 'true', AWS_MAX_ATTEMPTS: '1',
    AWS_CLI_AUTO_PROMPT: 'off', AWS_PAGER: '',
  };
}

function s3Bytes(entry, options, environment, expectedSize) {
  if (entry.disk !== 's3') throw new Error('The public media disk requires a local directory');
  const suffix = options.region.startsWith('cn-') ? 'amazonaws.com.cn' : 'amazonaws.com';
  return new Promise((resolve, reject) => {
    // Keep payload bytes on a dedicated descriptor. Discard metadata and error
    // output so CLI diagnostics cannot echo sensitive configuration.
    const child = spawn('aws', [
      '--no-cli-pager', '--no-cli-auto-prompt', '--region', options.region,
      '--endpoint-url', `https://s3.${options.region}.${suffix}`,
      '--cli-connect-timeout', '30', '--cli-read-timeout', '60',
      's3api', 'get-object', '--bucket', options.bucket, '--key', entry.sourceKey,
      '/dev/fd/3',
    ], { env: environment, stdio: ['ignore', 'ignore', 'ignore', 'pipe'] });
    const chunks = [];
    let size = 0;
    let failure;
    const timer = setTimeout(() => {
      failure = new Error('S3 attachment read timed out');
      child.kill('SIGKILL');
    }, 5 * 60 * 1000);
    child.stdio[3].on('data', chunk => {
      size += chunk.length;
      if (size > expectedSize) {
        failure = new Error('S3 attachment exceeds declared byte size');
        child.kill('SIGKILL');
      } else chunks.push(chunk);
    });
    child.stdio[3].on('error', () => {
      failure = new Error('S3 attachment payload stream failed');
      child.kill('SIGKILL');
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('Could not execute AWS CLI for attachment read'));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error('S3 attachment read failed (AWS CLI output suppressed)'));
      else if (size !== expectedSize) reject(new Error('S3 attachment byte size mismatch'));
      else resolve(Buffer.concat(chunks, size));
    });
  });
}

/** Return complete bytes for every media row, including archive-only media.
 * directory is a pre-copied disk root with the original bucket key tree.
 * Without directory, only s3 disks are accepted and credentials must come from
 * LEGACY_AWS_* variables. This module never writes a partial export or cache.
 */
export async function hydrateObjects(bundle, options = {}) {
  const maxBytes = positiveLimit(options.maxBytes, DEFAULT_MAX_BYTES, 'maxBytes');
  const maxJsonBytes = positiveLimit(options.maxJsonBytes, DEFAULT_MAX_JSON_BYTES, 'maxJsonBytes');
  jsonBytes(bundle, maxJsonBytes);
  const manifest = enrichMedia(bundle.tables);
  const supplied = bundle.source?.attachments;
  if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length !== manifest.length
    || supplied.some((entry, index) => !entry || ['key', 'disk', 'sourceKey', 'mediaId'].some(field => entry[field] !== manifest[index][field])))) {
    throw new Error('Attachment manifest differs from scoped media');
  }
  const sizes = bundle.tables.media?.map(mediaSize) ?? [];
  let total = 0;
  for (const size of sizes) {
    total += size;
    if (total > maxBytes) throw new Error('Attachments exceed maxBytes');
  }
  const result = { ...bundle, objects: [] };
  let jsonSize = jsonBytes(result, maxJsonBytes);
  // Refuse a bundle that cannot fit before reading any object bytes.
  for (const [index, entry] of manifest.entries()) {
    jsonSize += jsonBytes({ key: entry.key, dataBase64: '', sha256: '0'.repeat(64) }, maxJsonBytes)
      + 4 * Math.ceil(sizes[index] / 3) + (index ? 1 : 0);
    if (jsonSize > maxJsonBytes) throw new Error('Attachment bundle exceeds maxJsonBytes');
  }
  if (!manifest.length) return result;
  let root;
  if (options.directory !== undefined) {
    if (typeof options.directory !== 'string' || !options.directory) throw new Error('Invalid attachment directory');
    root = await realpath(options.directory);
  }
  const environment = root === undefined ? s3Environment(options.bucket, options.region) : undefined;
  if (!root && manifest.some(entry => entry.disk !== 's3')) throw new Error('The public media disk requires a local directory');
  for (const [index, entry] of manifest.entries()) {
    const bytes = root === undefined
      ? await s3Bytes(entry, options, environment, sizes[index])
      : await localBytes(root, entry.sourceKey, sizes[index]);
    const sha256 = digest(bytes);
    const expectedHash = bundle.tables.media[index].sha256;
    if (expectedHash != null && expectedHash !== sha256) throw new Error('Attachment SHA-256 differs from media row');
    result.objects.push({ key: entry.key, dataBase64: bytes.toString('base64'), sha256 });
  }
  return result;
}
