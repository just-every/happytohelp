import assert from 'node:assert/strict';

// The pending-invitation row on the Agents page: copy a link, resend the email, revoke. Controls come from the server's
// per-row permission, so an operator sees none.
const agentsPath = projectId => `/projects/${projectId}/agents`;
const rowFor = (page, email) => page.locator('tr', { hasText: email });

export async function checkPendingInvitationsWithoutEmail({ origin, kit }, owner, operator) {
    const invite = async email => (await kit.api(origin, `/api/management/projects/${owner.projectId}/agents`, { body: { email, role: 'operator' }, token: owner.token })).json.data;
    const first = await invite('pending@review.test'), second = await invite('pending@review.test');

    let page = await kit.open(origin, `${agentsPath(owner.projectId)}/create`, { token: owner.token });
    await kit.expectText(page, /Email delivery is not configured/);
    await kit.done(page, 'agents-invite-form-no-email');
    kit.pass('the invite form says up front that email delivery is not configured');

    page = await kit.open(origin, agentsPath(owner.projectId), { token: owner.token });
    const row = rowFor(page, 'pending@review.test');
    await row.waitFor();
    assert.equal(await rowFor(page, 'pending@review.test').count(), 1, 'two links, one row');
    await row.getByRole('button', { name: 'Copy link' }).waitFor();
    await row.getByRole('button', { name: 'Revoke' }).waitFor();
    const resend = row.getByRole('button', { name: 'Resend' });
    assert.equal(await resend.isDisabled(), true, 'resend is disabled without an email provider');
    assert.match(await resend.getAttribute('title'), /not configured/);
    await kit.done(page, 'agents-pending-row-no-email');
    kit.pass('owner without email: Copy link and Revoke offered, Resend disabled with the reason');

    page = await kit.open(origin, agentsPath(owner.projectId), { token: owner.token });
    await rowFor(page, 'pending@review.test').getByRole('button', { name: 'Copy link' }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Invitation link for pending@review.test' });
    await notice.waitFor();
    const copiedLink = await notice.getByRole('link').getAttribute('href');
    assert.match(copiedLink, /\/accept-invitation\?token=/);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => copiedLink);
    assert.equal(clipboard, copiedLink, 'the copied text is the link');
    await kit.done(page, 'agents-copy-link');
    const link = await kit.open(origin, new URL(copiedLink).pathname + new URL(copiedLink).search);
    await kit.expectText(link, /Join Harbour Desk/);
    assert.match(await kit.text(link), /pending@review\.test/);
    await kit.done(link);
    kit.pass('Copy link shows and copies a working invitation link for the same workspace and email');

    page = await kit.open(origin, agentsPath(owner.projectId), { token: owner.token });
    await rowFor(page, 'pending@review.test').getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('status').filter({ hasText: 'Invitation for pending@review.test revoked' }).waitFor();
    await rowFor(page, 'pending@review.test').waitFor({ state: 'detached' });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await rowFor(page, 'pending@review.test').count(), 0, 'stays gone after reload');
    await kit.done(page, 'agents-revoked');
    for (const url of [first.invitationUrl, second.invitationUrl, copiedLink]) {
        const revoked = await kit.open(origin, new URL(url).pathname + new URL(url).search);
        await kit.expectText(revoked, /invalid or has expired/);
        assert.equal(await revoked.locator('input').count(), 0);
        await kit.expectNoText(revoked, /Authentication required/);
        await kit.done(revoked);
    }
    kit.pass('Revoke removes the row for good and every earlier link stops working');

    await invite('operator-view@review.test');
    page = await kit.open(origin, agentsPath(owner.projectId), { token: operator.token });
    await rowFor(page, 'operator-view@review.test').waitFor();
    assert.equal(await rowFor(page, 'operator-view@review.test').locator('button').count(), 0, 'operators get no invitation controls');
    await kit.done(page, 'agents-operator-view');
    kit.pass('an operator sees the pending invitation without Copy link, Resend or Revoke');
}

export async function checkPendingInvitationsWithEmail({ origin, kit }, owner) {
    const created = await kit.api(origin, '/api/identity/invitations', { body: { email: 'mailed@review.test' }, token: owner.token });
    assert.equal(created.status, 201, created.text);
    const page = await kit.open(origin, agentsPath(owner.projectId), { token: owner.token });
    const row = rowFor(page, 'mailed@review.test');
    await row.getByRole('button', { name: 'Copy link' }).waitFor();
    await row.getByRole('button', { name: 'Revoke' }).waitFor();
    const resend = row.getByRole('button', { name: 'Resend' });
    assert.equal(await resend.isEnabled(), true, 'resend is available when email is configured');
    // The mail provider is never contacted from a test: the browser's call is answered here, and the route itself is
    // proven against the real handler in tests/management-invitations.mjs.
    const sent = [];
    await page.route('**/api/management/projects/*/invitations/*/resend', route => { sent.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`); return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { delivery: 'sent' } }) }); });
    await resend.click();
    await page.getByRole('status').filter({ hasText: 'Invitation emailed to mailed@review.test again' }).waitFor();
    assert.deepEqual(sent, [`POST /api/management/projects/${owner.projectId}/invitations/mailed%40review.test/resend`]);
    assert.equal(await rowFor(page, 'mailed@review.test').count(), 1, 'resending does not duplicate the row');
    await kit.done(page, 'agents-pending-row-email');
    kit.pass('owner with email: Resend is enabled, calls the resend route for this invitation and confirms on screen');
}
