import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareSnapshots, snapshot} from './helpers/recovery/snapshot.mjs';

const state = () => ({schema: [{type: 'table', name: 'messages', sql: 'CREATE TABLE messages(id TEXT, content TEXT)'}], rows: {messages: ['{"content":"unchanged","id":"m1"}']}, objects: [{key: 'media', bytes: [0, 255], httpMetadata: {contentType: 'application/octet-stream'}, customMetadata: {owner: 'fixture'}}]});
for (const [name, corrupt] of [
  ['missing row', value => {value.rows.messages.pop()}],
  ['same count changed row', value => {value.rows.messages[0] = '{"content":"corrupt","id":"m1"}'}],
  ['missing table', value => {delete value.rows.messages}],
  ['changed schema', value => {value.schema[0].sql += ' changed'}],
  ['same size changed R2 bytes', value => {value.objects[0].bytes[0] = 1}],
  ['changed R2 HTTP metadata', value => {value.objects[0].httpMetadata.contentType = 'text/plain'}],
  ['changed R2 custom metadata', value => {value.objects[0].customMetadata.owner = 'other'}],
  ['extra R2 object', value => {value.objects.push({...value.objects[0], key: 'extra'})}],
]) test(`comparison refuses ${name}`, () => {
  const after = state();
  corrupt(after);
  assert.throws(() => compareSnapshots(state(), after), assert.AssertionError);
});
test('comparison accepts exact independent snapshots', () => compareSnapshots(state(), state()));
test('snapshot follows every R2 page and canonicalizes unordered rows', async () => {
  const calls = [];
  const stored = {first: {key: 'first', bytes: [], httpMetadata: {}, customMetadata: {}}, second: {key: 'second', bytes: [1], httpMetadata: {}, customMetadata: {}}};
  const result = await snapshot({inspect: async request => {
    calls.push(request);
    if (request.sql?.includes('sqlite_master')) return {results: [{type: 'table', name: 'records', sql: 'CREATE TABLE records(id)'}]};
    if (request.sql) return {results: [{z: 2, a: 1}, {a: 0, z: 3}]};
    if (request.list) return request.list.cursor ? {objects: [{key: 'second'}], truncated: false} : {objects: [{key: 'first'}], truncated: true, cursor: 'next'};
    return stored[request.key];
  }});
  assert.deepEqual(result.rows.records, ['{"a":0,"z":3}', '{"a":1,"z":2}']);
  assert.deepEqual(result.objects, [stored.first, stored.second]);
  assert.equal(calls.filter(request => request.list).length, 2);
});
