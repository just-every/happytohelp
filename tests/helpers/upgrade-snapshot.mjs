import {DatabaseSync} from 'node:sqlite';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

async function sqliteFiles(directory) {
  const found = [];
  async function visit(path) {
    for (const entry of await readdir(path, {withFileTypes: true})) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.name.endsWith('.sqlite') && !entry.name.includes('metadata')) found.push(child);
    }
  }
  await visit(directory);
  return found;
}
export async function findDatabase(directory) {
  const found = await sqliteFiles(directory);
  if (found.length !== 1) throw new Error(`Expected one D1 database, found ${found.length}`);
  return found[0];
}
const quote = name => '"' + name.replaceAll('"', '""') + '"';
function encode(value, type) {
  if (type === 'null') return ['null'];
  if (type === 'integer') return [type, value.toString()];
  if (type === 'real') { const bytes = Buffer.alloc(8); bytes.writeDoubleBE(value); return [type, bytes.toString('hex')]; }
  return [type, Buffer.from(value).toString('hex')];
}
// The same byte/storage-type encoding is used for original and expected rows.
export function snapshotTable(db, name, columns) {
  const statement = db.prepare(`SELECT ${columns.flatMap((c, i) => [`${quote(c)} AS v${i}`, `typeof(${quote(c)}) AS t${i}`]).join(',')} FROM ${quote(name)}`);
  statement.setReadBigInts(true);
  const rows = statement.all().map(row => JSON.stringify(columns.map((c, i) => encode(row[`v${i}`], row[`t${i}`])))).sort();
  return {columns, rows, rowCount: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
}
// Compare original column storage types and exact values, including NUL text,
// blobs, 64-bit integers and IEEE-754 doubles. Added columns have no old value.
export function snapshot(filename, baseline) {
  const db = new DatabaseSync(filename, {readOnly: true});
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name").all();
    const result = {};
    for (const {name} of tables) {
      const columns = baseline?.[name]?.columns ?? db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(c => c.name);
      result[name] = snapshotTable(db, name, columns);
    }
    return result;
  } finally { db.close(); }
}
// Every table, index, trigger and view definition, keyed by name.
export function schema(filename) {
  const db = new DatabaseSync(filename, {readOnly: true});
  try { return Object.fromEntries(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name").all().map(row => [row.name, {...row}])); }
  finally { db.close(); }
}
// Local R2: Miniflare's object index plus the sha256 of every stored blob.
export async function bucketSnapshot(directory) {
  const objects = [], blobs = [];
  for (const file of await sqliteFiles(directory)) {
    const db = new DatabaseSync(file, {readOnly: true});
    try { objects.push(...db.prepare('SELECT key,blob_id,version,size,etag,uploaded,http_metadata,custom_metadata FROM _mf_objects ORDER BY key').all().map(row => JSON.stringify(row))); }
    finally { db.close(); }
  }
  async function visit(path) {
    for (const entry of await readdir(path, {withFileTypes: true})) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (path.endsWith('blobs')) blobs.push(createHash('sha256').update(await readFile(child)).digest('hex'));
    }
  }
  await visit(directory);
  return {objects: objects.sort(), blobs: blobs.sort()};
}
