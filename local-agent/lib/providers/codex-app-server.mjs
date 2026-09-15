import { JsonlRpc } from '../jsonl-rpc.mjs';
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
