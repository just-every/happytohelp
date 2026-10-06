import {DatabaseSync} from 'node:sqlite';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

export async function findDatabase(directory) {
  const found = [];
  async function visit(path) {
    for (const entry of await readdir(path, {withFileTypes: true})) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.name.endsWith('.sqlite') && !entry.name.includes('metadata')) found.push(child);
    }
  }
  await visit(directory);
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
// Compare original column storage types and exact values, including NUL text,
// blobs, 64-bit integers and IEEE-754 doubles. Added columns have no old value.
export function snapshot(filename, baseline) {
  const db = new DatabaseSync(filename, {readOnly: true});
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name").all();
    const result = {};
    for (const {name} of tables) {
      const columns = baseline?.[name]?.columns ?? db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(c => c.name);
      const statement = db.prepare(`SELECT ${columns.flatMap((c, i) => [`${quote(c)} AS v${i}`, `typeof(${quote(c)}) AS t${i}`]).join(',')} FROM ${quote(name)}`);
      statement.setReadBigInts(true);
      const rows = statement.all().map(row => JSON.stringify(columns.map((c, i) => encode(row[`v${i}`], row[`t${i}`])))).sort();
      result[name] = {columns, rows, rowCount: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
    }
    return result;
  } finally { db.close(); }
}
