import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {findDatabase} from './upgrade-snapshot.mjs';

// A reachable 0.4.1 state: erasure commits its fence, R2 fails, and an operator
// creates another conversation before retrying. Only the R2 edge is faulted;
// every application row is written by the original release's public API.
export async function interruptedErasure(runtime, call, owner) {
  const projectId = owner.secondProjectId;
  const {token} = await call('/api/identity/login', {body: {...owner, projectId}});
  const project = await call(`/api/identity/projects/${projectId}`, {token});
  const visitor = await call('/api/identity/widget/session', {body: {widgetKey: project.widget_key, name: 'Interrupted erasure', email: 'erasure-upgrade@example.test'}, headers: {Origin: runtime.origin}});
  const conversation = await call('/api/conversations', {body: {projectId}, token: visitor.token});
  const media = await call(`/api/conversations/${conversation.id}/media`, {body: Buffer.from('Retain the interrupted erasure object.'), raw: true, token: visitor.token, headers: {'Content-Type': 'text/plain', 'X-Filename': 'erasure.txt'}});
  const contactId = conversation.contact_id;
  const objectKey = `${projectId}/${conversation.id}/${media.id}`;
  const bucket = await findDatabase(join(runtime.directory, 'state/v3/r2'));
  await runtime.close(false);
  const fault = new DatabaseSync(bucket);
  try {
    fault.exec(`CREATE TRIGGER upgrade_r2_delete_failure BEFORE DELETE ON _mf_objects WHEN OLD.key='${objectKey.replaceAll("'", "''")}' BEGIN SELECT RAISE(ABORT,'upgrade_fixture_r2_delete_failed'); END`);
  } finally { fault.close(); }
  let status;
  try {
    await runtime.restart();
    const response = await fetch(`${runtime.origin}/api/management/projects/${projectId}/contacts/${contactId}/erase`, {method: 'POST', headers: {Authorization: `Bearer ${token}`}});
    status = response.status;
    await response.arrayBuffer();
  } finally {
    await runtime.close(false);
    const clean = new DatabaseSync(bucket);
    try { clean.exec('DROP TRIGGER upgrade_r2_delete_failure'); } finally { clean.close(); }
    await runtime.restart();
  }
  assert.equal(status, 500, 'The real erasure stops at the failed R2 deletion');
  const late = await call('/api/conversations', {body: {projectId, contactId}, token});
  const database = new DatabaseSync(await findDatabase(join(runtime.directory, 'state/v3/d1')), {readOnly: true});
  try {
    const contact = database.prepare('SELECT email,is_verified,metadata_json FROM contacts WHERE id=?').get(contactId);
    assert.equal(contact.email, 'erasure-upgrade@example.test');
    assert.equal(contact.is_verified, 0);
    assert.equal(JSON.parse(contact.metadata_json).is_erasing, 1);
    assert.ok(database.prepare('SELECT revoked_at FROM sessions WHERE contact_id=?').get(contactId).revoked_at);
    const event = database.prepare('SELECT contact_id,conversation_id,erased_at FROM native_integration_events WHERE id=?').get(`created:${late.id}`);
    assert.deepEqual({...event}, {contact_id: contactId, conversation_id: late.id, erased_at: null});
    assert.equal(database.prepare('SELECT count(*) n FROM contact_erasures WHERE contact_id=?').get(contactId).n, 0);
  } finally { database.close(); }
  console.log('0.4.1: public erasure interrupted at R2; retained email, revoked session and later native event');
  return {projectId, contactId, conversationId: late.id, eventId: `created:${late.id}`};
}

export async function completeInterruptedErasure(call, database, owner, state) {
  const {token} = await call('/api/identity/login', {body: {...owner, projectId: state.projectId}});
  const result = await call(`/api/management/projects/${state.projectId}/contacts/${state.contactId}/erase`, {method: 'POST', token});
  assert.equal(result.data.runs, 1, 'The owner can finish the interrupted erasure after upgrade');
  const db = new DatabaseSync(database, {readOnly: true});
  try {
    const event = db.prepare('SELECT body,conversation_id,contact_id,erased_at FROM native_integration_events WHERE id=?').get(state.eventId);
    assert.deepEqual([event.body, event.conversation_id, event.contact_id], ['{}', null, null]);
    assert.ok(event.erased_at, 'The restored runtime trigger erases the event on explicit owner action');
  } finally { db.close(); }
  return {completed: true, runtimeErasureGuard: true};
}
