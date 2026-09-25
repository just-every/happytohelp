import readline from 'node:readline';
import { userMessage } from './errors.mjs';

const PROTOCOL_VERSION = '2025-03-26';

const TOOL_DEFINITIONS = [
  {
    name: 'h2h_await',
    description: 'Wait briefly for a HappyToHelp assignment and atomically claim it. The existing desktop session retains its own browser and computer tools.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { wait_ms: { type: 'integer', minimum: 0, maximum: 25000 } },
    },
  },
  {
    name: 'h2h_wait_for_assignment',
    description: 'Wait briefly for a HappyToHelp assignment and atomically claim it. The existing desktop session retains its own browser and computer tools.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { wait_ms: { type: 'integer', minimum: 0, maximum: 25000 } },
    },
  },
  {
    name: 'h2h_claim',
    description: 'Atomically claim the next HappyToHelp assignment now. Repeated calls may claim more independent jobs while the device has configured capacity.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'h2h_context',
    description: 'Read the scoped context snapshot for one claimed assignment. Set fresh=true before resuming that job.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { job_id: { type: 'string', minLength: 1 }, fresh: { type: 'boolean' } }, required: ['job_id'] },
  },
  {
    name: 'h2h_progress',
    description: 'Send one concise progress update for the named assignment.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { job_id: { type: 'string', minLength: 1 }, message: { type: 'string', minLength: 1, maxLength: 800 } }, required: ['job_id', 'message'],
    },
  },
  {
    name: 'h2h_result',
    description: 'Submit the final structured result for one job. Use uploaded attachment IDs only; replies and follow-up actions are operator proposals, while resolve_reply omits replies and uses reply_draft.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        job_id: { type: 'string', minLength: 1 },
        status: { type: 'string', enum: ['completed', 'needs_input', 'failed', 'cancelled'] },
        session_id: { type: 'string' },
        result: { type: 'object' },
      },
      required: ['job_id', 'status', 'result'],
    },
  },
  {
    name: 'h2h_upload',
    description: 'Upload one absolute local PNG, JPEG, or GIF screenshot up to 4 MiB for the named running job. Add only its returned ID to result attachment_ids, reply attachment_ids, or follow-up attachment_ids.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { job_id: { type: 'string', minLength: 1 }, file_path: { type: 'string', minLength: 1 } }, required: ['job_id', 'file_path'],
    },
  },
  {
    name: 'h2h_input',
    description: 'Read unseen operator answers and cancellation state for one named assignment.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { job_id: { type: 'string', minLength: 1 } }, required: ['job_id'] },
  },
  {
    name: 'h2h_recover',
    description: 'After a prior MCP host session may have ended, resume one job only with a newly received trusted operator input ID from h2h_input. Do not use it to repeat an unknown action.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { job_id: { type: 'string', minLength: 1 }, input_id: { type: 'string', minLength: 1, maxLength: 200 } }, required: ['job_id', 'input_id'],
    },
  },
];

function response(id, result) { return { jsonrpc: '2.0', id, result }; }
function failure(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function toolContent(value) { return { content: [{ type: 'text', text: JSON.stringify(value) }] }; }

export async function serveMcp(runner, { input = process.stdin, output = process.stdout, error = process.stderr } = {}) {
  const send = (message) => output.write(`${JSON.stringify(message)}\n`);
  const tools = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));
  const dispatch = async (name, args = {}) => {
    if (!tools.has(name)) throw new Error(`Unknown tool: ${name}`);
    if (name === 'h2h_wait_for_assignment' || name === 'h2h_await') return runner.waitForAssignment(args.wait_ms);
    if (name === 'h2h_claim') return runner.claim();
    if (name === 'h2h_context') return runner.context({ jobId: args.job_id, fresh: Boolean(args.fresh) });
    if (name === 'h2h_progress') return runner.progress(args.message, args.job_id);
    if (name === 'h2h_result') return runner.result(args.status, args.result, args.session_id, args.job_id);
    if (name === 'h2h_upload') return runner.upload(args.file_path, args.job_id);
    if (name === 'h2h_input') return runner.input(args.job_id);
    if (name === 'h2h_recover') return runner.recover(args.input_id, args.job_id);
    throw new Error(`Unknown tool: ${name}`);
  };
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send(failure(null, -32700, 'Parse error'));
      continue;
    }
    if (!message || typeof message.method !== 'string') {
      if (message?.id !== undefined) send(failure(message.id, -32600, 'Invalid Request'));
      continue;
    }
    if (message.method === 'notifications/initialized') continue;
    if (message.method === 'initialize') {
      send(response(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'happytohelp-local-agent', version: '0.2.1' },
      }));
      continue;
    }
    if (message.method === 'tools/list') {
      send(response(message.id, { tools: TOOL_DEFINITIONS }));
      continue;
    }
    if (message.method === 'tools/call') {
      try {
        const value = await dispatch(message.params?.name, message.params?.arguments || {});
        send(response(message.id, toolContent(value)));
      } catch (err) {
        error.write(`HappyToHelp MCP tool failed: ${userMessage(err)}\n`);
        send(response(message.id, { content: [{ type: 'text', text: userMessage(err) }], isError: true }));
      }
      continue;
    }
    if (message.id !== undefined) send(failure(message.id, -32601, `Method not found: ${message.method}`));
  }
}
