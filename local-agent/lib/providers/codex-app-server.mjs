import { spawn } from 'node:child_process';
import { ConnectorError } from '../errors.mjs';
import { boundedText, runtimeFailure, stopChild, waitForExit } from '../util.mjs';
import { AGENT_OUTPUT_SCHEMA } from '../result.mjs';

function tomlString(value) {
  return JSON.stringify(value);
}

function tomlArray(values) {
  return `[${values.map((value) => tomlString(value)).join(', ')}]`;
}

function extractText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string') return value.text;
  if (typeof value.delta === 'string') return value.delta;
  if (Array.isArray(value)) return value.map(extractText).join('');
  if (Array.isArray(value.content)) return value.content.map(extractText).join('');
  return '';
}

class JsonlRpc {
  constructor(command, args, { onStderr } = {}) {
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Set();
    this.buffer = '';
    this.stderr = '';
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
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
      if (message.id !== undefined && this.pending.has(message.id)) {
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

function appServerArgs(browserMcp) {
  const args = ['app-server'];
  if (!browserMcp) return args;
  args.push(
    '-c', `mcp_servers.h2h_browser.command=${tomlString(browserMcp.command)}`,
    '-c', `mcp_servers.h2h_browser.args=${tomlArray(browserMcp.args)}`,
  );
  return args;
}

export async function runCodex({ prompt, identity, onIdentity, onProgress, signal, browserMcp, workingDirectory, model }) {
  const rpc = new JsonlRpc('codex', appServerArgs(browserMcp), { onStderr: (line) => onProgress?.(`Codex: ${line}`) });
  let threadId = identity?.providerThreadId || null;
  let providerSessionId = identity?.providerSessionId || null;
  let turnId = null;
  let completedText = '';
  let deltaText = '';
  let turnStatus = null;
  let interrupted = false;
  let complete;
  const turnDone = new Promise((resolve) => { complete = resolve; });
  const completeFailedTurn = (error) => {
    turnStatus = 'failed';
    complete(error);
  };
  rpc.child.once('exit', () => completeFailedTurn(new Error('Codex app-server exited before completing the turn.')));

  const unsubscribe = rpc.onNotification((message) => {
    const params = message.params || {};
    if (message.method === 'item/agentMessage/delta') {
      deltaText += extractText(params);
      if (deltaText.length % 4_000 < 600) onProgress?.('Codex is working.');
    }
    if (message.method === 'item/completed' && params.item?.type === 'agentMessage') {
      const text = extractText(params.item);
      if (text) completedText = text;
    }
    if (message.method === 'turn/completed' && (!threadId || params.threadId === threadId || params.turn?.threadId === threadId)) {
      turnStatus = params.turn?.status || 'completed';
      complete();
    }
  });

  const interrupt = async () => {
    if (interrupted) return;
    interrupted = true;
    if (threadId && turnId) {
      try {
        await rpc.request('turn/interrupt', { threadId, turnId }, 10_000);
      } catch {
        // The process may have already completed; terminal cancellation is still reported upstream.
      }
    }
  };
  signal?.addEventListener('abort', interrupt, { once: true });

  try {
    await rpc.request('initialize', {
      clientInfo: { name: 'happytohelp-local-agent', title: 'HappyToHelp local agent', version: '0.2.1' },
    });
    rpc.notify('initialized', {});
    const response = threadId
      ? await rpc.request('thread/resume', { threadId })
      : await rpc.request('thread/start', {
        cwd: workingDirectory,
        approvalPolicy: 'never',
        sandbox: 'danger-full-access',
        ...(model ? { model } : {}),
        serviceName: 'happytohelp-local-agent',
      });
    const thread = response?.thread;
    if (!thread?.id) runtimeFailure('Codex', 'app-server did not return a thread identity.');
    threadId = thread.id;
    providerSessionId = thread.sessionId || thread.id;
    await onIdentity?.({
      provider: 'codex',
      providerThreadId: thread.id,
      providerSessionId,
    });
    const turn = await rpc.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: prompt }],
      cwd: workingDirectory,
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'dangerFullAccess' },
      ...(model ? { model } : {}),
      outputSchema: AGENT_OUTPUT_SCHEMA,
    });
    turnId = turn?.turn?.id;
    if (!turnId) runtimeFailure('Codex', 'app-server did not return a turn identity.');
    onProgress?.('Codex session started.');

    const finished = await Promise.race([
      turnDone,
      new Promise((resolve) => signal?.addEventListener('abort', resolve, { once: true })),
    ]);
    if (finished instanceof Error) throw finished;
    if (signal?.aborted) {
      await interrupt();
      const interruptedTurn = await Promise.race([turnDone, new Promise((resolve) => setTimeout(resolve, 10_000))]);
      if (interruptedTurn instanceof Error) throw interruptedTurn;
    }
    if (turnStatus && turnStatus !== 'completed' && turnStatus !== 'interrupted') {
      runtimeFailure('Codex', `turn completed with status ${turnStatus}.`);
    }
    return {
      cancelled: Boolean(signal?.aborted || interrupted || turnStatus === 'interrupted'),
      sessionId: providerSessionId,
      providerThreadId: threadId,
      rawText: completedText || deltaText,
    };
  } catch (error) {
    runtimeFailure('Codex', `${error.message}${rpc.stderr ? ` (${boundedText(rpc.stderr, 400)})` : ''}`);
  } finally {
    unsubscribe();
    signal?.removeEventListener('abort', interrupt);
    await rpc.close();
  }
}
