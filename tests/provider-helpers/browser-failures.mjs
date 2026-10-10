import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unmarkedFailure } from './unmarked-failures.mjs';

export async function checkAdditionalBrowserFailures({ runtime, context, page, jobsPath, device, fixture, runner, openLocal, evidence }) {
  const frames = JSON.parse(await readFile(new URL('./observed-codex-error.json', import.meta.url), 'utf8'));
  await writeFile(fixture.path, JSON.stringify({ frames }));
  const create = async key => {
    const response = await context.request.post(jobsPath, { data: { device_id: device.device.id, mode: 'resolve_reply', instructions: 'Inspect fixture state only', request_id: key } });
    assert.equal(response.status(), 200);
    return (await response.json()).data;
  };
  const unknown = await create('observed-error');
  await assert.rejects(runner.run({ once: true }), error => error.provider_error?.http_status === null && /Missing 'attachment_ids'/.test(error.provider_error.message));
  await runner.run({ once: true });
  assert.equal((await readFile(fixture.path + '.calls', 'utf8')).trim().split('\n').length, 2, 'one turn per explicit job');
  const admissions = [];
  for (const status of ['failed', 'cancelled']) {
    const job = await create('unmarked-browser-' + status);
    const claim = await runner.api.claim({ claim_id: 'unmarked-browser-' + status });
    const body = { run_id: claim.run_id, event_id: 'browser-' + status, status, result: unmarkedFailure() };
    const submit = () => fetch(runtime.origin + `/api/local-agents/jobs/${job.id}/result`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + device.token }, body: JSON.stringify(body) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await submit();
      assert.equal(response.status, 200);
      admissions.push(await response.json());
    }
  }
  const response = await context.request.get(jobsPath);
  assert.equal(response.status(), 200);
  const jobs = (await response.json()).data;
  assert.equal(jobs.find(job => job.id === unknown.id).result.provider_error.http_status, null);
  assert.doesNotMatch(JSON.stringify({ jobs, admissions }), /PRIVATE_/);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.reload(); await openLocal();
    const unknownError = page.locator('.delegation-job').filter({ hasText: 'HTTP status unavailable' });
    await unknownError.waitFor();
    assert.match(await unknownError.innerText(), /Missing 'attachment_ids'/);
    assert.doesNotMatch(await unknownError.innerText(), /HTTP 400/);
    for (const status of ['failed', 'cancelled']) {
      const partial = page.locator('.delegation-job.is-' + status).filter({ hasText: 'Partial inspection finished' });
      await partial.waitFor();
      const text = await partial.innerText();
      assert.match(text, /Read local configuration/);
      assert.match(text, /Confirmed the setting is enabled/);
      assert.equal(await partial.getByRole('button', { name: /Send|Retry|Use|Follow/ }).count(), 0);
      assert.equal(await partial.locator('.delegation-job__provider-error').count(), 0);
    }
    assert.doesNotMatch(await page.locator('body').innerText(), /PRIVATE_/);
    await page.screenshot({ path: join(evidence, `failure-admission-${viewport.width}.png`), fullPage: true });
  }
  const dbEvidence = await runtime.execute('SELECT result FROM local_jobs; SELECT payload FROM local_events; SELECT COUNT(*) AS effects FROM local_result_effects;');
  assert.doesNotMatch(dbEvidence, /PRIVATE_/);
  await writeFile(join(evidence, 'additional-failures-receipt.json'), JSON.stringify({ passed: true, jobs, dbEvidence, assertions: ['observed Codex JSON reason retained with unknown HTTP status', 'unmarked failed/cancelled evidence redacted before D1 and replay', 'safe partial work visible on desktop/mobile reload', 'no runnable proposals or provider replay'] }, null, 2));
}
