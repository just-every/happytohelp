import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateRuntimeEnvironment } from '../scripts/deployment/environment.mjs'
import { prepareRemote } from '../scripts/deployment/config.mjs'
import { deployRemote } from '../scripts/deployment/remote.mjs'

const target = { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), H2H_RESOURCE_PREFIX: 'mail-test', H2H_PUBLIC_ORIGIN: 'https://mail-test.owner.workers.dev' }
const deployment = { cwd: '/source', configPath: '/private/deployment/wrangler.json', origin: target.H2H_PUBLIC_ORIGIN }
const mail = provider => ({ EMAIL_PROVIDER: provider, EMAIL_ACCOUNT_ID: 'a'.repeat(32), EMAIL_API_KEY: 'mail-test-only-key', EMAIL_FROM: 'support@example.test' })
const incomplete = [
 { label: 'missing key', values: { EMAIL_API_KEY: undefined }, missing: 'EMAIL_API_KEY' },
 { label: 'missing sender', values: { EMAIL_FROM: undefined }, missing: 'EMAIL_FROM' },
 { label: 'both missing', values: { EMAIL_API_KEY: undefined, EMAIL_FROM: undefined }, missing: 'EMAIL_API_KEY' },
 { label: 'empty key', values: { EMAIL_API_KEY: '' }, missing: 'EMAIL_API_KEY' },
 { label: 'empty sender', values: { EMAIL_FROM: '' }, missing: 'EMAIL_FROM' },
 { label: 'whitespace key', values: { EMAIL_API_KEY: ' \t\n' }, missing: 'EMAIL_API_KEY' },
 { label: 'whitespace sender', values: { EMAIL_FROM: ' \t\n' }, missing: 'EMAIL_FROM' },
 { label: 'both whitespace', values: { EMAIL_API_KEY: ' \t', EMAIL_FROM: '\n ' }, missing: 'EMAIL_API_KEY' },
]

for (const provider of ['sendgrid', 'resend', 'cloudflare']) {
 for (const fixture of incomplete) test(`${provider}: ${fixture.label} refuses setup and direct deployment before any provider or health call`, async () => {
  const env = { ...target, ...mail(provider), ...fixture.values }, calls = []
  const expected = new RegExp(`${provider} email requires ${fixture.missing}`)
  const execute = async () => { calls.push('execute'); throw new Error('Unexpected command') }
  const request = async () => { calls.push('fetch'); throw new Error('Unexpected provider request') }
  assert.throws(() => validateRuntimeEnvironment(env), expected)
  await assert.rejects(prepareRemote(env, execute, { fetch: request }), expected)
  // No setup token: validation must precede even the remote owner-state read.
  await assert.rejects(deployRemote({ ...deployment, env, execute, waitForHealth: request }), expected)
  assert.deepEqual(calls, [])
 })

 test(`${provider}: complete mail configuration uploads its secrets and reaches health`, async () => {
  const env = { ...mail(provider), H2H_SETUP_TOKEN: 'b'.repeat(64) }, calls = [], uploaded = [], checked = []
  const execute = async args => {
   calls.push(args)
   uploaded.push(JSON.parse(await readFile(args[args.indexOf('--secrets-file') + 1], 'utf8')))
   return { stdout: '', stderr: '' }
  }
  assert.deepEqual(await deployRemote({ ...deployment, env, execute, waitForHealth: async url => checked.push(url) }), { setupCredentialState: 'configured' })
  assert.deepEqual(calls.map(args => args.slice(0, 4)), [['exec', 'wrangler', 'deploy', '--config']])
  assert.deepEqual(uploaded, [{ EMAIL_API_KEY: env.EMAIL_API_KEY, EMAIL_FROM: env.EMAIL_FROM, H2H_SETUP_TOKEN: env.H2H_SETUP_TOKEN }])
  assert.deepEqual(checked, [deployment.origin + '/health'])
 })
}

test('unselected mail remains optional and Cloudflare retains its account requirement', () => {
 for (const env of [{}, { EMAIL_PROVIDER: '' }, { EMAIL_PROVIDER: ' \t', EMAIL_API_KEY: '', EMAIL_FROM: '' }]) assert.doesNotThrow(() => validateRuntimeEnvironment(env))
 for (const EMAIL_ACCOUNT_ID of [undefined, '', 'invalid', ' '.repeat(32)]) assert.throws(() => validateRuntimeEnvironment({ ...mail('cloudflare'), EMAIL_ACCOUNT_ID }), /Cloudflare email requires EMAIL_ACCOUNT_ID/)
})

test('native setup and deploy entrypoints reject incomplete selected mail before any command', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'h2h-mail-preflight-'))
 const marker = join(directory, 'executed')
 try {
  // A test-only command sentinel proves no build, migration or upload is started.
  await writeFile(join(directory, 'pnpm'), '#!/bin/sh\nprintf invoked > "$H2H_TEST_COMMAND_MARKER"\nexit 98\n', { mode: 0o700 })
  for (const provider of ['sendgrid', 'resend', 'cloudflare']) for (const fixture of incomplete) {
   for (const [script, modes] of [['setup', ['--plan', '--local', '--remote']], ['deploy', ['--local', '--remote']]]) for (const mode of modes) {
    const env = { PATH: directory, H2H_TEST_COMMAND_MARKER: marker, ...target, ...mail(provider), ...fixture.values }
    for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key]
    const child = spawnSync(process.execPath, [new URL(`../scripts/${script}.mjs`, import.meta.url).pathname, mode], { env, encoding: 'utf8', timeout: 10_000 })
    assert.ifError(child.error)
    assert.equal(child.status, 1, `${script} ${mode}: ${provider} ${fixture.label}`)
    assert.match(child.stderr, new RegExp(`${provider} email requires ${fixture.missing}`))
   }
  }
  await assert.rejects(readFile(marker), { code: 'ENOENT' })
 } finally { await rm(directory, { recursive: true, force: true }) }
})
