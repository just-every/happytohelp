import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {client} from './upgrade-baselines.mjs';
import {completeInterruptedErasure} from './upgrade-interrupted-erasure.mjs';

const scalar = (database, sql, ...values) => {
  const db = new DatabaseSync(database, {readOnly: true});
  try { return db.prepare(sql).get(...values).n; } finally { db.close(); }
};
const count = (database, table) => scalar(database, `SELECT count(*) n FROM "${table}"`);
const storedMailCount = database => {
  const db = new DatabaseSync(database, {readOnly: true});
  try { return db.prepare('SELECT message FROM rer_mail_development_outbox').all().map(row => JSON.parse(row.message)).length; }
  finally { db.close(); }
};
// Rows here would mean an import started, a connection was configured or
// delivered, or mail was sent. The native event log itself is expected to
// record the new conversation, but with no destination nothing fans out. Under
// rer development suppresses mail without adding any rows.
const inertTables = ['move_in_runs', 'ik_jobs', 'native_integration_destinations', 'native_integration_intents', 'integration_deliveries', 'integration_tokens', 'rer_portability_jobs'];
const exists = (database, table) => scalar(database, "SELECT count(*) n FROM sqlite_master WHERE type='table' AND name=?", table) > 0;

// What the baseline store already held before this source's migrations: zero
// for 0.3, which has none of these tables (the default for callers that pass
// none); a populated 0.4 store already has native events and may hold earlier
// outbox mail. The upgrade adds none.
export function priorState(database, owner) {
  const counts = Object.fromEntries([...inertTables, 'native_integration_events'].map(table => [table, exists(database, table) ? count(database, table) : 0]));
  return {counts, mail: exists(database, 'rer_mail_development_outbox') ? storedMailCount(database) : 0};
}

// Through this source's emitted Worker on the upgraded store, with the owner's
// original password: native identity, transcript, attachment, appearance and
// article read back; a new conversation works; Move in, Reports and Connections
// open empty with nothing started.
export async function readBack(origin, database, data, prior = {counts: {}, mail: 0}) {
  const call = client(origin), checks = {};
  for (const table of [...inertTables, 'native_integration_events']) assert.equal(count(database, table), prior.counts[table] ?? 0, `${table} gains no rows from the upgrade`);
  assert.equal(storedMailCount(database), prior.mail, 'development adds no stored mail');
  const login = await call('/api/identity/login', {body: {email: data.owner.email, password: data.owner.password, projectId: data.owner.projectId}});
  assert.equal(login.actor.role, 'owner');
  checks.ownerSignIn = {role: login.actor.role, projectId: login.actor.projectId};
  const token = login.token, projectId = data.owner.projectId;
  const messages = await call(`/api/conversations/${data.visitor.conversationId}/messages`, {token});
  assert.deepEqual(messages.messages.map(message => message.content), data.visitor.transcript);
  const widget = await call(`/api/conversations/${data.visitor.conversationId}/messages`, {token: data.visitor.token});
  assert.deepEqual(widget.messages.map(message => message.content), data.visitor.transcript);
  checks.transcript = {dashboard: messages.messages.length, widget: widget.messages.length};
  const article = await call(`/api/knowledge/public/${data.article.projectId}/articles/${data.article.slug}`);
  assert.equal(article.content, data.article.content);
  const page = await call(`/help/${data.article.projectId}/${data.article.slug}`);
  assert.ok(page.includes(data.article.content), 'Help Center page shows the original article');
  checks.article = {api: true, helpCenter: true};
  if (data.member) {
    const member = await call('/api/identity/login', {body: {email: data.member.email, password: data.member.password}});
    assert.equal(member.actor.role, 'operator');
    const agents = await call(`/api/management/projects/${projectId}/agents`, {token});
    assert.ok(agents.data.some(row => row.pending && row.email === data.pendingEmail), 'pending invitation retained');
    const settings = await call(`/api/management/projects/${projectId}/settings`, {token});
    for (const [field, value] of Object.entries(data.appearance)) assert.equal(settings.data[field], value, `appearance ${field}`);
    const projects = await call('/api/management/projects', {token});
    assert.ok((projects.data ?? projects).some(row => row.id === data.owner.secondProjectId), 'second workspace retained');
    const media = await fetch(`${origin}/api/conversations/${data.visitor.conversationId}/media/${data.attachment.id}`, {headers: {Authorization: `Bearer ${token}`}});
    assert.equal(media.status, 200);
    assert.equal(Buffer.from(await media.arrayBuffer()).toString('base64'), data.attachment.bytes);
    const categories = await call(`/api/knowledge/public/${projectId}/categories`);
    assert.ok(categories.some(row => row.id === data.article.categoryId), 'article category retained');
    Object.assign(checks, {memberSignIn: member.actor.role, pendingInvitation: data.pendingEmail, appearance: Object.keys(data.appearance), secondWorkspace: true, attachmentBytes: true, category: true});
  }
  const imports = await call(`/api/move-in/projects/${projectId}/imports`, {token});
  assert.deepEqual(imports.data, []);
  // Prior native conversations stay in the Reports cohort with unknown history:
  // no AI resolution, rating or first-resolution duration is invented.
  const report = await call(`/api/dashboard/projects/${projectId}/reports`, {token});
  assert.equal(report.volume, scalar(database, 'SELECT count(*) n FROM conversations WHERE project_id=?', projectId));
  assert.deepEqual([report.aiResolution.count, report.satisfaction.total, report.firstResolution.count], [0, 0, 0]);
  const tokens = await call(`/api/management/projects/${projectId}/connections/tokens`, {token});
  const deliveries = await call(`/api/management/projects/${projectId}/connections/deliveries`, {token});
  assert.deepEqual([tokens.data, deliveries.data], [[], []]);
  checks.newFeatures = {moveInImports: 0, reportVolume: report.volume, reportAiResolutions: 0, reportRatings: 0, connectionTokens: 0, deliveries: 0};
  const project = await call(`/api/identity/projects/${projectId}`, {token});
  const visitor = await call('/api/identity/widget/session', {body: {widgetKey: project.widget_key, name: 'After upgrade', email: 'after-upgrade@example.test'}, headers: {Origin: project.allowed_origin}});
  const conversation = await call('/api/conversations', {body: {projectId}, token: visitor.token});
  const sent = await call(`/api/conversations/${conversation.id}/messages`, {body: {localId: 'after-upgrade', content: 'A new conversation after the upgrade.', expectedRevision: 0}, token: visitor.token});
  assert.equal(sent.accepted, true);
  checks.newConversation = conversation.id;
  for (const table of inertTables) assert.equal(count(database, table), prior.counts[table] ?? 0, `${table} gains no rows from the read-back`);
  assert.equal(storedMailCount(database), prior.mail, 'development adds no stored mail');
  checks.inertTables = inertTables;
  checks.retainedMailRows = count(database, 'rer_mail_development_outbox');
  if (data.interruptedErasure) checks.interruptedErasure = await completeInterruptedErasure(call, database, data.owner, data.interruptedErasure);
  return checks;
}
