import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Exercise the shipped widget against the native Worker, interrupting only HTTP delivery.
export async function widgetFailedSendBrowser({browser, origin, api, widgetKey, ownerToken, evidence}) {
  const observations = [];
  for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
    const context = await browser.newContext({viewport}), page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const storageKey = `rer-widget:${api}:${widgetKey}`;
    const savedSession = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    const settled = () => page.waitForFunction(key => {
      const session = JSON.parse(localStorage.getItem(key));
      return session?.pendingCommands && Object.keys(session.pendingCommands).length === 0;
    }, storageKey);
    try {
      await page.goto(origin);
      await page.locator('textarea[name=content]').waitFor({state: 'visible'});
      await page.locator('.happytohelp-connection-state').waitFor({state: 'hidden'});
      const composer = page.locator('textarea[name=content]');
      const send = async content => {
        const delivered = page.waitForResponse(response => response.request().method() === 'POST' && /\/api\/conversations\/[^/]+\/messages$/.test(new URL(response.url()).pathname));
        await composer.fill(content);
        await page.locator('button[name=submit]').click();
        assert.equal((await delivered).status(), 200, 'visitor send reaches the native server');
        await settled();
      };
      await send('Hello');
      const session = await savedSession();

      await page.route('**/api/conversations/*/messages', route =>
        route.request().method() === 'POST' ? route.abort('failed') : route.continue());
      await composer.fill('Can you help?');
      await page.locator('button[name=submit]').click();
      const reconnect = page.getByRole('button', {name: 'Reconnect', exact: true});
      await reconnect.waitFor({state: 'visible'});
      await page.locator('.happytohelp-chat-box-status-failed').waitFor({state: 'visible'});
      // The review waited three seconds for transcript auto-scroll to finish.
      await page.waitForTimeout(3000);
      const geometry = await reconnect.evaluate(button => {
        const notice = button.closest('.happytohelp-connection-state');
        const root = button.getRootNode();
        const transcript = root.querySelector('.happytohelp-chatlist-container');
        const rect = element => {
          const {x, y, width, height, top, right, bottom, left} = element.getBoundingClientRect();
          return {x, y, width, height, top, right, bottom, left};
        };
        const visible = element => {
          const box = element.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0 || box.top < 0 || box.left < 0 || box.right > innerWidth || box.bottom > innerHeight) return false;
          for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
            if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1)) return false;
            if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (box.left < bounds.left - 1 || box.right > bounds.right + 1)) return false;
          }
          // Rounded corners intentionally expose the background. Probe painted
          // edge centres and the centre, after checking the entire clip bounds.
          const centreX = (box.left + box.right) / 2, centreY = (box.top + box.bottom) / 2;
          return [[centreX, box.top + 2], [centreX, box.bottom - 2],
            [box.left + 2, centreY], [box.right - 2, centreY], [centreX, centreY]].every(([x, y]) => {
            const hit = root.elementFromPoint(x, y);
            return hit === element || element.contains(hit);
          });
        };
        return {notice: rect(notice), reconnect: rect(button), transcript: rect(transcript),
          scrollTop: transcript.scrollTop, noticeVisible: visible(notice), reconnectVisible: visible(button)};
      });
      await page.screenshot({path: `${evidence}/${viewport.width}-failed-send.png`});
      const observation = {viewport, ...geometry};
      observations.push(observation);
      await writeFile(`${evidence}/failed-send.json`, JSON.stringify(observations, null, 2) + '\n');
      await page.unroute('**/api/conversations/*/messages');

      await composer.focus();
      let keyboardReached = false;
      for (let step = 0; step < 30; step++) {
        await page.keyboard.press('Shift+Tab');
        keyboardReached = await reconnect.evaluate(button => button.getRootNode().activeElement === button);
        if (keyboardReached) break;
      }
      assert.equal(keyboardReached, true, 'keyboard navigation reaches Reconnect');
      const focus = await reconnect.evaluate(button => {
        const style = getComputedStyle(button);
        return {visible: button.matches(':focus-visible'), outline: style.outlineStyle, width: style.outlineWidth};
      });
      assert.ok(focus.visible && focus.outline !== 'none' && parseFloat(focus.width) > 0, 'Reconnect has visible keyboard focus');
      await page.screenshot({path: `${evidence}/${viewport.width}-reconnect-focus.png`});
      await page.keyboard.press('Enter');
      await page.locator('.happytohelp-connection-state').waitFor({state: 'hidden'});
      await settled();
      await page.locator('.happytohelp-chat-box-status-failed').waitFor({state: 'hidden'});
      const resumed = await savedSession();
      assert.equal(resumed.contactId, session.contactId);
      assert.equal(resumed.conversationId, session.conversationId);
      await send('Thank you');
      const response = await fetch(`${api}/api/conversations/${session.conversationId}/messages`, {
        headers: {Authorization: `Bearer ${ownerToken}`},
      });
      assert.equal(response.status, 200);
      const transcript = await response.json();
      for (const content of ['Hello', 'Can you help?', 'Thank you']) {
        assert.equal(transcript.messages.filter(message => message.content === content).length, 1, 'each visitor message is stored once');
      }
      assert.deepEqual(pageErrors, []);
      Object.assign(observation, {keyboardReached, focus, sameConversation: true, recoveredMessageCount: 1, subsequentSendCount: 1, pageErrors});
      await page.screenshot({path: `${evidence}/${viewport.width}-recovered.png`});
      await writeFile(`${evidence}/failed-send.json`, JSON.stringify(observations, null, 2) + '\n');
    } finally {await context.close();}
  }
  for (const observation of observations) {
    assert.equal(observation.noticeVisible, true, `${observation.viewport.width}: failed-send connection notice remains fully visible after auto-scroll`);
    assert.equal(observation.reconnectVisible, true, `${observation.viewport.width}: Reconnect remains fully visible after auto-scroll`);
  }
  return ['failed-send recovery stays visible at desktop and phone widths', 'keyboard Reconnect restores the conversation and failed message once', 'visitor can send again after reconnect'];
}
