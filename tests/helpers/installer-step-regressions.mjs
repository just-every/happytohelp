import assert from 'node:assert/strict';

// Supply credentials through the real protected endpoint, then let normal polling update the UI.
async function supplySecrets(page, origin, secrets) {
  const response = await page.request.get(origin);
  const token = (await response.text()).match(/name="installer-token" content="([a-f0-9]+)"/)[1];
  const headers = { Origin: origin, 'X-Installer-Token': token };
  const state = await (await page.request.get(origin + '/api/state', { headers })).json();
  const saved = await page.request.post(origin + '/api/secrets', { headers, data: { revision: state.lastUpdate.revision, secrets } });
  assert.equal(saved.status(), 200, await saved.text());
}

export async function installerStepRegressions({ fixture, common, wait, visible, shot }) {
  const password = await fixture('late-password', { answers: common });
  await password.page.goto(password.installer.origin); await password.page.locator('#password').waitFor();
  await wait(() => password.installer.state.draft.addressMode === 'automatic');
  await supplySecrets(password.page, password.installer.origin, { password: 'test-only-private-password' });
  await wait(async () => await password.page.locator('#continue').isEnabled());
  await visible(password.page, ['password', 'continue']);
  assert.equal(await password.page.locator('#password').inputValue(), '', 'Private password is not returned into the input');
  assert.equal(await password.page.locator('#approve').isVisible(), false);
  await shot(password.page, '12-late-private-password');
  await password.page.locator('#continue').click(); await password.page.locator('.ready-summary').waitFor();

  const email = await fixture('late-email-token', { answers: { ...common, emailProvider: 'resend', emailFrom: 'support@example.test' }, secretInput: { password: 'test-only-private-password' } });
  await email.page.goto(email.installer.origin); await email.page.locator('#emailApiKey').waitFor();
  assert.equal(await email.page.locator('#heading').textContent(), 'Hosting & connections');
  await visible(email.page, ['target-local', 'choice-now']);
  await wait(() => email.installer.state.draft.addressMode === 'automatic');
  await supplySecrets(email.page, email.installer.origin, { emailApiKey: 'test-only-email-token' });
  await wait(async () => await email.page.locator('#continue').isEnabled());
  await visible(email.page, ['emailApiKey', 'continue']);
  assert.equal(await email.page.locator('#emailApiKey').inputValue(), '', 'Private email token is not returned into the input');
  await shot(email.page, '13-late-email-token');
  await email.page.locator('#continue').click(); await email.page.locator('.ready-summary').waitFor();

  const first = 'a'.repeat(32), second = 'b'.repeat(32);
  const hosting = await fixture('account-token-scope', { answers: { ...common, target: 'remote', accountId: first, prefix: 'test-workspace', appOrigin: 'https://test-workspace.fixture.workers.dev' }, secretInput: { password: 'test-only-private-password', apiToken: 'test-only-cloudflare-token' } });
  hosting.installer.state.known.providers.cloudflare = { installed: false, authenticated: false, accounts: [{ id: first, name: 'First account' }, { id: second, name: 'Second account' }] };
  await hosting.page.goto(hosting.installer.origin); await hosting.page.locator('.ready-summary').waitFor();
  await hosting.page.getByRole('button', { name: 'Edit Hosting & connections', exact: true }).click();
  await hosting.page.locator('#accountId').selectOption(second);
  await wait(() => hosting.installer.state.draft.accountId === second);
  await wait(() => hosting.installer.state.known.secretReadiness.apiToken === false);
  await visible(hosting.page, ['accountId', 'continue']);
  assert.equal(await hosting.page.locator('#accountId').inputValue(), second);
  assert.equal(await hosting.page.locator('#continue').isDisabled(), true, 'Token scoped to another account cannot complete hosting');
  await hosting.page.getByRole('button', { name: 'Use an API token', exact: true }).click();
  await visible(hosting.page, ['accountId', 'apiToken']);
  await shot(hosting.page, '14-account-token-invalidated');
}
