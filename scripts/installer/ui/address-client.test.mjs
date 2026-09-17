import * as model from './model.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { addressResolver } from '../../base-onboarding/ui/address-client.mjs';

const accountA = 'a'.repeat(32);
const accountB = 'b'.repeat(32);
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function harness(overrides = {}) {
  const state = {
    draft: {
      name: 'North Star Outfitters',
      target: 'remote',
      accountId: accountA,
      apiToken: 'test-token',
      prefixMode: 'automatic',
      addressMode: 'automatic',
      appOrigin: '',
    },
    known: { providers: { cloudflare: { authenticated: false } } },
  };
  const answers = [];
  const calls = [];
  let changed = 0;
  const requestImpl = overrides.request || (async () => ({ prefix: 'north-star-outfitters', appOrigin: 'https://north-star.example.workers.dev' }));
  const resolver = addressResolver({ model,
    read: () => state,
    request: async (path, options) => {
      calls.push({ path, options });
      return requestImpl(path, options);
    },
    answer: (key, value) => { answers.push([key, value]); state.draft[key] = value; },
    changed: () => { changed += 1; },
  });
  return { state, answers, calls, resolver, changed: () => changed };
}

test('automatic mode derives the prefix and applies the endpoint result', async () => {
  const { state, answers, calls, resolver } = harness();
  resolver.schedule();
  await wait(450);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/address');
  assert.deepEqual(JSON.parse(calls[0].options.body), { name: state.draft.name, accountId: accountA, apiToken: 'test-token' });
  assert.deepEqual(answers.at(-1), ['appOrigin', 'https://north-star.example.workers.dev']);
  assert.equal(state.draft.prefix, 'north-star-outfitters');
  assert.equal(state.draft.appOrigin, 'https://north-star.example.workers.dev');
  assert.equal(resolver.status.pending, false);
  assert.equal(resolver.status.error, '');
});

test('custom address mode preserves custom hosting values and skips resolution', async () => {
  const { state, answers, calls, resolver } = harness();
  state.draft.prefixMode = 'custom';
  state.draft.prefix = 'chosen-resource';
  state.draft.addressMode = 'custom';
  state.draft.appOrigin = 'https://team.example.test';
  resolver.schedule();
  await wait(450);

  assert.equal(calls.length, 0);
  assert.deepEqual(answers, []);
  assert.equal(state.draft.prefix, 'chosen-resource');
  assert.equal(state.draft.appOrigin, 'https://team.example.test');
  assert.equal(resolver.status.pending, false);
});

test('a result from an old target is ignored after switching accounts and target', async () => {
  let resolveRequest;
  const { state, answers, calls, resolver } = harness({
    request: () => new Promise(resolve => { resolveRequest = resolve; }),
  });
  resolver.schedule();
  await wait(450);
  assert.equal(calls.length, 1);
  assert.equal(resolver.status.pending, true);

  state.draft.accountId = accountB;
  resolver.schedule();
  state.draft.target = 'local';
  resolver.schedule();
  resolveRequest({ prefix: 'stale-prefix', appOrigin: 'https://stale.example.test' });
  await wait(0);

  assert.equal(state.draft.appOrigin, '');
  assert.equal(answers.some(([, value]) => value === 'https://stale.example.test'), false);
  assert.equal(answers.some(([, value]) => value === 'stale-prefix'), false);
  assert.equal(resolver.status.pending, false);
});

test('repeated scheduling for the same key keeps the original timer', async () => {
  const { calls, resolver } = harness();
  resolver.schedule();
  resolver.schedule();
  await wait(450);

  assert.equal(calls.length, 1);
});

test('a failed resolution can be retried with force', async () => {
  let attempt = 0;
  const { calls, resolver } = harness({
    request: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('Cloudflare unavailable');
      return { prefix: 'north-star-outfitters', appOrigin: 'https://north-star.example.workers.dev' };
    },
  });
  resolver.schedule();
  await wait(450);
  assert.equal(calls.length, 1);
  assert.equal(resolver.status.pending, false);
  assert.equal(resolver.status.error, 'Cloudflare unavailable');

  resolver.schedule();
  await wait(450);
  assert.equal(calls.length, 1);
  assert.equal(resolver.status.error, 'Cloudflare unavailable');

  resolver.schedule(true);
  await wait(450);
  assert.equal(calls.length, 2);
  assert.equal(resolver.status.pending, false);
  assert.equal(resolver.status.error, '');
});
