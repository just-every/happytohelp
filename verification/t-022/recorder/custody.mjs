import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';

export const LIMIT = 50_000_000;
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function digestFile(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.alloc(65536);
  try { let length; while ((length = readSync(fd, buffer)) > 0) hash.update(buffer.subarray(0, length)); }
  finally { closeSync(fd); }
  return hash.digest('hex');
}
export const invariant = (condition, message) => { if (!condition) throw new Error(message); };
export function safeText(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  invariant(text.length <= LIMIT, 'Text exceeds evidence file limit');
  invariant(!/(?:sk-[A-Za-z0-9_-]{16,}|SG\.[A-Za-z0-9_-]{12,}|(?:re_|ghp_|github_pat_)[A-Za-z0-9_]{16,}|Bearer\s+\S+|-----BEGIN .*PRIVATE KEY|(?:password|api[_-]?key|authorization|cookie|setup[_-]?token)\s*["']?\s*[:=]\s*["']?[^\s"',}]{4,})/i.test(text), 'Potential credential refused; content was not retained');
  invariant(!/(?:app\.happytohelp\.com|help\.justevery\.com)/i.test(text), 'Production hostname refused');
  return text;
}

export class Journal {
  constructor(path, clock = () => ({ utc: Date.now(), mono: process.hrtime.bigint() })) {
    this.clock = clock;
    this.start = clock();
    this.previous = '0'.repeat(64);
    this.sequence = 0;
    this.fd = openSync(path, 'wx', 0o600);
  }
  append(kind, data = {}) {
    safeText(data);
    const now = this.clock();
    const record = { sequence: this.sequence++, kind, utc: new Date(now.utc).toISOString(),
      elapsedNs: String(now.mono - this.start.mono), wallElapsedMs: now.utc - this.start.utc,
      previous: this.previous, data };
    record.hash = digest(JSON.stringify(record));
    appendFileSync(this.fd, JSON.stringify(record) + '\n');
    fsyncSync(this.fd);
    this.previous = record.hash;
    return record;
  }
  close() { closeSync(this.fd); }
}

export function readJournal(path) {
  const records = readFileSync(path, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  let previous = '0'.repeat(64), elapsed = -1n;
  records.forEach((record, sequence) => {
    const { hash, ...body } = record;
    invariant(record.sequence === sequence && record.previous === previous && digest(JSON.stringify(body)) === hash, 'Transcript hash chain or order is invalid');
    invariant(BigInt(record.elapsedNs) >= elapsed, 'Monotonic clock moved backwards');
    invariant(Math.abs(Number(record.elapsedNs) / 1e6 - record.wallElapsedMs) < 2000, 'UTC/monotonic clock divergence (including sleep) invalidates timing');
    if (sequence) invariant(Number(BigInt(record.elapsedNs) - elapsed) / 1e9 < 5, 'Recording heartbeat gap exceeds five seconds');
    elapsed = BigInt(record.elapsedNs); previous = hash;
  });
  return records;
}

export function writeJson(path, value) {
  writeFileSync(path, safeText(JSON.stringify(value, null, 2)) + '\n', { flag: 'wx', mode: 0o600 });
}
