import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateStoredSearch,markSearchShadows,assertSearchShadowEquality} from '../search-index.mjs';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRow = row => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])));

export async function snapshot(storage) {
  const search=await validateStoredSearch(storage.inspect);
  const schema = (await storage.inspect({sql: "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE '_cf_%' ORDER BY type,name"})).results;
  const rows = {};
  for (const table of schema.filter(entry => entry.type === 'table')) {
    rows[table.name] = (await storage.inspect({sql: `SELECT * FROM "${table.name.replaceAll('"', '""')}"`})).results.map(canonicalRow).sort();
  }
  const objects = [];
  let cursor;
  do {
    const page = await storage.inspect({list: {limit: 2, ...(cursor ? {cursor} : {})}});
    for (const object of page.objects) objects.push(await storage.inspect({key: object.key}));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  objects.sort((a, b) => a.key.localeCompare(b.key));
  if(search)markSearchShadows(rows,search.shadows);
  return {schema, rows, objects};
}

export function compareSnapshots(before, after) {
  assert.deepEqual(after.schema, before.schema, 'Restored schema differs');
  assert.deepEqual(Object.keys(after.rows), Object.keys(before.rows), 'Restored table inventory differs');
  for (const name of Object.keys(before.rows)) if(!assertSearchShadowEquality(before.rows[name],after.rows[name]))assert.deepEqual(after.rows[name], before.rows[name], `Restored rows differ: ${name}`);
  assert.deepEqual(after.objects, before.objects, 'R2 object inventory, bytes or metadata differs');
}

export function summarize(state) {
  return {
    schemaSha256: sha256(JSON.stringify(state.schema)),
    tables: Object.entries(state.rows).map(([name, rows]) => ({name, rows: rows.length, sha256: sha256(JSON.stringify(rows))})),
    objects: state.objects.map(({key, bytes, httpMetadata, customMetadata}) => ({key, size: bytes.length, sha256: sha256(Buffer.from(bytes)), httpMetadata, customMetadata})),
  };
}
