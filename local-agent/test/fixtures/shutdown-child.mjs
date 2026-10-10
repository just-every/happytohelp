// Test-only native-process boundary: no provider calls or account state.
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';

const [mode, receipt] = process.argv.slice(2);
const record = event => appendFileSync(receipt, JSON.stringify({ event, at: Date.now() }) + '\n');
const keepAlive = setInterval(() => {}, 1000);
process.on('SIGTERM', () => {
  record('SIGTERM');
  if (mode !== 'stubborn') process.exit(99);
});
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  const request = JSON.parse(line);
  if (request.method === 'ping') process.stdout.write(JSON.stringify({ id: request.id, result: { ready: true } }) + '\n');
});
lines.on('close', () => {
  record('EOF');
  if (mode === 'stubborn') return;
  // A healthy native shutdown can take longer than the old one-second kill
  // window, for example while its own queued records finish writing.
  setTimeout(() => { record('flushed'); clearInterval(keepAlive); }, 1500);
});
