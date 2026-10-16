import assert from 'node:assert/strict';

// Keep physical FTS pages in raw snapshots. Their segment/merge layout is not
// business state; validate the actual index against its external message rows.
const shadowRows=new WeakSet();
export const isSearchShadow=rows=>Array.isArray(rows)&&shadowRows.has(rows);
export function validateSearchIndex(native){
 const definition=native.prepare("SELECT sql FROM sqlite_master WHERE name='inbox_message_search' AND type='table'").get();
 if(!definition)return [];
 assert.match(definition.sql,/\bUSING\s+fts5\s*\(/i,'search storage is SQLite FTS5');
 // rank=1 checks missing/stale terms and rowids against the content table too,
 // rather than merely checking the index's internal B-tree consistency.
 native.prepare("INSERT INTO inbox_message_search(inbox_message_search,rank) VALUES('integrity-check',1)").run();
 return native.prepare('PRAGMA table_list').all().filter(row=>row.schema==='main'&&row.type==='shadow'&&row.name.startsWith('inbox_message_search_')).map(row=>row.name);
}
export function markSearchShadows(snapshot,names){
 for(const name of names){assert.ok(Array.isArray(snapshot[name]),'raw search storage is retained');shadowRows.add(snapshot[name]);}
}
export function assertSearchShadowEquality(before,after){
 if(!isSearchShadow(before)&&!isSearchShadow(after))return false;
 assert.ok(isSearchShadow(before)&&isSearchShadow(after),'both search snapshots passed content integrity validation');
 return true;
}

/** D1-backed observers use the same content check before retaining raw rows. */
export async function validateStoredSearch(inspect){
 const definition=(await inspect({sql:"SELECT sql FROM sqlite_master WHERE name='inbox_message_search' AND type='table'"})).results[0];
 if(!definition)return null;
 assert.match(definition.sql,/\bUSING\s+fts5\s*\(/i,'search storage is SQLite FTS5');
 await inspect({sql:"INSERT INTO inbox_message_search(inbox_message_search,rank) VALUES('integrity-check',1)"});
 const tables=(await inspect({sql:'PRAGMA table_list'})).results;
 return {table:'inbox_message_search',shadows:tables.filter(row=>row.schema==='main'&&row.type==='shadow'&&row.name.startsWith('inbox_message_search_')).map(row=>row.name)};
}
