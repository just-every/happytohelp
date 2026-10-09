import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Journal, invariant, writeJson } from './custody.mjs';
import { capture, launch, logOutput, stop } from './processes.mjs';
import { importEvidence } from './evidence.mjs';
import { milestones } from './config.mjs';
import { inspect, inventory } from './verify.mjs';

export async function record(prepared) {
  const { config, receipts, output } = prepared;
  mkdirSync(join(config.repository, '.local-evidence/activation/attempts'), { recursive: true, mode: 0o700 });
  mkdirSync(output, { mode: 0o700 }); // EEXIST is intentional: never overwrite/resume.
  mkdirSync(join(output, 'receipts')); mkdirSync(join(output, 'prerequisites'));
  writeJson(join(output, 'run-config.json'), config);
  for (const [name, value] of Object.entries(receipts)) writeJson(join(output, `prerequisites/${name}.json`), { sha256: value.sha256, suppliedReceipt: value.bytes });
  const journal = new Journal(join(output, 'transcript.jsonl'));
  const records = [journal.append('recording-start', { sourceSha: config.sourceSha, configHash: prepared.configHash })];
  let video, installer, failure, finished = false, closed = false, redacted = false;
  let wake;
  const ended = new Promise(resolve => { wake = resolve; });
  const fail = reason => { if (!failure) { failure = reason; journal.append('fatal', { reason }); wake(); } };
  const heartbeat = setInterval(() => journal.append('heartbeat'), 1000);
  const interrupted = () => fail('Interrupted; attempt retained and never resumed');
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  const input = createInterface({ input: process.stdin, terminal: false });
  input.on('close', () => { if (!finished && !closed) fail('Control input closed before finish'); });
  input.on('line', line => {
    if (failure || finished) return;
    try {
      invariant(line.length < 100_000, 'Control input too long');
      const command = JSON.parse(line);
      invariant(records.some(r => r.kind === 'installer-start'), 'Wait for installer-start before milestone commands');
      if (command.kind === 'abort') { fail('Operator aborted attempt'); return; }
      if (command.kind === 'finish') {
        invariant(milestones.every(kind => records.some(r => r.kind === kind)), 'Required evidence milestones remain missing');
        invariant(installer?.outcome?.code === 0 && !redacted, 'Installer unfinished/failed or privacy interval open');
        finished = true; wake(); return;
      }
      if (['redaction-begin', 'redaction-end'].includes(command.kind)) {
        invariant(command.kind === 'redaction-begin' ? !redacted : redacted, 'Unbalanced privacy interval');
        redacted = command.kind === 'redaction-begin';
        records.push(journal.append(command.kind, { reason: 'Owner password/private setup input; capture mask controlled externally; clock remains running' }));
      } else if (command.kind === 'note') records.push(journal.append('note', { text: command.text }));
      else {
        invariant(!(command.kind === 'first-cited-answer' && redacted), 'Visible citation cannot be marked during privacy redaction');
        records.push(importEvidence(command, config, output, journal, records));
      }
      process.stdout.write(`Recorded ${records.at(-1).kind}\n`);
    } catch {
      journal.append('input-rejected', { reason: 'Invalid command or evidence; correct input without pausing or resetting the clock' });
      process.stderr.write('Input rejected; inspect evidence contract. Clock continues.\n');
    }
  });
  try {
    video = await capture(config, output, journal, fail);
    if (failure) throw new Error(failure);
    records.push(journal.append('video-ready'));
    records.push(journal.append('installer-start', { command: config.installer }));
    installer = launch(config.installer);
    logOutput(installer.child.stdout, join(output, 'installer.stdout.txt'), journal, 'installer-stdout', fail);
    logOutput(installer.child.stderr, join(output, 'installer.stderr.txt'), journal, 'installer-stderr', fail);
    installer.result.then(result => { journal.append('installer-exit', result); if (result.code !== 0) fail('Installer failed; no retry in this attempt'); });
    process.stdout.write('Live video and installation started. Clock includes all owner interaction. Supply JSON milestone commands on stdin.\n');
    await ended;
  } catch { fail('Capture/installation startup failed; inspect retained sanitized output'); }
  finally {
    closed = true; input.close();
    await stop(installer);
    journal.append('capture-stop');
    try { await video?.close(); } catch { fail('Capture shutdown failed'); }
    clearInterval(heartbeat);
    journal.append(failure ? 'abort' : 'recording-end', failure ? { reason: failure } : {});
    journal.close();
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
  }
  if (failure) {
    writeJson(join(output, 'manifest.json'), { status: 'failed', inventory: inventory(output), reason: failure, sourceSha: config.sourceSha, attempt: config.attempt, limitation: 'Retained incomplete attempt; not install acceptance.' });
    throw new Error('Recording failed; failed attempt retained');
  }
  try { writeJson(join(output, 'manifest.json'), inspect(output)); }
  catch (error) {
    writeJson(join(output, 'manifest.json'), { status: 'verification-failed', inventory: inventory(output), sourceSha: config.sourceSha, attempt: config.attempt, reason: error.message });
    throw error;
  }
  return output;
}
