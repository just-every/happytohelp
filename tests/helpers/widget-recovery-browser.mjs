import assert from 'node:assert/strict';

// Native React widget + native Worker. Only network interruption/delay is injected.
export async function widgetRecoveryBrowser({browser, origin, api, widgetKey, ownerToken}) {
  const context = await browser.newContext(), page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const storageKey = `rer-widget:${api}:${widgetKey}`;
  const headers = {Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json'};
  try {
    await page.addInitScript(() => {
      const NativeSocket = window.WebSocket;
      window.recoverySockets = [];
      window.WebSocket = class extends NativeSocket {
        constructor(...args) {super(...args); window.recoverySockets.push(this);}
      };
    });
    await page.route('**/api/identity/widget/session', route => route.abort('failed'));
    await page.goto(origin);
    await page.getByRole('button', {name: 'Reconnect', exact: true}).waitFor();
    assert.equal(await page.evaluate(() => recoverySockets.length), 0);
    await page.unroute('**/api/identity/widget/session');
    await page.getByRole('button', {name: 'Reconnect', exact: true}).click();
    await page.locator('.happytohelp-connection-state').waitFor({state: 'hidden'});
    assert.equal(await page.evaluate(() => recoverySockets.at(-1)?.readyState), 1, 'recovery means native socket OPEN');
    const session = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.ok(session.contactId && session.conversationId);

    // Freeze message delivery to inspect the optimistic bubble before the server
    // can repair its contact identity in the returned transcript.
    let release;
    const held = new Promise(resolve => {release = resolve;});
    await page.route('**/api/conversations/*/messages', async route => {
      if (route.request().method() === 'POST') await held;
      await route.continue();
    });
    try {
      await page.locator('textarea[name=content]').fill('Visitor identity after initial recovery');
      await page.locator('button[name=submit]').click();
      await page.locator('.happytohelp-chat-local').getByText('Visitor identity after initial recovery', {exact: true}).waitFor();
    } finally {release();}
    await page.waitForFunction(key => {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved.pendingCommands && Object.keys(saved.pendingCommands).length === 0;
    }, storageKey);
    await page.unroute('**/api/conversations/*/messages');
    const before = await (await fetch(`${api}/api/conversations/${session.conversationId}/messages`, {headers})).json();
    assert.equal(before.messages.filter(message => message.content === 'Visitor identity after initial recovery').length, 1);

    await page.evaluate(() => new Promise(resolve => {
      const socket = recoverySockets.at(-1);
      socket.addEventListener('close', resolve, {once: true});
      socket.close(1000, 'Explicit reconnect proof');
    }));
    await page.getByRole('button', {name: 'Reconnect', exact: true}).click();
    await page.locator('.happytohelp-connection-state').waitFor({state: 'hidden'});
    assert.deepEqual(await page.evaluate(() => recoverySockets.map(socket => socket.readyState)), [3, 1]);
    const resumed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.equal(resumed.token, session.token);
    assert.equal(resumed.contactId, session.contactId);
    assert.equal(resumed.conversationId, session.conversationId);
    const response = await fetch(`${api}/api/conversations/${session.conversationId}/messages`, {
      method: 'POST', headers,
      body: JSON.stringify({localId: crypto.randomUUID(), content: 'Operator reply after explicit reconnect', expectedRevision: before.revision, expectedLastMessageId: before.lastMessageId}),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accepted, true);
    await page.getByText('Operator reply after explicit reconnect', {exact: true}).waitFor();
    assert.deepEqual(errors, []);
    return ['initial connection failure restores optimistic visitor identity', 'explicit reconnect opens a native replacement socket', 'recovered socket delivers operator reply in the same conversation'];
  } finally {await context.close();}
}
