import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler')] }))
const built = await build({
  stdin: {
    contents: `import { widgetEvents } from './src/modules/management/widget-events';
      export { ConversationSocket } from './src/modules/conversations/socket';
      export default widgetEvents;`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'node',
  external: ['cloudflare:workers', 'node:*', 'crypto', 'path', 'buffer'], logLevel: 'silent',
})
const mf = new Miniflare(convertV4MiniflareOptions({
  name: 'widget-events', modules: true, script: built.outputFiles[0].text,
  compatibilityDate: '2026-09-14', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], durableObjects: { CONVERSATIONS: { className: 'ConversationSocket', useSQLite: true } },
}))
try {
  const db = await mf.getD1Database('DB')
  for (const name of ['0001_identity.sql', '0002_conversations.sql', '0004_message_intent.sql',
    '0005_widget_identity.sql', '0007_conversation_history.sql', '0070_management.sql',
    '0050_knowledge.sql', '0060_customer_context.sql', '0060_customer_context_engine.sql', '020_ai_support.sql']) {
    const migration = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8')
    for (const [, sql] of migration.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g)) await db.prepare(sql).run()
  }
  await db.exec(`INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','key','https://widget.example',1),('q','Other','other','https://other.example',1);
    INSERT INTO contacts(id,project_id,name,created_at) VALUES('visitor','p','Visitor',1),('other','p','Other',1),('foreign','q','Foreign',1);
    INSERT INTO users VALUES('owner','owner@example.com','Owner',1);
    INSERT INTO memberships VALUES('p','owner','owner');
    INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('own','p','visitor',1,1),('other','p','other',1,1),('foreign','q','foreign',1,1);`)
  for (const [token, actor, role, contact] of [['contact-token','visitor','contact','visitor'], ['owner-token','owner','owner',null]]) {
    await db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,NULL)')
      .bind(createHash('sha256').update(token).digest('hex'), actor, 'p', role, contact, Date.now() + 600000).run()
  }
  const buttons = JSON.stringify([{ id: 'policy', label: 'Show policy', action: 'send', text: 'Show policy' }])
  for (const [id, subject] of [['insight','visitor'], ['other-insight','other']]) {
    await db.prepare('INSERT INTO context_insights VALUES(?,?,?,?,?,?,?,?,NULL)')
      .bind(id, 'p', subject, 'help', 'How can we help?', buttons, '[]', 1).run()
  }
  async function call(action, data = {}, conversation = 'own', token = 'contact-token') {
    return mf.dispatchFetch(`https://app.example/${conversation}/widget-events`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    })
  }
  const insightCommand = { insight_id: 'insight', button_id: 'policy', ai_message: { local_id: 'insight-ai' }, local_id: 'insight-contact' }
  for (const conversation of ['other', 'foreign', 'missing']) {
    for (const [action, data] of [['contact', { name: 'Forged' }], ['markAsRead', {}], ['useInsight', insightCommand], ['insights', {}], ['request', { requestId: 'foreign-request' }]]) {
      assert.equal((await call(action, data, conversation)).status, 404, `${action} denies ${conversation}`)
    }
  }
  assert.equal((await call('contact', {}, 'own', 'owner-token')).status, 403)
  assert.equal((await call('contact', {}, 'own', 'invalid-token')).status, 401)
  assert.equal((await call('unknown')).status, 400)
  assert.equal((await call('useInsight', { ...insightCommand, insight_id: 'other-insight' })).status, 404)
  assert.equal((await call('useInsight', { ...insightCommand, button_id: 'forged' })).status, 400)
  assert.equal((await call('useInsight', { ...insightCommand, ai_message: {} })).status, 400)
  assert.equal((await db.prepare('SELECT count(*) n FROM messages').first()).n, 0)

  const admitted = await call('useInsight', insightCommand)
  assert.equal(admitted.status, 200, await admitted.clone().text())
  assert.equal((await admitted.json()).duplicate, false)
  const replay = await call('useInsight', insightCommand)
  assert.equal(replay.status, 200)
  assert.equal((await replay.json()).duplicate, true)
  assert.equal((await db.prepare('SELECT count(*) n FROM messages').first()).n, 2)
  assert.equal((await db.prepare('SELECT count(*) n FROM conversation_outbox').first()).n, 2)
  assert.equal((await db.prepare("SELECT revision FROM conversations WHERE id='own'").first()).revision, 2)
  assert.equal((await call('useInsight', { ...insightCommand, local_id: 'different-contact' })).status, 409)
  assert.equal((await call('markAsRead')).status, 200)
  assert.equal((await db.prepare("SELECT revision FROM conversation_reads WHERE conversation_id='own'").first()).revision, 2)
  assert.equal((await call('instruction', { opened: false })).status, 200)
  assert.equal(JSON.parse((await db.prepare("SELECT metadata_json FROM contacts WHERE id='visitor'").first()).metadata_json).widget_opened, false)

  // Every new request rechecks live authority, including previously accepted commands.
  await db.prepare("UPDATE contacts SET metadata_json=? WHERE id='visitor'").bind('{"is_blocked":true}').run()
  assert.equal((await call('useInsight', insightCommand)).status, 401)
  assert.equal((await call('pingActive')).status, 401)
  await db.exec("UPDATE contacts SET metadata_json='{}' WHERE id='visitor'; UPDATE conversations SET contact_id='other' WHERE id='own';")
  assert.equal((await call('useInsight', insightCommand)).status, 404)
  await db.exec("UPDATE conversations SET contact_id='visitor',assigned_to='owner' WHERE id='own';")
  assert.equal((await call('assignAi')).status, 409)
  await db.exec("UPDATE conversations SET assigned_to=NULL WHERE id='own';")
  assert.equal((await call('assignAi', { ai_id: 'missing' })).status, 400)
  assert.equal((await call('useInsight', { ...insightCommand, close: true })).status, 200)
  assert.equal((await call('useInsight', insightCommand)).status, 404)
  await db.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind('p', '{"deleted_at":1}', 1).run()
  assert.equal((await call('markAsRead')).status, 401)
  await db.exec("UPDATE project_settings SET settings_json='{}' WHERE project_id='p';")
  await db.exec("UPDATE sessions SET revoked_at=1 WHERE actor_id='visitor';")
  assert.equal((await call('markAsRead')).status, 401)
  assert.equal((await db.prepare('SELECT count(*) n FROM messages').first()).n, 2)
  assert.equal((await db.prepare('SELECT count(*) n FROM ai_generations').first()).n, 0)
  console.log('Widget command Worker/D1: admission, tenant/contact scope, replay, outbox and live authority transitions passed')
} finally {
  await mf.dispose()
}
