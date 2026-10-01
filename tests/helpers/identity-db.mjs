// Real local D1 (Miniflare through Wrangler's platform proxy) with the identity and management migrations
// applied, plus the TypeScript import hook the module tests use. Import this before the modules under test.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

registerHooks({resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL) {
    for (const suffix of ['.ts', '/index.ts']) { const url = new URL(specifier + suffix, context.parentURL); if (existsSync(url)) return next(url.href, context) }
  }
  return next(specifier, context)
}})

const migrations = ['0001_identity.sql', '0003_identity_credentials.sql', '0005_widget_identity.sql', '0006_registration.sql', '0008_account_sessions.sql', '0070_management.sql', '0071_management_preferences.sql', '0080_integrations.sql', '0097_owner_setup.sql', '0102_public_abuse_limits.sql']
export const sha = value => createHash('sha256').update(value).digest('hex')

export async function openIdentityDb() {
  const { getPlatformProxy } = await import('wrangler')
  const proxy = await getPlatformProxy({ persist: false, envFiles: [] })
  const DB = proxy.env.DB
  for (const file of migrations) {
    const source = (await readFile(new URL('../../migrations/' + file, import.meta.url), 'utf8')).replace(/^\s*--[^\n]*$/gm, '')
    for (const [, sql] of source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g)) if (sql.trim() !== ';') await DB.prepare(sql).run()
  }
  return { proxy, DB, env: proxy.env, dispose: () => proxy.dispose() }
}

/** A workspace with an owner, an admin and an operator, each holding a live session token. */
export async function seedWorkspace(DB, key, { name = 'Workspace ' + key } = {}) {
  const projectId = 'p-' + key, now = Date.now(), tokens = {}
  await DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(projectId, name, 'widget-' + key, `https://${key}.example`, now).run()
  for (const role of ['owner', 'admin', 'operator']) {
    const userId = `${role}-${key}`
    await DB.batch([
      DB.prepare('INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)').bind(userId, `${role}-${key}@example.test`, `${role} ${key}`, now),
      DB.prepare('INSERT INTO memberships VALUES(?,?,?)').bind(projectId, userId, role),
      DB.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,?,?,?,?)').bind(sha(`${role}-token-${key}`), userId, projectId, role, now + 3600000),
    ])
    tokens[role] = `${role}-token-${key}`
  }
  return { projectId, name, tokens }
}
