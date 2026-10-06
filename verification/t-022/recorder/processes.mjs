import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { digest, invariant, LIMIT, safeText } from './custody.mjs';

// Every child is a process group. SIGINT/SIGTERM close its whole group; there is
// no shell interpretation of commands, detached background work, or retry.
export function launch(spec, stdio = ['ignore', 'pipe', 'pipe']) {
  const supervisor = new URL('./process-group.mjs', import.meta.url);
  const child = spawn(process.execPath, [supervisor.pathname], {
    cwd: spec.cwd, stdio: [...stdio, 'ipc'], detached: true,
  });
  let resolveResult, resolveClosed;
  const handle = { child, outcome: null, ready: false,
    result: new Promise(resolve => { resolveResult = resolve; }),
    closed: new Promise(resolve => { resolveClosed = resolve; }),
  };
  const finish = outcome => { if (!handle.outcome) { handle.outcome = outcome; resolveResult(outcome); } };
  child.on('message', message => {
    if (message.kind === 'supervisor-ready') {
      handle.ready = true;
      child.send({ kind: 'start', spec, descriptors: stdio.length });
    } else if (message.kind === 'command-exit') finish(message.result);
  });
  child.once('error', () => { finish({ code: null, signal: null, spawnError: true }); resolveClosed(); });
  child.once('close', (code, signal) => { finish({ code, signal, supervisorExited: true }); resolveClosed(); });
  return handle;
}
export async function stop(handle) {
  if (!handle?.child.pid) return;
  const child = handle.child;
  // Once the supervisor has gone we no longer own that group identity. Its IPC
  // disconnect handler kills its own group; never signal a recycled identifier.
  if (child.exitCode !== null || child.signalCode !== null) return;
  const signal = name => {
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, name);
  };
  if (handle.ready) {
    signal('SIGTERM');
    let timer;
    await Promise.race([handle.result, new Promise(resolve => { timer = setTimeout(resolve, 3000); })]);
    clearTimeout(timer);
  }
  signal('SIGKILL');
  await handle.closed;
}

export function logOutput(stream, path, journal, kind, fail) {
  let pending = '', bytes = 0;
  const retain = line => {
    try {
      safeText(line); bytes += Buffer.byteLength(line);
      invariant(bytes < LIMIT, 'Command output exceeds evidence limit');
      appendFileSync(path, line, { mode: 0o600 });
      journal.append(kind, { sha256: digest(line), bytes: Buffer.byteLength(line) });
    } catch { fail(`${kind}: unsafe or excessive output refused`); }
  };
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    pending += chunk;
    if (pending.length > 1_000_000) { pending = ''; fail(`${kind}: oversized line refused`); return; }
    let end;
    while ((end = pending.indexOf('\n')) >= 0) { retain(pending.slice(0, end + 1)); pending = pending.slice(end + 1); }
  });
  stream.on('end', () => { if (pending) retain(pending); });
}

export async function capture(config, directory, journal, fail) {
  const video = join(directory, 'video'); mkdirSync(video);
  const source = launch(config.capture);
  const encoder = launch({ executable: config.ffmpeg, cwd: directory, args: [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-i', 'pipe:0', '-an',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-r', '25',
    '-g', '50', '-b:v', '2000k', '-maxrate', '2500k', '-bufsize', '5000k',
    '-f', 'segment', '-segment_time', '30', '-segment_format', 'mpegts',
    '-segment_list', join(video, 'segments.csv'), '-segment_list_type', 'csv',
    '-progress', 'pipe:3', '-stats_period', '1', join(video, '%06d.ts'),
  ] }, ['pipe', 'ignore', 'pipe', 'pipe']);
  source.child.stdout.pipe(encoder.child.stdin);
  encoder.child.stdin.on('error', () => fail('Video encoder input closed'));
  logOutput(source.child.stderr, join(directory, 'capture.stderr.txt'), journal, 'capture-output', fail);
  logOutput(encoder.child.stderr, join(directory, 'encoder.stderr.txt'), journal, 'encoder-output', fail);
  let active = true, lastProgress = Date.now(), resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let pending = '';
  encoder.child.stdio[3].setEncoding('utf8').on('data', chunk => {
    pending += chunk;
    let index;
    while ((index = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, index); pending = pending.slice(index + 1);
      if (/^frame=\d+$/.test(line) && Number(line.slice(6)) > 0) {
        lastProgress = Date.now(); resolveReady();
      }
    }
  });
  const watch = setInterval(() => {
    if (Date.now() - lastProgress > 5000) fail('Live screen capture stalled for more than five seconds');
    // Bound each retained segment; exceeding this never removes the failed run.
    try { for (const name of readdirSync(video)) if (statSync(join(video, name)).size >= LIMIT) fail('Video segment exceeds 50 MB'); } catch { fail('Video directory inaccessible'); }
  }, 1000);
  for (const p of [source, encoder]) p.result.then(() => {
    if (active) { rejectReady(new Error('Capture exited before recording completed')); fail('Capture exited before recording completed'); }
  });
  const timeout = setTimeout(() => rejectReady(new Error('No live video frames within 15 seconds')), 15_000);
  try { await ready; }
  catch (error) { active = false; clearInterval(watch); await stop(source); await stop(encoder); throw error; }
  finally { clearTimeout(timeout); }
  return { async close() {
    active = false; clearInterval(watch); await stop(source);
    let timeout;
    const exited = await Promise.race([encoder.result, new Promise(resolve => { timeout = setTimeout(() => resolve(null), 3000); })]);
    clearTimeout(timeout);
    if (!exited) { await stop(encoder); throw new Error('Encoder did not flush before shutdown deadline'); }
    await stop(encoder);
    invariant(exited.code === 0, 'Encoder failed during final flush');
  } };
}
