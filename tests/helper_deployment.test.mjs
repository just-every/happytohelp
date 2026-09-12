import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploymentSettings, databaseId, prepareRemote, validateEmitted } from '../scripts/setup-deployment.mjs';

const configured = () => deploymentSettings({ CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-only', H2H_DEPLOY_ENV: 'acceptance', APP_ORIGIN: 'https://support.example.test', H2H_BOOTSTRAP_TOKEN: 'test-only', H2H_OWNER_EMAIL: 'owner@example.test', H2H_OWNER_PASSWORD: 'test-password-only', H2H_OWNER_NAME: 'Owner' });
const uuid = '11111111-2222-4333-8444-555555555555';

test('deployment refuses ambiguous or invalid owner settings and database responses', () => {
  assert.throws(() => deploymentSettings({}), /ACCOUNT_ID/);
  assert.throws(() => databaseId({}, 'db'), /refusing to create/);
  assert.throws(() => databaseId([{ name: 'db', uuid: 'bad' }], 'db'), /invalid D1/);
  assert.throws(() => databaseId([{ name: 'db', uuid }, { name: 'db', uuid }], 'db'), /ambiguous/);
});

test('setup finds or creates exact named D1 and never edits committed defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'h2h-deployment-test-'));
  try {
    const original = JSON.stringify({ main: 'src/server.ts', compatibility_date: '2026-09-08', d1_databases: [{ binding: 'DB', database_id: 'local-only' }] });
    await writeFile(join(root, 'wrangler.jsonc'), original);
    await mkdir(join(root, 'migrations'));
    const settings = configured();
    let lists = 0;
    const calls = [];
    const run = async argv => {
      calls.push(argv);
      return argv.includes('list') ? JSON.stringify(++lists === 1 ? [] : [{ name: settings.database, uuid }]) : '';
    };
    const result = await prepareRemote(root, settings, run);
    assert.equal(result.id, uuid);
    assert.deepEqual(calls.map(call => call[3]), ['list', 'create', 'list']);
    assert.equal(await readFile(join(root, 'wrangler.jsonc'), 'utf8'), original);
    const config = JSON.parse(await readFile(result.path, 'utf8'));
    assert.equal(config.account_id, settings.account);
    assert.equal(config.d1_databases[0].database_id, uuid);
    assert.ok(!JSON.stringify(config).includes(settings.owner.password));
    const built = { ...config, main: 'index.js', assets: { directory: '../client' } };
    validateEmitted(built, settings, uuid);
    assert.throws(() => validateEmitted({ ...built, account_id: 'wrong' }, settings, uuid), /does not match/);
    assert.throws(() => validateEmitted(config, settings, uuid), /does not match/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('workers.dev origin verifies account identity before provisioning and stays explicit', async () => {
  const settings = deploymentSettings({ CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-only', H2H_DEPLOY_ENV: 'pilot-20260912', APP_ORIGIN: 'https://support-happytohelp-pilot-20260912.james-d16.workers.dev', H2H_BOOTSTRAP_TOKEN: 'test-only', H2H_OWNER_EMAIL: 'owner@example.test', H2H_OWNER_PASSWORD: 'test-password-only', H2H_OWNER_NAME: 'Owner' });
  const root=await mkdtemp(join(tmpdir(),'h2h-workers-dev-test-'));
  let commands=0;
  const run=async()=>{commands++;return JSON.stringify([{name:settings.database,uuid}]);};
  try {
    await writeFile(join(root,'wrangler.jsonc'),JSON.stringify({main:'src/server.ts'}));
    await assert.rejects(prepareRemote(root,settings,run,async()=>Response.json({success:true,result:{subdomain:'another-account'}})),/does not match/);
    assert.equal(commands,0);
    await assert.rejects(prepareRemote(root,settings,run,async()=>new Response('',{status:403})),/Cannot verify/);
    assert.equal(commands,0);
    const fetcher=async(url,options)=>{assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${settings.account}/workers/subdomain`);assert.equal(options.headers.Authorization,'Bearer test-only');assert.equal(options.redirect,'error');return Response.json({success:true,result:{subdomain:'james-d16'}});};
    const result=await prepareRemote(root,settings,run,fetcher);
    const config=JSON.parse(await readFile(result.path,'utf8'));
    assert.equal(config.workers_dev,true);assert.deepEqual(config.routes,[]);
    assert.ok(!JSON.stringify(config).includes('test-only'));
    const built={...config,main:'index.js',assets:{directory:'../client'}};
    validateEmitted(built,settings,uuid);
    assert.throws(()=>validateEmitted({...built,workers_dev:false},settings,uuid),/does not match/);
    assert.throws(()=>validateEmitted({...built,routes:[{pattern:'other.example',custom_domain:true}]},settings,uuid),/does not match/);
    assert.throws(()=>deploymentSettings({CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-only',H2H_DEPLOY_ENV:'pilot-20260912',APP_ORIGIN:'https://wrong-worker.james-d16.workers.dev'}),/exact generated Worker/);
  } finally {await rm(root,{recursive:true,force:true});}
});
