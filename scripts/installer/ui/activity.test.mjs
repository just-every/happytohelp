import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { activityStatus } from '../../base-onboarding/ui/activity.js';
import * as model from './model.mjs';

function dom() {
  const document = { createElement: tag => new Element(tag), createElementNS: (namespace, tag) => new Element(tag), querySelector: selector => elements.get(selector) };
  class Element {
    constructor(tag) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.dataset = {}; this.attributes = {}; this.writes = 0; }
    set textContent(value) { this.text = value; this.writes++; }
    get textContent() { return this.text; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
  }
  const elements = new Map(['.brand', '.panel', '#open', '#activity', '#loading', '#form', '#installation', '#back'].map(id => [id, document.createElement('div')]));
  return { document, elements, container: elements.get('#activity') };
}
const event = (id, message, phase = 'checking') => ({ id, at: '2026-09-17T00:00:00Z', source: 'agent', phase, topic: 'workspace', message });

test('status starts honestly and announces only changed latest text', () => {
  const { container } = dom(), render = activityStatus(container), update = events => render(events, { mode: 'connected', attached: true }), [, latest, history] = container.children;
  assert.equal(latest.hidden, true);
  update([]);
  assert.equal(latest.textContent, 'Waiting for setup updates');
  assert.equal(latest.attributes['aria-live'], 'polite');
  assert.equal(history.hidden, true);
  update([event(1, 'Checking workspace details.')]);
  const writes = latest.writes;
  update([event(1, 'Checking workspace details.')]);
  update([event(2, 'Checking workspace details.')]);
  assert.equal(latest.writes, writes);
  update([event(3, 'Please enter your website.', 'needs_input')]);
  assert.equal(latest.textContent, 'Please enter your website.');
  assert.equal(container.dataset.phase, 'needs_input');
  assert.equal(container.children[0].children.length, 3);
  assert.equal(container.children[0].children[0].className, 'known-group-title');
  update([event(2, 'Older checking result.')]);
  update([]);
  assert.equal(latest.textContent, 'Please enter your website.');
});

test('recent history is bounded, outside live region, and renders messages as text', () => {
  const { container } = dom(), render = activityStatus(container), update = events => render(events, { mode: 'connected', attached: true }), [, latest, history] = container.children;
  const messages = Array.from({ length: 8 }, (_, index) => event(index, `<img src=x onerror=alert(${index})>`));
  update(messages);
  assert.equal(latest.textContent, messages.at(-1).message);
  assert.equal(latest.children.length, 0);
  assert.equal(history.attributes['aria-live'], undefined);
  assert.equal(history.children[1].children.length, 3);
  assert.equal(history.children[1].children[0].textContent, messages.at(-2).message);
  history.open = true;
  update([...messages, event(8, 'Workspace details filled.', 'filled')]);
  assert.equal(history.open, true);
});

test('an activity-only state poll preserves the active step, fields and focused input', async () => {
  const { document, elements } = dom();
  const input = document.createElement('input'); input.value = 'Website in progress';
  document.activeElement = input;
  const form = elements.get('#form'); form.append(input);
  const state = { phase: 'ready', known: {}, draft: {}, activity: [], agent: { mode: 'connected', attached: true } };
  const source = (await readFile(new URL('../../base-onboarding/ui/app.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/^poll\(\);$/m, '');
  const context = vm.createContext({ ...model, document, activityStatus, workspaceArt: () => ({ update() {}, edited() {}, async commit() {} }), addressResolver: () => ({ schedule() {} }), setTimeout, clearTimeout });
  vm.runInContext(source + '\ninitialized = true; activeGroup = "workspace"; globalThis.receive = applyState; globalThis.group = () => activeGroup; globalThis.seed = value => { state = value; };', context);
  context.seed(state);
  context.receive({ ...state, activity: [event(1, 'Checking workspace details.')] });
  assert.equal(context.group(), 'workspace');
  assert.equal(document.activeElement, input);
  assert.equal(form.children[0], input);
  assert.equal(input.value, 'Website in progress');
  assert.equal(elements.get('#activity').children[1].textContent, 'Checking workspace details.');
});


test('manual setup changes only after attachment and the handoff copies the server prompt', async () => {
  const { container } = dom();
  const copied = [], calls = [];
  const update = activityStatus(container, { request: async path => { calls.push(path); return { prompt: 'Connect to the current local session.' }; }, clipboard: { writeText: async text => copied.push(text) } });
  const [header, latest, history, dialog] = container.children;
  const connect = header.children[1];
  assert.equal(header.children.length, 3);
  assert.equal(header.children[0].textContent, 'Preparing setup');
  assert.equal(connect.hidden, true);
  update([], undefined); assert.equal(header.children[0].textContent, 'Preparing setup');
  update([], { mode: 'connecting', attached: false });
  assert.equal(header.children[0].textContent, 'Preparing setup'); assert.equal(latest.textContent, 'Waiting for your agent'); assert.equal(connect.hidden, true);
  update([event(1, 'Installer started')], { mode: 'manual', attached: false });
  assert.equal(latest.hidden, false); assert.equal(latest.textContent, 'Complete the setup steps to get started.'); assert.equal(history.hidden, true);
  await connect.onclick();
  assert.equal(dialog.open, true); assert.deepEqual(calls, ['/api/agent-handoff']);
  const prompt = dialog.children[3], notice = dialog.children[4], [copy, close] = dialog.children[5].children;
  assert.equal(prompt.readOnly, true); assert.equal(copy.disabled, false);
  await copy.onclick(); assert.deepEqual(copied, [prompt.value]); assert.match(notice.textContent, /Prompt copied/);
  assert.equal(header.children[0].textContent, 'Manual setup');
  close.onclick(); assert.equal(dialog.open, false);
  update([event(2, 'Checking workspace')], { mode: 'connected', attached: true });
  assert.equal(header.children[0].textContent, 'Agent status'); assert.equal(connect.hidden, true);
  update([event(3, 'Ready for your details')], { mode: 'connected', attached: true });
  assert.equal(header.children.length, 3); assert.equal(latest.textContent, 'Ready for your details');
});

test('handoff failures remain visible and clipboard failure never claims success', async () => {
  const { container } = dom();
  let fail = true;
  activityStatus(container, { request: async () => { if (fail) throw Error('Session unavailable'); return { prompt: 'Local connection prompt' }; }, clipboard: { writeText: async () => { throw Error('Denied'); } } });
  const [header, , , dialog] = container.children;
  const connect = header.children[1];
  const prompt = dialog.children[3], notice = dialog.children[4], [copy] = dialog.children[5].children;
  await connect.onclick(); assert.equal(copy.disabled, true); assert.equal(notice.textContent, 'Session unavailable');
  fail = false; await connect.onclick(); await copy.onclick();
  assert.match(notice.textContent, /Could not copy/); assert.equal(prompt.selected, true);
});


test('working indicator follows accepted checking activity and clears outside connected mode', () => {
  const { container } = dom(), update = activityStatus(container);
  const header = container.children[0], working = header.children[2];
  assert.equal(working.hidden, true);
  update([event(1, 'Checking workspace')], { mode: 'connected', attached: true });
  assert.equal(working.hidden, false); assert.equal(header.attributes['aria-busy'], 'true');
  assert.equal(working.attributes['aria-live'], undefined);
  for (const [index, phase] of ['filled', 'complete', 'needs_input', 'failed'].entries()) {
    update([event(index + 2, phase, phase)], { mode: 'connected', attached: true });
    assert.equal(working.hidden, true); assert.equal(header.attributes['aria-busy'], 'false');
  }
  update([event(6, 'Checking again')], { mode: 'connected', attached: true });
  assert.equal(working.hidden, false);
  update([], { mode: 'manual', attached: false });
  assert.equal(working.hidden, true); assert.equal(container.dataset.phase, 'manual');
  assert.equal(header.attributes['aria-busy'], 'false');
  update([], undefined); assert.equal(container.dataset.phase, 'preparing');
});
