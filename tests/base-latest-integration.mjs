import {d1PreparationSchema} from '../src/modules/import-kit/src/d1/preparation-schema.ts';
import {d1CustodyStateSchema} from '../src/modules/import-kit/src/d1/custody-state-schema.ts';
import {d1NativeStagingSchema} from '../src/modules/import-kit/src/d1/native-staging-schema.ts';
import {d1LegacyStreamReceiptUpgrade,d1StagingSchema} from '../src/modules/import-kit/src/d1/staging-schema.ts';
import {d1StreamOriginSchema} from '../src/modules/import-kit/src/d1/stream-origin.ts';
import {d1ErasureSchema} from '../src/modules/import-kit/src/d1/erasure-schema.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import * as legacy from '../src/vendor/base/modules/sendgrid-email/src/sender.ts';
import * as canonical from '../src/vendor/base/modules/mail/src/sendgrid-email/index.mjs';
import {packagingConfig} from '../scripts/delivery/base/package.mjs';
import {loadSetupManifest} from '../scripts/delivery/base/setup-manifest.mjs';
import {preservedUndoEvolution} from '../src/modules/import-kit/src/d1/evolutions/0001-preserved-undo.ts';

// Fixtures terminate at the actual HTTP dependency; no external request is made.
test('mirrored deprecated SendGrid entrypoint uses the canonical transport and error identity', async () => {
  for (const name of ['sendSendGrid', 'serializeSendGridMessage', 'SendGridSendError']) assert.equal(legacy[name], canonical[name]);
  const apiKey = randomBytes(24).toString('hex');
  const message = {deliveryId: 'mirrored-delivery', from: 'support@example.test', to: ['owner@example.test'], subject: 'Transport check', text: 'Message', replyTo: 'reply@example.test', headers: {'Auto-Submitted': 'auto-generated'}};
  let attempts = 0;
  const result = await legacy.sendSendGrid({apiKey, message, fetch: async (url, init) => {
    attempts++;
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(init.redirect, 'manual');
    assert.ok(new Headers(init.headers).get('authorization') === `Bearer ${apiKey}`, 'transport uses the supplied private key');
    assert.deepEqual(JSON.parse(init.body), JSON.parse(canonical.serializeSendGridMessage(message)));
    return new Response(null, {status: 202, headers: {'X-Message-Id': 'fixture-receipt'}});
  }});
  assert.deepEqual(result, {provider: 'sendgrid', providerMessageId: 'fixture-receipt', state: 'accepted'});
  for (const [status, outcome] of [[401, 'rejected'], [429, 'rate_limited'], [500, 'ambiguous'], [302, 'ambiguous']]) {
    await assert.rejects(legacy.sendSendGrid({apiKey, message, fetch: async () => {attempts++; return new Response(null, {status});}}), error => error instanceof canonical.SendGridSendError && error.outcome === outcome && error.status === status);
  }
  await assert.rejects(legacy.sendSendGrid({apiKey, message, fetch: async () => {attempts++; throw Error('fixture network loss');}}), error => error instanceof canonical.SendGridSendError && error.outcome === 'ambiguous');
  assert.equal(attempts, 6, 'each submission makes exactly one attempt, including ambiguous outcomes');
});

test('new native migration contains every exact official D1 evolution statement without editing old SQL',async()=>{
 const sql=await readFile(new URL('../migrations/116_import_kit_custody.sql',import.meta.url),'utf8');
 assert.equal(sql.replace(/^--[^\n]*\n/gm,''),preservedUndoEvolution.map(statement=>statement+';').join('\n')+'\n');
 const runtime=await readFile(new URL('../migrations/118_import_kit_runtime.sql',import.meta.url),'utf8');
 assert.equal(runtime.replace(/^--[^\n]*\n/gm,''),[d1ErasureSchema,d1StreamOriginSchema,d1LegacyStreamReceiptUpgrade,d1StagingSchema,d1NativeStagingSchema,d1CustodyStateSchema,d1PreparationSchema].map(group=>group.map(statement=>statement+';').join('\n')).join('\n\n')+'\n');
});

test('exported producer has its complete executable schema closure and preserves no-setup product policy', async () => {
  const directory = new URL('../scripts/delivery/base/', import.meta.url);
  const roots = (await readdir(directory)).filter(name => name.endsWith('.mjs'));
  const generators = (await readdir(new URL('generators/', directory))).filter(name => name.endsWith('.mjs'));
  // Import every executable dependency: a dangling portable import cannot pass.
  for (const name of [...roots, ...generators.map(name => `generators/${name}`), 'schema/json-schema.mjs', 'schema/setup-validation.mjs']) await import(new URL(name, directory));
  const config = JSON.parse(await readFile(new URL('packaging.json', directory)));
  assert.equal(packagingConfig(config).setup, undefined);
  assert.equal(await loadSetupManifest(process.cwd(), undefined), null);
});
