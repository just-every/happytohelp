import { spawn } from 'node:child_process';
import { ConnectorError } from '../errors.mjs';
import { AGENT_OUTPUT_SCHEMA } from '../result.mjs';
import { MAX_RUNTIME_OUTPUT, boundedText, runtimeFailure, stopChild, uuid, waitForExit } from '../util.mjs';

function browserMcpConfig(browserMcp) {
  if (!browserMcp) return null;
  return JSON.stringify({
    mcpServers: {
      h2h_browser: {
        command: browserMcp.command,
        args: browserMcp.args,
      },
    },
  });
}

function textFromContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('');
}

export function buildClaudeArgs({ prompt, identity, browserMcp, model }) {
  const initialSessionId = identity?.providerSessionId || uuid();
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--json-schema', JSON.stringify(AGENT_OUTPUT_SCHEMA),
    '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none',
    '--bare',
  ];
  if (identity?.providerSessionId) args.push('--resume', identity.providerSessionId);
  else args.push('--session-id', initialSessionId);
  if (model) args.push('--model', model);
  const mcpConfig = browserMcpConfig(browserMcp);
  if (mcpConfig) {
    // Claude's noninteractive permission mode only permits explicitly allowed
    // tools. This names the configured MCP server, which covers its browser_*
    // tools without granting an arbitrary shell or filesystem capability.
    args.push('--allowedTools', 'mcp__h2h_browser', '--strict-mcp-config', '--mcp-config', mcpConfig);
  }
  return { args, initialSessionId };
}

export function structuredOutputFromClaudeEvent(event) {
  if (event?.type !== 'result') return null;
  if (event.structured_output && typeof event.structured_output === 'object' && !Array.isArray(event.structured_output)) {
    return JSON.stringify(event.structured_output);
  }
  if (typeof event.structured_output === 'string' && event.structured_output.trim()) return event.structured_output;
  if (typeof event.result === 'string' && event.result.trim()) return event.result;
  return null;
}

export async function runClaude({ prompt, identity, onIdentity, onProgress, signal, browserMcp, workingDirectory, model }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConnectorError('Claude direct runner requires ANTHROPIC_API_KEY; it never uses a Claude subscription login.', {
      code: 'CLAUDE_API_KEY_REQUIRED',
    });
  }
  const { args, initialSessionId } = buildClaudeArgs({ prompt, identity, browserMcp, model });

  const child = spawn('claude', args, {
    cwd: workingDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, CLAUDE_CODE_SIMPLE: '1' },
  });
  let output = '';
  let stderr = '';
  let buffer = '';
  let sessionId = initialSessionId;
  let resultText = '';
  let resultSubtype = null;
  let terminated = false;

  const terminate = () => {
    terminated = true;
    stopChild(child);
  };
  signal?.addEventListener('abort', terminate, { once: true });

  const done = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signalName) => resolve({ code, signalName }));
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-8_000); });
    child.stdout.on('data', (chunk) => {
      output += chunk.toString('utf8');
      if (output.length > MAX_RUNTIME_OUTPUT) {
        terminate();
        return;
      }
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (typeof event.session_id === 'string') {
          sessionId = event.session_id;
          void onIdentity?.({ provider: 'claude', providerSessionId: sessionId });
        }
        if (event.type === 'assistant') {
          const text = textFromContent(event.message?.content);
          if (text) onProgress?.('Claude is working.');
        }
        if (event.type === 'result') {
          resultSubtype = event.subtype || null;
          const structured = structuredOutputFromClaudeEvent(event);
          if (structured) resultText = structured;
        }
      }
    });
  });
  signal?.removeEventListener('abort', terminate);
  await waitForExit(child, 100);
  if (signal?.aborted || terminated || done.signalName) {
    return { cancelled: true, sessionId, rawText: '' };
  }
  if (done.code !== 0) {
    runtimeFailure('Claude', stderr || `process exited with code ${done.code}`);
  }
  if (resultSubtype && resultSubtype !== 'success') {
    runtimeFailure('Claude', stderr || `stream-json completed with subtype ${resultSubtype}`);
  }
  if (!resultText) {
    runtimeFailure('Claude', stderr || 'stream-json output did not contain a result event.');
  }
  await onIdentity?.({ provider: 'claude', providerSessionId: sessionId });
  return { cancelled: false, sessionId, rawText: resultText, diagnostics: boundedText(stderr, 600) };
}
