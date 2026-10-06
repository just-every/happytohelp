import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { digest, Journal, readJournal, safeText } from './custody.mjs';
import { validateTiming } from './verify.mjs';
import { logOutput, launch, stop } from './processes.mjs';

function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 't022-recorder-selfcheck-'));
  t.after(() => rmSync(directory, { recursive: true, force: true })); return directory;
}

test('continuous clock includes owner password time and disallows overwritten attempts', t => {
  const path = join(temporary(t), 'transcript.jsonl');
  let ms = 0;
  const journal = new Journal(path, () => ({ utc: Date.UTC(2026, 9, 6) + ms, mono: BigInt(ms) * 1_000_000n }));
  journal.append('recording-start'); journal.append('redaction-begin');
  for (let n = 0; n < 45; n++) { ms += 1000; journal.append('heartbeat'); }
  journal.append('redaction-end'); journal.append('first-cited-answer'); journal.close();
  const records = readJournal(path);
  assert.equal(records.at(-1).elapsedNs, '45000000000');
  assert.equal(records.at(-1).wallElapsedMs, 45000);
  assert.throws(() => new Journal(path), /EEXIST/);
  const changed = readFileSync(path, 'utf8').replace('45000000000', '1000000000');
  writeFileSync(path, changed);
  assert.throws(() => readJournal(path), /hash chain/);
});

test('sleep/wall clock jump and heartbeat gap invalidate recorded time', t => {
  for (const variant of ['wall', 'gap']) {
    const path = join(temporary(t), 'transcript.jsonl');
    let utc = 0, mono = 0n;
    const journal = new Journal(path, () => ({ utc, mono })); journal.append('start');
    utc = 7000; mono = variant === 'wall' ? 1_000_000_000n : 7_000_000_000n;
    journal.append('end'); journal.close();
    assert.throws(() => readJournal(path), variant === 'wall' ? /divergence/ : /heartbeat gap/);
  }
});

const anchor = (kind, seconds) => ({ kind, elapsedNs: String(BigInt(seconds) * 1_000_000_000n) });
test('strict 900 second threshold includes pre-capture wait and rejects short/missing/gapped media', () => {
  const records = [anchor('video-ready', 2), anchor('installer-start', 3), anchor('first-cited-answer', 899), anchor('capture-stop', 902)];
  const segments = [{ start: 1.4, duration: 450 }, { start: 451.4, duration: 450 }];
  assert.equal(validateTiming(records, segments).secondsToFirstCitedAnswer, 899);
  assert.equal(validateTiming(records, segments).under15Minutes, true);
  const late = records.map(r => r.kind === 'first-cited-answer' ? anchor(r.kind, 900) : r);
  assert.equal(validateTiming(late, segments).under15Minutes, false);
  assert.throws(() => validateTiming(records, []), /No actual video/);
  assert.throws(() => validateTiming(records, [{ start: 1.4, duration: 30 }]), /does not cover/);
  assert.throws(() => validateTiming(records, [{ start: 1.4, duration: 450 }, { start: 452, duration: 450 }]), /gap or overlap/);
  assert.throws(() => validateTiming([anchor('video-ready', 4), ...records.slice(1)], segments), /before live video/);
});

test('raw output is retained without rewriting; split credential pattern is refused before disk', async t => {
  const dir = temporary(t), journal = new Journal(join(dir, 'transcript.jsonl'));
  const stream = new PassThrough(), path = join(dir, 'stdout.txt'), errors = [];
  logOutput(stream, path, journal, 'output', error => errors.push(error));
  stream.write('real operation complete\n');
  stream.write('sk-'); stream.end('x'.repeat(24) + '\n');
  await new Promise(resolve => stream.on('end', resolve));
  journal.close();
  assert.equal(readFileSync(path, 'utf8'), 'real operation complete\n');
  assert.equal(errors.length, 1);
  assert.equal(readJournal(join(dir, 'transcript.jsonl'))[0].data.sha256, digest('real operation complete\n'));
  assert.throws(() => safeText('https://app.happytohelp.com'), /Production/);
});

test('stopping a started child terminates its process group without a background process', async () => {
  const child = launch({ executable: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: process.cwd() });
  await new Promise((resolve, reject) => { child.child.once('spawn', resolve); child.child.once('error', reject); });
  await stop(child);
  assert.notEqual(child.child.signalCode, null);
  assert.throws(() => process.kill(child.child.pid, 0), /ESRCH/);
});

test('supervisor retains group identity and kills descendants after command exit', async () => {
  const script = `const {spawn}=require('node:child_process'); const p=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:'ignore'}); process.stdout.write(String(p.pid)); process.exit(0);`;
  const group = launch({ executable: process.execPath, args: ['-e', script], cwd: process.cwd() });
  let output = '';
  group.child.stdout.on('data', chunk => { output += chunk; });
  await group.result;
  assert.equal(group.child.exitCode, null); // Session identity remains owned.
  const pid = Number(output); assert.ok(pid > 0);
  try { await stop(group); await new Promise(resolve => setTimeout(resolve, 50)); assert.throws(() => process.kill(pid, 0), /ESRCH/); }
  finally { try { process.kill(pid, 'SIGKILL'); } catch {} }
});
