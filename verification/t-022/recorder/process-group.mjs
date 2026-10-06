// Keep the session leader alive after its command exits so the parent never
// sends a signal to a stale/reused process-group ID. IPC is private to parent.
import { spawn } from 'node:child_process';
let started = false;
process.on('SIGTERM', () => {}); // The parent escalates this owned group to KILL.
process.on('disconnect', () => process.kill(-process.pid, 'SIGKILL'));
process.on('message', message => {
  if (started || message.kind !== 'start') return;
  started = true;
  const child = spawn(message.spec.executable, message.spec.args, {
    cwd: message.spec.cwd, detached: false,
    stdio: Array.from({ length: message.descriptors }, (_, index) => index),
  });
  let reported = false;
  const report = result => { if (!reported) { reported = true; process.send({ kind: 'command-exit', result }); } };
  child.once('error', () => report({ code: null, signal: null, spawnError: true }));
  child.once('close', (code, signal) => report({ code, signal }));
});
process.send({ kind: 'supervisor-ready' });
