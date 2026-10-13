import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(candidate)) return nextResolve(candidate.href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { integrations } = await import('../src/modules/integrations/routes.ts')
const { githubApiRequest, githubCredential } = await import('../src/modules/integrations/github.ts')
const { encryptToken } = await import('../src/modules/integrations/secrets.ts')
const { getPlatformProxy } = await import('wrangler')
const { hashToken } = await import('../src/platform/auth.ts')
const proxy = await getPlatformProxy({ persist: false })
const originalFetch = globalThis.fetch

try {
  for (const file of ['0001_identity.sql', '0005_widget_identity.sql', '0002_conversations.sql', '0070_management.sql', '0080_integrations.sql', '0082_github_oauth.sql']) {
    for (const sql of (await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')).split(';').filter(value => value.trim())) {
      await proxy.env.DB.prepare(sql).run()
    }
  }

  const env = { ...proxy.env, GITHUB_TOKENS: JSON.stringify({ p: 'mapped-installation-token' }) }
  const DB = env.DB
  await DB.batch([
    DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)"),
    DB.prepare("INSERT INTO users VALUES('u','u@example.com','User',1)"),
    DB.prepare("INSERT INTO users VALUES('c','contact@example.com','Contact',1)"),
    DB.prepare("INSERT INTO contacts(id,project_id,name,email,external_id,created_at) VALUES('ct','p','Contact','contact@example.com','contact',1)"),
    DB.prepare("INSERT INTO memberships VALUES('p','u','owner')"),
    DB.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(await hashToken('token'), Date.now() + 999999),
    DB.prepare("INSERT INTO sessions VALUES(?,'c','p','contact','ct',?,NULL)").bind(await hashToken('contact-token'), Date.now() + 999999),
    DB.prepare("INSERT INTO github_settings VALUES('p',?,1,0,1)").bind(JSON.stringify(['just-every/run-happytohelp'])),
  ])

  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.redirect, 'manual')
    assert.ok(init?.signal instanceof AbortSignal)
    return Response.json({ ok: true })
  }
  assert.equal((await githubApiRequest('health', 'scoped-token')).status, 200)

  assert.deepEqual(await githubCredential(env, 'p'), { mode: 'mapped', token: 'mapped-installation-token' })
  env.GITHUB_TOKENS = undefined
  env.GITHUB_PROJECT_ID = 'p'
  env.GITHUB_TOKEN = 'single-project-token'
  assert.deepEqual(await githubCredential(env, 'p'), { mode: 'single', token: 'single-project-token' })
  env.GITHUB_TOKENS = JSON.stringify({ p: 'mapped-installation-token' })
  env.GITHUB_TOKEN = undefined

  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    assert.equal(String(url), 'https://api.github.com/repos/just-every/run-happytohelp')
    return Response.json({ id: 1378012333, full_name: 'just-every/run-happytohelp', private: true, default_branch: 'main' })
  }

  const response = await integrations.request('https://app.example/projects/p/github/repositories', {
    headers: { Authorization: 'Bearer token' },
  }, env)
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  assert.deepEqual(body, {
    data: [{ id: 1378012333, full_name: 'just-every/run-happytohelp', private: true, default_branch: 'main' }],
  })
  assert.deepEqual(calls, ['https://api.github.com/repos/just-every/run-happytohelp'])
  console.log('GitHub mapped-token discovery: exact project allowlist uses repository metadata reads and never calls /user/repos')

  env.INTEGRATION_ENCRYPTION_KEY = btoa('1'.repeat(32))
  const oauthCipher = await encryptToken(env, 'p', 'oauth-token')
  await DB.prepare("INSERT INTO github_connections VALUES('p','42','oauth-user',?,'repo',1)").bind(oauthCipher).run()
  env.GITHUB_TOKENS = undefined
  env.GITHUB_PROJECT_ID = undefined
  env.GITHUB_TOKEN = undefined
  calls.length = 0
  globalThis.fetch = async url => {
    calls.push(String(url))
    assert.equal(String(url), 'https://api.github.com/user/repos?per_page=100&sort=updated')
    return Response.json([{ id: 7, full_name: 'oauth/repo', private: false, default_branch: 'trunk' }])
  }
  const oauthResponse = await integrations.request('https://app.example/projects/p/github/repositories', {
    headers: { Authorization: 'Bearer token' },
  }, env)
  const oauthBody = await oauthResponse.json()
  assert.equal(oauthResponse.status, 200, JSON.stringify(oauthBody))
  assert.deepEqual(oauthBody.data, [{ id: 7, full_name: 'oauth/repo', private: false, default_branch: 'trunk' }])
  assert.deepEqual(calls, ['https://api.github.com/user/repos?per_page=100&sort=updated'])

  await DB.prepare("DELETE FROM github_connections WHERE project_id='p'").run()
  env.GITHUB_PROJECT_ID = 'p'
  env.GITHUB_TOKEN = 'single-project-token'
  calls.length = 0
  globalThis.fetch = async url => {
    calls.push(String(url))
    assert.equal(String(url), 'https://api.github.com/repos/just-every/run-happytohelp')
    return Response.json({ id: 1378012333, full_name: 'just-every/run-happytohelp', private: true, default_branch: 'main' })
  }
  const singleResponse = await integrations.request('https://app.example/projects/p/github/repositories', {
    headers: { Authorization: 'Bearer token' },
  }, env)
  const singleBody = await singleResponse.json()
  assert.equal(singleResponse.status, 200, JSON.stringify(singleBody))
  assert.deepEqual(singleBody.data, [{ id: 1378012333, full_name: 'just-every/run-happytohelp', private: true, default_branch: 'main' }])
  assert.deepEqual(calls, ['https://api.github.com/repos/just-every/run-happytohelp'])

  env.GITHUB_PROJECT_ID = undefined
  env.GITHUB_TOKEN = undefined
  env.GITHUB_TOKENS = JSON.stringify({ p: 'mapped-installation-token' })
  globalThis.fetch = async url => {
    calls.push(String(url))
    return Response.json({ message: 'forbidden' }, { status: 403 })
  }
  const providerFailure = await integrations.request('https://app.example/projects/p/github/repositories', {
    headers: { Authorization: 'Bearer token' },
  }, env)
  const failureBody = await providerFailure.text()
  assert.equal(providerFailure.status, 502, failureBody)
  assert.match(failureBody, /GitHub HTTP 403/)

  globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://github.com/elsewhere' } })
  const redirectResponse = await integrations.request('https://app.example/projects/p/github/repositories', {
    headers: { Authorization: 'Bearer token' },
  }, env)
  assert.equal(redirectResponse.status, 502)

  const callsBeforeContact = calls.length
  const contactDenied = await integrations.request('https://app.example/projects/p/github/repositories', {
    headers: { Authorization: 'Bearer contact-token' },
  }, env)
  assert.equal(contactDenied.status, 403)
  assert.equal(calls.length, callsBeforeContact)

  const denied = await integrations.request('https://app.example/projects/other/github/repositories', {
    headers: { Authorization: 'Bearer token' },
  }, env)
  assert.equal(denied.status, 403)
  console.log('GitHub credential discovery: OAuth user listing, mapped/single allowlist reads, provider failure and cross-project denial passed')
} finally {
  globalThis.fetch = originalFetch
  await proxy.dispose()
}
