import { spawn } from 'node:child_process';
import { boundedText, stopChild, waitForExit } from './util.mjs';

export class JsonlRpc {
  constructor(command, args, { onStderr, env, cwd } = {}) {
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Set();
    this.buffer = '';
    this.stderr = '';
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env, cwd });
    this.child.once('error', (error) => this.failAll(error));
    this.child.once('exit', (code, signal) => this.failAll(new Error(`app-server exited (${code ?? signal ?? 'unknown'}).`)));
    this.child.stdout.on('data', (chunk) => this.consume(chunk));
    this.child.stderr.on('data', (chunk) => {
      this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-8_000);
      onStderr?.(boundedText(chunk.toString('utf8'), 400));
    });
  }

  consume(chunk) {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.failAll(new Error('Codex app-server emitted invalid JSONL.'));
        continue;
      }
      if (!message.method && message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message || 'Codex app-server request failed.'));
        else pending.resolve(message.result);
      } else if (message.method) {
        for (const handler of this.handlers) handler(message);
      }
    }
  }

  request(method, params, timeoutMs = 30_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ method, id, params });
    });
  }

  notify(method, params) { this.send({ method, params }); }

  send(message) {
    if (!this.child.stdin.writable) throw new Error('Codex app-server stdin is closed.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  onNotification(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  failAll(error) {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }

  async close() {
    stopChild(this.child);
    await waitForExit(this.child, 1_000);
    if (this.child.exitCode === null && this.child.signalCode === null) {
      stopChild(this.child, 'SIGKILL');
      await waitForExit(this.child, 1_000);
    }
  }
}
