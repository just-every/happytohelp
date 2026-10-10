import assert from 'node:assert/strict';

export function unmarkedFailure() {
  return {
    summary: 'Partial inspection finished; provider HTTP 400 Invalid schema. Bearer PRIVATE_SUMMARY',
    actions: [{ description: 'Read local configuration. api_key=PRIVATE_ACTION', evidence: 'Confirmed the setting is enabled. token=PRIVATE_EVIDENCE', extra: 'PRIVATE_ACTION_EXTRA' }],
    verified: true,
    reply_draft: 'Bearer PRIVATE_DRAFT',
    question: 'api_key=PRIVATE_QUESTION',
    replies: [{ id: 'unsafe-reply', title: 'PRIVATE_TITLE', body: 'PRIVATE_REPLY' }],
    follow_up_actions: [{ id: 'unsafe-action', title: 'PRIVATE_FOLLOWUP', instructions: 'PRIVATE_INSTRUCTIONS', mode: 'resolve_reply' }],
    stderr: 'PRIVATE_STDERR', additionalDetails: { requestBody: 'PRIVATE_CONTEXT' }, diagnostic: ['PRIVATE_ARRAY'],
  };
}

export async function checkUnmarkedFailures({ request, api, db, jobsPath, device, token }) {
  for (const status of ['failed', 'cancelled']) {
    const queued = await request(jobsPath, { device_id: device, mode: 'resolve_reply', instructions: 'Retain partial work; no customer effects', request_id: 'unmarked-' + status });
    assert.equal(queued.status, 200);
    const claim = await api.claim({ claim_id: 'unmarked-' + status });
    const endpoint = '/api/local-agents/jobs/' + queued.data.id + '/result';
    const body = { run_id: claim.run_id, event_id: 'unmarked-' + status, status, result: unmarkedFailure() };
    const invalidResults = [
      { summary: 'x'.repeat(8001) }, { summary: {} }, { verified: 'true' }, { actions: Array(101).fill({ description: 'read', evidence: 'checked' }) },
      { actions: [{ description: 'read', evidence: 'x'.repeat(8001) }] }, { actions: [null] },
      { replies: [{ id: 'missing-fields' }] }, { replies: {} }, { follow_up_actions: [null] },
      { follow_up_actions: [{ ...body.result.follow_up_actions[0], mode: 'unapproved' }] },
    ];
    for (const invalid of invalidResults) {
      const denied = await request(endpoint, { ...body, result: { ...body.result, ...invalid } }, token);
      assert.equal(denied.status, 422);
      assert.equal((await db.prepare('SELECT result FROM local_jobs WHERE id=?').bind(queued.data.id).first()).result, null);
    }
    for (const location of ['top-level', 'replies', 'follow_up_actions']) {
      const result = structuredClone(body.result);
      const attachmentOwner = location === 'top-level' ? result : result[location][0];
      attachmentOwner.attachment_ids = ['not-owned'];
      assert.equal((await request(endpoint, { ...body, result }, token)).status, 403, 'discarded proposals still enforce attachment ownership: ' + location);
      attachmentOwner.attachment_ids = Array(11).fill('duplicate');
      assert.equal((await request(endpoint, { ...body, result }, token)).status, 422, 'discarded proposals still enforce attachment bounds: ' + location);
      assert.equal((await db.prepare('SELECT result FROM local_jobs WHERE id=?').bind(queued.data.id).first()).result, null);
    }
    const admitted = await request(endpoint, body, token);
    assert.equal(admitted.status, 200);
    assert.equal(admitted.data.status, status);
    const result = admitted.data.result;
    assert.match(result.summary, /Partial inspection finished; provider HTTP 400 Invalid schema/);
    assert.match(result.actions[0].description, /Read local configuration/);
    assert.match(result.actions[0].evidence, /Confirmed the setting is enabled/);
    assert.equal(result.verified, false);
    assert.equal(result.reply_draft, '');
    assert.equal(result.provider_error, undefined, 'unmarked runtime failures are not recategorized as provider evidence');
    assert.equal((await request(endpoint, body, token)).status, 200, 'idempotent replay returns sanitized stored result');
    const stored = await db.prepare('SELECT result FROM local_jobs WHERE id=?').bind(queued.data.id).first();
    const events = await db.prepare('SELECT payload FROM local_events WHERE job_id=?').bind(queued.data.id).all();
    const fetched = await request(jobsPath, undefined, 'operator', 'GET');
    const replay = await request(endpoint, body, token);
    assert.equal(events.results.filter(event => JSON.parse(event.payload).result).length, 1);
    assert.doesNotMatch(JSON.stringify({ admitted, stored, events, fetched, replay }), /PRIVATE_/);
    assert.deepEqual(JSON.parse(stored.result), result);
    assert.equal((await api.claim({ claim_id: 'after-' + status })), null, 'terminal failure cannot be reclaimed');
    assert.equal((await request(jobsPath + '/' + queued.data.id + '/result/replies/unsafe-reply/send', {})).status, 409);
    assert.equal((await request(jobsPath + '/' + queued.data.id + '/result/follow-up-actions/unsafe-action', {})).status, 409);
  }
  // A server-side cancellation also projects a racing completed report safely.
  const queued = await request(jobsPath, { device_id: device, mode: 'resolve_reply', instructions: 'Cancellation race', request_id: 'cancel-race' });
  const claim = await api.claim({ claim_id: 'cancel-race' });
  await db.prepare('UPDATE local_jobs SET cancel_requested=1 WHERE id=?').bind(queued.data.id).run();
  const admitted = await request('/api/local-agents/jobs/' + queued.data.id + '/result', { run_id: claim.run_id, event_id: 'cancel-race', status: 'completed', result: unmarkedFailure() }, token);
  assert.equal(admitted.status, 200);
  assert.equal(admitted.data.status, 'cancelled');
  assert.doesNotMatch(JSON.stringify(admitted), /PRIVATE_/);
  for (const table of ['messages', 'local_receipts', 'local_result_effects']) assert.equal((await db.prepare('SELECT COUNT(*) n FROM ' + table).first()).n, 0, table + ' stays empty after unmarked failure/replay');
}
