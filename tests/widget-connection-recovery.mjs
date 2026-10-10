import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WidgetTransport} from '../src/modules/widget/transport.js';
import {connectionFixture, settle} from './helpers/widget-connection-fixture.mjs';
import {contextHooks} from './helpers/widget-context-hooks.mjs';

const options = {apiOrigin: 'http://localhost:8779', widgetKey: 'recovery'};
const context = () => ({...options, contact: {name: 'Known visitor', identifier: 'known', hash: 'signature'}, settings: {collector: {enabled: false}}, conversationSettings: {}});

test('actual context admits identity/settings on initial failure retry and waits for the active socket handshake', async () => {
  const fixture = connectionFixture(); let host;
  try {
    fixture.state.settingsFailure = true;
    host = await contextHooks(context()); host.flush(); await settle();
    assert.equal(host.value.connectionState, 'interrupted');
    assert.deepEqual(host.value.contactAuth, {});
    assert.equal(host.value.conversationId, null);
    fixture.state.settingsFailure = false;
    await host.value.retryConnection();
    assert.equal(host.value.connectionState, 'connecting');
    assert.equal(fixture.sockets[0].readyState, 0);
    assert.deepEqual(host.value.contactAuth, {id: 'visitor', token: 'visitor-token'});
    assert.equal(host.value.contact.id, 'visitor');
    assert.equal(host.value.contact.name, 'Known visitor');
    assert.equal(host.value.conversationId, 'conversation');
    assert.equal(host.value.conversationSettings.ai_id, 'admitted-agent');
    assert.ok(host.value.connectErrors.length, 'errors stay visible until socket recovery');
    const admission = fixture.requests.find(request => request.url.endsWith('/widget/session'));
    assert.equal(JSON.parse(admission.options.body).contact_hash, 'signature');
    fixture.sockets[0].open(); await settle();
    assert.equal(host.value.connectionState, 'connected');
    assert.deepEqual(host.value.connectErrors, []);
    const first = fixture.sockets[0]; first.close();
    assert.equal(host.value.connectionState, 'interrupted');
    await Promise.all([host.value.retryConnection(), host.value.retryConnection()]);
    assert.equal(fixture.sockets.length, 2, 'concurrent clicks open one replacement');
    assert.equal(host.value.connectionState, 'connecting');
    first.onopen(); first.onerror();
    assert.equal(host.value.connectionState, 'connecting', 'stale events cannot change status');
    fixture.sockets[1].open(); await settle();
    assert.equal(host.value.connectionState, 'connected');
    assert.equal(fixture.state.sessionCount, 1);
    assert.equal(host.value.conversationId, 'conversation');
  } finally {host?.close(); fixture.restore();}
});

test('explicit recovery replaces a browser socket still marked open and teardown fences late handshakes', async () => {
  const fixture = connectionFixture(), events = [];
  const client = new WidgetTransport({...options, onEvent: event => events.push(event)});
  try {
    await client.connect(); fixture.sockets[0].open(); await settle();
    await client.reconnect();
    assert.equal(fixture.sockets.length, 2);
    assert.equal(fixture.sockets[0].readyState, 3);
    const connected = events.filter(event => event.type === 'connected').length;
    fixture.sockets[0].onopen();
    assert.equal(events.filter(event => event.type === 'connected').length, connected);
    client.close(); fixture.sockets[1].open();
    assert.equal(events.filter(event => event.type === 'connected').length, connected);
    await assert.rejects(client.reconnect(), /closed/);
  } finally {client.close(); fixture.restore();}
});

test('revoked socket refuses explicit recovery and pending replay without replacing durable visitor identity', async () => {
  const fixture = connectionFixture(), failures = [];
  const client = new WidgetTransport({...options, onError: error => failures.push(error.message)});
  try {
    await client.connect(); fixture.sockets[0].open(); await settle();
    fixture.state.messageFailure = true;
    await assert.rejects(client.send({local_id: 'unknown', content: 'Possibly admitted'}), /Response lost/);
    const frozen = JSON.parse(localStorage.getItem(client.storageKey));
    fixture.sockets[0].close(1008);
    const requestCount = fixture.requests.length;
    await assert.rejects(client.reconnect(), /revoked/);
    await assert.rejects(client.send({local_id: 'unknown', content: 'Possibly admitted'}), /revoked/);
    await client.replayPending(); client.openSocket(); fixture.sockets[0].onopen();
    assert.equal(fixture.requests.length, requestCount);
    assert.equal(fixture.sockets.length, 1);
    assert.deepEqual(JSON.parse(localStorage.getItem(client.storageKey)), frozen);
    assert.deepEqual(failures, ['Conversation session was revoked']);
  } finally {client.close(); fixture.restore();}
});

test('recovery keeps the uncertain message command exact and only replays after a new handshake', async () => {
  const fixture = connectionFixture(), client = new WidgetTransport(options);
  try {
    await client.connect(); fixture.sockets[0].open(); await settle();
    fixture.state.messageFailure = true;
    await assert.rejects(client.send({local_id: 'stable', content: 'Once only'}), /Response lost/);
    const command = structuredClone(client.session.pendingCommands.stable);
    const writes = () => fixture.requests.filter(request => request.options.method === 'POST' && request.url.endsWith('/messages'));
    fixture.state.messageFailure = false; fixture.sockets[0].close();
    await client.reconnect();
    assert.equal(writes().length, 1, 'HTTP recovery alone never replays the uncertain command');
    assert.deepEqual(client.session.pendingCommands.stable, command);
    fixture.sockets[1].open(); await settle();
    assert.equal(writes().length, 2);
    assert.deepEqual(JSON.parse(writes()[1].options.body), command, 'duplicate admission uses the original identity/frontier');
    assert.equal(fixture.state.transcript.length, 1);
    assert.equal(client.session.pendingCommands.stable, undefined);
    assert.equal(fixture.state.sessionCount, 1);
  } finally {client.close(); fixture.restore();}
});

test('a socket closing while reconnect awaits the admitted session is replaced immediately', async () => {
  const fixture = connectionFixture(), client = new WidgetTransport(options);
  try {
    await client.connect(); fixture.sockets[0].open(); await settle();
    const recovery = client.reconnect(); fixture.sockets[0].close();
    await recovery;
    assert.equal(fixture.sockets.length, 2);
    assert.equal(fixture.sockets[1].readyState, 0);
  } finally {client.close(); fixture.restore();}
});

test('a revoked handshake refresh cannot replay a pending command after its response arrives', async () => {
  const fixture = connectionFixture(), client = new WidgetTransport(options);
  try {
    await client.connect();
    client.session.pendingCommands = {held: {localId: 'held', content: 'Uncertain', expectedRevision: 0, expectedLastMessageId: null, mediaIds: []}};
    const nativeFixtureFetch = globalThis.fetch;
    let release;
    const held = new Promise(resolve => {release = resolve;});
    globalThis.fetch = async (url, options) => {if (url.endsWith('/messages')) await held; return nativeFixtureFetch(url, options);};
    fixture.sockets[0].open(); fixture.sockets[0].close(1008);
    release(); await settle();
    assert.equal(fixture.requests.filter(request => request.options.method === 'POST' && request.url.endsWith('/messages')).length, 0);
    assert.equal(client.session.pendingCommands.held.content, 'Uncertain');
  } finally {client.close(); fixture.restore();}
});
