import assert from 'node:assert/strict';
const encoded=value=>JSON.stringify(value);
/** The native D1 service advances key 2 for SELECT-only calls. No application
 * row or other platform row is excluded; the complete raw dumps are retained. */
export function assertUnchangedTable(name,before,after){
 if(name!=='_cf_METADATA'){assert.equal(encoded(after),encoded(before),`exact ordered equality: ${name}`);return null}
 const locate=rows=>{const matches=rows.filter(row=>row.key?.sqliteInteger==='2');assert.equal(matches.length,1,'exactly one documented D1 sequence row');assert.match(matches[0].value?.sqliteInteger??'',/^\d+$/);return BigInt(matches[0].value.sqliteInteger)};
 const first=locate(before),last=locate(after),delta=last-first;
 assert.equal(encoded(after.map(row=>row.key?.sqliteInteger==='2'?{...row,value:{sqliteInteger:first.toString()}}:row)),encoded(before),'all protected data other than the D1 sequence is identical');
 assert.ok(delta>=0n,'D1 sequence is monotonic');
 return {before:first.toString(),after:last.toString(),delta:delta.toString()};
}
