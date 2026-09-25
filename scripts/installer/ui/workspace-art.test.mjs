import * as model from './model.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceArt } from '../../base-onboarding/ui/workspace-art.js';

function setup() {
  const draft = { allowedOrigin: 'https://example.com', name: 'Support', primaryColor: '#123456' }, calls = [];
  let failSave = false;
  const controller = workspaceArt({ model, read: () => draft, save: async () => { calls.push('save'); if (failSave) throw Error('Save failed'); }, request: async (path, options) => calls.push([path, JSON.parse(options.body)]) });
  controller.update({ agent: { attached: true } });
  return { draft, calls, controller, failSave: () => { failSave = true; } };
}
test('initial details and unrelated edits never queue art', async () => {
  const { controller, calls } = setup();
  await controller.commit(); controller.edited('ownerName'); await controller.commit();
  assert.deepEqual(calls, []);
});
test('committed context saves before queueing and duplicate commits queue once', async () => {
  const { controller, calls, draft } = setup();
  controller.edited('name'); await Promise.all([controller.commit(), controller.commit()]);
  assert.deepEqual(calls, ['save', ['/api/workspace-art', {}]]);
  controller.edited('name'); await controller.commit();
  assert.equal(calls.length, 3);
  draft.primaryColor = '#654321'; controller.edited('primaryColor'); await controller.commit();
  assert.deepEqual(calls.slice(-2), ['save', ['/api/workspace-art', {}]]);
});
test('invalid context and failed saves never queue art', async () => {
  const { controller, calls, draft, failSave } = setup();
  draft.allowedOrigin = 'example.com'; controller.edited('allowedOrigin'); await controller.commit();
  assert.deepEqual(calls, ['save']);
  draft.allowedOrigin = 'https://example.com'; failSave();
  await assert.rejects(controller.commit(), /Save failed/);
  assert.deepEqual(calls, ['save', 'save']);
});

test('manual commits save without requesting art and agent attachment alone never queues', async () => {
  const { controller, calls } = setup();
  controller.update({ agent: { attached: false } }); controller.edited('name'); await controller.commit();
  assert.deepEqual(calls, ['save']);
  controller.update({ agent: { attached: true } });
  assert.deepEqual(calls, ['save']);
});
