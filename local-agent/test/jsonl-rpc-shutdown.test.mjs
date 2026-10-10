import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonlRpc } from '../lib/jsonl-rpc.mjs';
import { waitForExit } from '../lib/util.mjs';

function trackTimers(t) {
  const active = new Set(), start = globalThis.setTimeout, cancel = globalThis.clearTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = start(() => { active.delete(timer); callback(...args); }, delay);
    active.add(timer);
    return timer;
  });
  t.mock.method(globalThis, 'clearTimeout', timer => { active.delete(timer); cancel(timer); });
  return active;
}

async function fixture(mode) {
  const directory = await mkdtemp(join(tmpdir(), 'h2h-shutdown-'));
  const path = join(directory, 'receipt.jsonl');
  const rpc = new JsonlRpc(process.execPath, [new URL('./fixtures/shutdown-child.mjs', import.meta.url).pathname, mode, path]);
  try { assert.deepEqual(await rpc.request('ping', {}), { ready: true }); }
  catch (error) { await rpc.close(); await rm(directory, { recursive: true, force: true }); throw error; }
  return { rpc, async receipt() { return (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse); }, async cleanup() {
    await rpc.close();
    await rm(directory, { recursive: true, force: true });
  } };
}

test('EOF permits a delayed native clean exit without signals and clears pending RPC/shutdown timers', { timeout: 20_000 }, async t => {
  const active = trackTimers(t), child = await fixture('delayed');
  try {
    const pending = assert.rejects(child.rpc.request('still-pending', {}, 60_000), /app-server is closing/);
    const first = child.rpc.close();
    assert.equal(child.rpc.close(), first, 'concurrent close callers share the same shutdown');
    await first;
    await pending;
    await assert.rejects(child.rpc.request('after-close', {}), /app-server is closing/);
    assert.equal(child.rpc.child.exitCode, 0);
    assert.equal(child.rpc.child.signalCode, null);
    const receipt = await child.receipt();
    assert.deepEqual(receipt.map(entry => entry.event), ['EOF', 'flushed']);
    assert.ok(receipt[1].at - receipt[0].at >= 1400, 'the native process completed work beyond the old one-second window');
    assert.equal(child.rpc.pending.size, 0);
    assert.equal(child.rpc.child.listenerCount('exit'), 0);
    assert.equal(active.size, 0, 'no pending request or shutdown deadline keeps the connector alive');
  } finally { await child.cleanup(); }
});

test('a native process that ignores EOF and SIGTERM is killed only after the bounded graceful window', { timeout: 25_000 }, async t => {
  const active = trackTimers(t), child = await fixture('stubborn');
  try {
    const started = Date.now();
    await child.rpc.close();
    const elapsed = Date.now() - started;
    const receipt = await child.receipt();
    assert.deepEqual(receipt.map(entry => entry.event), ['EOF', 'SIGTERM']);
    assert.ok(receipt[1].at - started >= 9900, 'SIGTERM follows ten seconds after graceful shutdown was requested');
    assert.ok(elapsed >= 10_900 && elapsed < 20_000, 'forced termination remains bounded');
    assert.equal(child.rpc.child.exitCode, null);
    assert.equal(child.rpc.child.signalCode, 'SIGKILL');
    assert.equal(child.rpc.child.listenerCount('exit'), 0);
    assert.equal(active.size, 0, 'expired and completed shutdown deadlines are removed');
  } finally { await child.cleanup(); }
});

test('an expired exit wait removes its listener and deadline before another wait', async t => {
  const active = trackTimers(t), child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
  assert.equal(await waitForExit(child, 5), null);
  assert.equal(child.listenerCount('exit'), 0);
  assert.equal(active.size, 0);
  const result = waitForExit(child, 1000);
  child.emit('exit', 0, null);
  assert.deepEqual(await result, { code: 0, signal: null });
  assert.equal(child.listenerCount('exit'), 0);
  assert.equal(active.size, 0);
});
