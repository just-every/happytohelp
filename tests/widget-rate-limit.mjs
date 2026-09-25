import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {WidgetTransport} from '../src/modules/widget/transport.js';
const originals = {fetch: globalThis.fetch, WebSocket: globalThis.WebSocket, localStorage: globalThis.localStorage};
afterEach(() => Object.assign(globalThis, originals));

function install({limitMessages = false, limitSession = false} = {}) {
  const storage = new Map(), requests = [];
  globalThis.localStorage = {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)};
  globalThis.WebSocket = class {constructor(url) {this.url = url;} close() {}};
  const limited = (limit, message) => Response.json({error: message, code: 'rate_limited', limit, retryAfter: 42}, {status: 429, headers: {'Retry-After': '42'}});
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url, options});
    if (url.includes('/api/widget/settings')) return Response.json({});
    if (url.endsWith('/widget/session')) return limitSession ? limited('widgetSessionsPerIpHour', 'Too many chat sessions were started from this network. Please try again later.') : Response.json({token: 'contact-token', contactId: 'visitor', projectId: 'project'});
    if (url.endsWith('/api/conversations')) return Response.json(options.method === 'POST' ? {id: 'conversation'} : {conversations: []});
    if (url.endsWith('/messages') && options.method === 'POST') return limitMessages ? limited('messagesPerConversationMinute', 'You are sending messages too quickly. Please wait a moment and try again.') : Response.json({accepted: true, message: {id: 'm', local_id: JSON.parse(options.body).localId, content: 'hi', actor_role: 'contact', created_at: 0}});
    if (url.endsWith('/messages')) return Response.json({messages: [], revision: 0, lastMessageId: null});
    return Response.json({});
  };
  return {requests, storage};
}
const client = () => new WidgetTransport({apiOrigin: 'http://localhost:5430', widgetKey: 'key'});

test('a limited message surfaces the server message and retry delay and is never replayed later', async () => {
  const {requests, storage} = install({limitMessages: true});
  const transport = client();
  await assert.rejects(transport.send({local_id: 'limited', content: 'hello'}), error => {
    assert.equal(error.status, 429); assert.equal(error.rateLimited, true); assert.equal(error.retryAfter, 42); assert.equal(error.definitiveRejection, true);
    assert.match(error.message, /too quickly/);
    return true;
  });
  const saved = JSON.parse([...storage.values()][0]);
  assert.deepEqual(saved.pendingCommands, {}, 'the refused command is not kept for automatic replay');
  const posts = requests.filter(request => request.url.endsWith('/messages') && request.options.method === 'POST').length;
  await transport.replayPending();
  assert.equal(requests.filter(request => request.url.endsWith('/messages') && request.options.method === 'POST').length, posts);
  transport.close();
});

test('a limited session start fails with a readable message and a later connect can retry', async () => {
  install({limitSession: true});
  const transport = client();
  await assert.rejects(transport.connect(), /Too many chat sessions/);
  install();
  assert.equal((await transport.connect()).contactId, 'visitor');
  transport.close();
});
