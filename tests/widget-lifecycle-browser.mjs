import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react from '@vitejs/plugin-react';

const {chromium} = await import(process.env.H2H_PLAYWRIGHT_MODULE || process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const entry = root + '__widget-lifecycle-entry.js';
const output = await build({
  root, configFile:false, publicDir:false, logLevel:'error',
  plugins:[react(), {
    name:'widget-lifecycle-entry',
    resolveId(id) { if (id === entry) return '\0' + entry; },
    load(id) {
      if (id === '\0' + entry) return `import Collector from ${JSON.stringify(root + 'src/modules/widget/js/collection/Collector.jsx')};
        import {mountWidget,mountPreview} from ${JSON.stringify(root + 'src/modules/widget/index.jsx')};
        window.lifecycle = {Collector,mountWidget,mountPreview};`;
    },
  }],
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{write:false, lib:{entry, name:'LifecycleTest', formats:['iife']}, minify:false},
});
const bundle = (Array.isArray(output) ? output[0] : output).output.find(item => item.type === 'chunk').code;
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/test.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/test.js' ? bundle : '<!doctype html><title>Lifecycle proof</title><button id="host">Host action</button><input id="field" aria-label="Host field"><div id="mount"></div><div id="preview"></div><script src="/test.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  // Wrap native resources without replacing their behavior, so teardown can be
  // checked before any delayed callback gets a chance to run.
  await page.evaluate(() => {
    const listeners = [], timers = new Set(), observers = new Set();
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
    EventTarget.prototype.addEventListener = function(type, fn, options) {
      if ((this === window || this === document) && !listeners.some(item => item.target === this && item.type === type && item.fn === fn && item.capture === capture(options))) {
        listeners.push({target:this, type, fn, capture:capture(options)});
      }
      return add.call(this, type, fn, options);
    };
    EventTarget.prototype.removeEventListener = function(type, fn, options) {
      const index = listeners.findIndex(item => item.target === this && item.type === type && item.fn === fn && item.capture === capture(options));
      if (index >= 0) listeners.splice(index, 1);
      return remove.call(this, type, fn, options);
    };
    const timeout = window.setTimeout, clear = window.clearTimeout;
    window.setTimeout = (fn, delay, ...args) => {
      const id = timeout(() => { timers.delete(id); fn(...args); }, delay);
      timers.add(id); return id;
    };
    window.clearTimeout = id => { timers.delete(id); clear(id); };
    const NativeObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeObserver {
      observe(...args) { observers.add(this); return super.observe(...args); }
      disconnect() { observers.delete(this); return super.disconnect(); }
    };
    window.resources = () => ({listeners:listeners.length, timers:timers.size, observers:observers.size});
    window.actions = []; window.messages = []; window.oldCallbacks = 0;
  });
  const counts = await page.evaluate(() => {
    const {Collector} = lifecycle;
    Collector.onAction(() => oldCallbacks++);
    Collector.init(); Collector.init();
    Collector.setMessageHandler((...args) => messages.push(args));
    const counts = resources();
    // Queue each delayed path, including the hesitation observer's CTA refresh.
    document.querySelector('#field').dispatchEvent(new KeyboardEvent('keydown', {key:'a', bubbles:true}));
    document.querySelector('#host').dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
    for (let i = 0; i < 4; i++) document.querySelector('#host').dispatchEvent(new MouseEvent('click', {bubbles:true}));
    document.dispatchEvent(new Event('selectionchange'));
    window.dispatchEvent(new Event('scroll'));
    const modal = document.createElement('div'); modal.className = 'modal'; document.body.appendChild(modal);
    const field = document.querySelector('#field'); field.name = 'email';
    field.dispatchEvent(new Event('invalid', {bubbles:true}));
    field.dispatchEvent(new FocusEvent('focus', {bubbles:true}));
    return counts;
  });
  assert.ok(counts.listeners > 10 && counts.observers >= 2 && counts.timers > 0, 'Collector really installed browser resources');
  const stopped = await page.evaluate(() => {
    lifecycle.Collector.destroy(); lifecycle.Collector.destroy();
    return {resources:resources(), callbacks:oldCallbacks, messages:messages.length};
  });
  assert.deepEqual(stopped.resources, {listeners:0, timers:0, observers:0});
  await page.waitForTimeout(1100);
  assert.deepEqual(await page.evaluate(() => ({callbacks:oldCallbacks, messages:messages.length})), {callbacks:stopped.callbacks, messages:stopped.messages});
  await page.evaluate(() => {
    const {Collector} = lifecycle;
    Collector.onAction(action => actions.push(action));
    Collector.setCollectorEnabled(true); Collector.init();
    Collector.setMessageHandler((...args) => messages.push(args));
  });
  await page.locator('#host').click();
  const remounted = await page.evaluate(() => ({actions, oldCallbacks, resources:resources()}));
  assert.equal(remounted.oldCallbacks, stopped.callbacks, 'Previous lifecycle subscriptions were removed');
  assert.equal(remounted.actions.filter(action => /Clicked on.*Host action/i.test(action)).length, 1, 'Remounted collector records one host click');
  assert.equal(remounted.actions.filter(action => /^Visited page/.test(action)).length, 1, 'Fresh lifecycle records its initial page');
  assert.equal(remounted.resources.listeners, counts.listeners, 'Remount adds one set of listeners');
  const disabled = await page.evaluate(() => { lifecycle.Collector.setCollectorEnabled(false); return resources(); });
  assert.deepEqual(disabled, {listeners:0, timers:0, observers:0}, 'Privacy disable stops all collection resources');
  const reenabled = await page.evaluate(() => {
    lifecycle.Collector.setCollectorEnabled(true); lifecycle.Collector.init(); lifecycle.Collector.init();
    return resources();
  });
  assert.equal(reenabled.listeners, counts.listeners, 'Reenable installs exactly one listener set');
  assert.equal(reenabled.observers, counts.observers, 'Reenable installs exactly one observer set');
  await page.evaluate(() => lifecycle.Collector.destroy());

  const handles = await page.evaluate(() => {
    const {mountWidget, Collector} = lifecycle;
    const options = {apiOrigin:location.origin, widgetKey:'lifecycle-test', target:document.querySelector('#mount'), settings:{await_consent:true}};
    const first = mountWidget(options);
    Collector.setCollectorEnabled(true); Collector.init();
    first.consent(false);
    const revoked = resources();
    first.destroy();
    const second = mountWidget(options);
    first.destroy(); first.consent(true); first.open(); first.update({});
    let retainedOwnership = false;
    try { mountWidget(options); } catch { retainedOwnership = true; }
    second.destroy();
    const third = mountWidget(options); third.destroy();
    return {revoked, retainedOwnership, children:document.querySelector('#mount').childElementCount};
  });
  assert.deepEqual(handles.revoked, {listeners:0, timers:0, observers:0}, 'Consent revocation clears collector resources');
  assert.equal(handles.retainedOwnership, true, 'Stale handles cannot release the current live widget');
  assert.equal(handles.children, 0, 'Destroyed handle cannot remount through consent');
  await page.evaluate(() => {
    window.previewHandle = lifecycle.mountPreview({target:document.querySelector('#preview'), preview:{open:true}});
  });
  await page.locator('#preview .happytohelp-interact').waitFor({state:'visible'});
  await page.evaluate(() => { previewHandle.destroy(); previewHandle.destroy(); previewHandle.open(); previewHandle.update({}); });
  assert.equal(await page.locator('#preview').evaluate(target => target.childElementCount), 0);
  await page.evaluate(() => { window.previewHandle = lifecycle.mountPreview({target:document.querySelector('#preview'), preview:{open:true}}); });
  await page.locator('#preview .happytohelp-interact').waitFor({state:'visible'});
  await page.evaluate(() => previewHandle.destroy());
  assert.deepEqual(errors, []);
  console.log('Widget lifecycle browser passed: collector resource cleanup, remount actions, stale live handles, consent revocation, preview destroy/remount');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
