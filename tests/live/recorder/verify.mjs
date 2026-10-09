import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { digest, digestFile, invariant, LIMIT, readJournal } from './custody.mjs';
import { milestones } from './config.mjs';
import { validateReceipt } from './evidence.mjs';

function files(directory, base = directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name); invariant(!lstatSync(path).isSymbolicLink(), 'Evidence symlink refused');
    return statSync(path).isDirectory() ? files(path, base) : [relative(base, path)];
  });
}
export function inventory(directory) {
  return files(directory).filter(path => path !== 'manifest.json').map(path => {
    const full = join(directory, path);
    return { path, bytes: statSync(full).size, sha256: digestFile(full) };
  });
}
export function probe(executable, path) {
  return JSON.parse(execFileSync(executable, ['-v', 'error', '-show_entries', 'format=start_time,duration:stream=codec_type,width,height', '-of', 'json', path], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000 }));
}
export function validateTiming(records, segments) {
  const started = records.find(r => r.kind === 'installer-start');
  const ready = records.find(r => r.kind === 'video-ready');
  const answer = records.find(r => r.kind === 'first-cited-answer');
  const stopped = records.find(r => r.kind === 'capture-stop');
  invariant(started && ready && answer && stopped, 'Required clock anchors missing');
  invariant(BigInt(ready.elapsedNs) <= BigInt(started.elapsedNs), 'Installation started before live video');
  invariant(segments.length > 0, 'No actual video segments');
  let end;
  for (const segment of segments) {
    invariant(segment.duration > 0 && Number.isFinite(segment.start), 'Video timing is absent');
    if (end !== undefined) invariant(Math.abs(segment.start - end) < 0.15, 'Video segment gap or overlap');
    end = segment.start + segment.duration;
  }
  const duration = end - segments[0].start;
  const recordedSeconds = Number(BigInt(stopped.elapsedNs) - BigInt(ready.elapsedNs)) / 1e9;
  invariant(duration >= recordedSeconds - 2 && duration <= recordedSeconds + 5, 'Actual video duration does not cover continuous recorder clock');
  return { secondsToFirstCitedAnswer: Number(answer.elapsedNs) / 1e9,
    under15Minutes: BigInt(answer.elapsedNs) < 900_000_000_000n, videoSeconds: duration };
}

export function inspect(directory) {
  const config = JSON.parse(readFileSync(join(directory, 'run-config.json'), 'utf8'));
  const records = readJournal(join(directory, 'transcript.jsonl'));
  invariant(records[0].data.configHash === digest(JSON.stringify(config)) && records[0].data.sourceSha === config.sourceSha, 'Run config differs from clock-start identity');
  for (const kind of milestones) invariant(records.filter(r => r.kind === kind).length === 1, `Missing/duplicate milestone: ${kind}`);
  invariant(records.some(r => r.kind === 'installer-exit' && r.data.code === 0), 'Installer did not exit successfully');
  invariant(!records.some(r => ['abort', 'fatal'].includes(r.kind)), 'Attempt failed or was aborted');
  invariant(records.at(-1).kind === 'recording-end', 'Recording has no orderly end');
  let redactions = 0;
  records.forEach((r, index) => {
    if (r.kind === 'redaction-begin') redactions++;
    if (r.kind === 'redaction-end') redactions--;
    invariant(redactions >= 0 && redactions <= 1, 'Unbalanced or nested redaction annotations');
    if (r.kind === 'first-cited-answer') invariant(redactions === 0, 'First visible citation cannot occur during full-screen privacy redaction');
    if (r.data.file) {
      invariant(r.data.file === `receipts/${r.kind}${r.kind.startsWith('capture-') ? '.jpg' : '.json'}`, 'Unsafe evidence path');
      const bytes = readFileSync(join(directory, r.data.file));
      invariant(digest(bytes) === r.data.sha256 && bytes.length === r.data.bytes, 'Receipt changed after observation');
      if (r.data.receipt) {
        invariant(JSON.stringify(JSON.parse(bytes)) === JSON.stringify(r.data.receipt), 'Receipt differs from journal');
        validateReceipt(r.kind, r.data.receipt, config, records.slice(0, index));
      }
    }
  });
  invariant(redactions === 0, 'Unclosed privacy interval');
  for (const width of [1440, 390]) {
    const media = probe(config.ffprobe, join(directory, `receipts/capture-${width}.jpg`));
    invariant(media.streams.some(s => s.width === width && s.height > 0), `JPG capture width differs from ${width}`);
  }
  const paths = files(directory).filter(path => path !== 'manifest.json');
  const videoPaths = paths.filter(p => /^video\/\d{6}\.ts$/.test(p)).sort();
  const segments = videoPaths.map((path, index) => {
    invariant(path === `video/${String(index).padStart(6, '0')}.ts`, 'Missing/out-of-order video segment');
    const info = probe(config.ffprobe, join(directory, path));
    invariant(info.streams.some(s => s.codec_type === 'video'), 'Segment has no video stream');
    return { path, start: Number(info.format.start_time), duration: Number(info.format.duration) };
  });
  const timing = validateTiming(records, segments);
  const contents = inventory(directory);
  invariant(contents.every(file => file.bytes < LIMIT), 'Evidence file is not under 50 MB');
  return { schemaVersion: 1, status: timing.under15Minutes ? 'recorded-awaiting-independent-review' : 'over-time',
    sourceSha: config.sourceSha, attempt: config.attempt, ...timing, segments, inventory: contents,
    transcriptFinalHash: records.at(-1).hash, redactions: records.filter(r => r.kind.startsWith('redaction-')),
    limitation: 'Structural custody checks do not authenticate submitted provider receipts or prove that screen input was live. A fresh independent gate must inspect the complete recording, actual workflow/provider provenance, fresh state, and citation correctness.' };
}
