import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { assertSetupCredential, setupAvailabilitySql } from '../scripts/deployment/setup-credential.mjs'
import { deployRemote } from '../scripts/deployment/remote.mjs'

const configPath = '/private/deployment/wrangler.json'
const remote = available => {
 const calls = []
 const execute = async (args, options) => { calls.push({args, options}); return {stdout: JSON.stringify([{results: [{available}], success: true}]), stderr: ''} }
 return {calls, execute}
}

test('fresh remote installation without a setup token is refused before deployment', async () => {
 const {calls, execute} = remote(1)
 await assert.rejects(assertSetupCredential({env: {}, configPath, cwd: '/source', execute}), /no owner yet, so H2H_SETUP_TOKEN is required.*Nothing was deployed/)
 assert.equal(calls.length, 1)
 assert.deepEqual(calls[0].args, ['exec', 'wrangler', 'd1', 'execute', 'DB', '--remote', '--config', configPath, '--json', '--command', setupAvailabilitySql])
 assert.equal(calls[0].options.capture, true)
 await assert.rejects(assertSetupCredential({env: {H2H_SETUP_TOKEN: '   '}, configPath, execute}), /H2H_SETUP_TOKEN is required/)
})

test('redeploying an installation whose owner exists needs no setup token', async () => {
 const {execute} = remote(0)
 assert.deepEqual(await assertSetupCredential({env: {}, configPath, execute}), {setupToken: 'not-required-owner-exists'})
})

test('a strong configured setup token deploys without reading remote state', async () => {
 const {calls, execute} = remote(1)
 assert.deepEqual(await assertSetupCredential({env: {H2H_SETUP_TOKEN: 'a'.repeat(64)}, configPath, execute}), {setupToken: 'configured'})
 assert.equal(calls.length, 0)
})

test('a guessable setup token is refused', async () => {
 const {execute} = remote(1)
 await assert.rejects(assertSetupCredential({env: {H2H_SETUP_TOKEN: 'short-token'}, configPath, execute}), /at least 32 characters/)
})

test('unreadable remote setup state fails closed', async () => {
 for (const stdout of ['not json', '[]', JSON.stringify([{results: [{available: null}]}])]) {
  await assert.rejects(assertSetupCredential({env: {}, configPath, execute: async () => ({stdout})}), /Could not read first-owner setup state/)
 }
 await assert.rejects(assertSetupCredential({env: {}, configPath, execute: async () => { throw new Error('Command exec wrangler d1 failed (1). No later step ran.') }}), /failed/)
})

test('deploy --remote uploads nothing for a claimable fresh installation', async () => {
 const {calls, execute} = remote(1), checked = []
 await assert.rejects(deployRemote({env: {OPENAI_API_KEY: 'test-only-key'}, cwd: '/source', configPath, origin: 'https://help.example.test', execute, waitForHealth: async url => checked.push(url)}), /H2H_SETUP_TOKEN is required/)
 assert.equal(calls.some(call => call.args.includes('deploy')), false)
 assert.deepEqual(checked, [])
})

test('deploy --remote uploads the setup token with the Worker for a fresh installation', async () => {
 const calls = [], uploaded = [], checked = [], token = 'b'.repeat(64)
 const execute = async args => {
  calls.push(args)
  if (args.includes('--secrets-file')) uploaded.push(JSON.parse(await readFile(args[args.indexOf('--secrets-file') + 1], 'utf8')))
  return {stdout: '', stderr: ''}
 }
 assert.deepEqual(await deployRemote({env: {H2H_SETUP_TOKEN: token}, cwd: '/source', configPath, origin: 'https://help.example.test', execute, waitForHealth: async url => checked.push(url)}), {setupToken: 'configured'})
 assert.deepEqual(calls.map(args => args.slice(0, 4)), [['exec', 'wrangler', 'deploy', '--config']])
 assert.deepEqual(uploaded, [{H2H_SETUP_TOKEN: token}])
 assert.deepEqual(checked, ['https://help.example.test/health'])
})

test('deploy --remote redeploys an installation whose owner exists without a token', async () => {
 const calls = []
 const execute = async args => { calls.push(args); return {stdout: args.includes('d1') ? JSON.stringify([{results: [{available: 0}]}]) : '', stderr: ''} }
 assert.deepEqual(await deployRemote({env: {}, cwd: '/source', configPath, origin: 'https://help.example.test', execute, waitForHealth: async () => {}}), {setupToken: 'not-required-owner-exists'})
 assert.deepEqual(calls.map(args => args[2]), ['d1', 'deploy'])
})
