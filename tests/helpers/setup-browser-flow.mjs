import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

// Call only against fresh isolated test storage: this exercises real first-owner setup.
export async function checkSetupBrowser(origin, evidenceDir) {
    await mkdir(evidenceDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    const errors = [], failed = [], checks = [], submissions = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) failed.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/identity/bootstrap' && request.method() === 'POST') submissions.push(request); });
    const email = 'setup-browser@example.test', password = 'owner-setup-browser-password';
    try {
        await page.goto(origin + '/setup#name=Setup%20browser%20workspace&ownerName=Setup%20owner');
        await page.getByLabel('Owner password', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Bootstrap token').count(), 0);
        assert.equal(new URL(page.url()).hash, '');
        await page.getByLabel('Owner password', { exact: true }).fill('temporary-password');
        await page.getByRole('button', { name: 'Save for later' }).click();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('h2h-setup-draft-v1').includes('temporary-password')), false);
        await page.reload();
        await page.getByLabel('Owner password', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Owner password', { exact: true }).inputValue(), '');
        assert.equal(await page.getByLabel('Your name', { exact: true }).inputValue(), 'Setup owner');
        checks.push('agent fragment consumed; nonsecret draft resumes without password');
        await page.getByLabel('Your name', { exact: true }).fill('Setup owner');
        await page.getByLabel('Owner email').fill(email);
        await page.getByLabel('Owner password', { exact: true }).fill('short');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await page.getByLabel('Owner password', { exact: true }).evaluate(input => input.validity.tooShort), true);
        assert.equal(submissions.length, 0);
        assert.deepEqual(await (await page.request.get(origin + '/api/identity/setup')).json(), { available: true });
        checks.push('short password blocked before submission; setup remains available');
        await page.getByLabel('Owner password', { exact: true }).fill(password);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await page.getByLabel('Widget website origin').inputValue(), origin);
        await page.getByLabel('Workspace name').fill('Setup browser workspace');
        await page.getByLabel('Brand colour', { exact: true }).fill('#336699');
        await page.getByRole('button', { name: 'Review setup', exact: true }).click();
        const accepted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/identity/bootstrap' && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
        const response = await accepted;
        assert.equal(response.status(), 201);
        await page.waitForURL(/\/projects\/[^/]+\/widget-settings$/);
        await page.getByRole('tab', { name: 'Code', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Theme', exact: true }).click();
        await page.getByRole('complementary', { name: 'Widget preview' }).waitFor();
        await page.waitForFunction(() => {
            const target = document.getElementById('happytohelp');
            return target && Array.from(target.querySelectorAll('*')).some(element => element.shadowRoot?.childElementCount);
        });
        const projectId = new URL(page.url()).pathname.split('/')[2];
        assert.equal(submissions.length, 1);
        assert.equal(submissions[0].headers().authorization, undefined);
        const session = await page.evaluate(async () => { const r = await fetch('/api/identity/session'); return { status: r.status, actor: await r.json() }; });
        assert.equal(session.status, 200);
        assert.equal(session.actor.projectId, projectId);
        assert.ok(session.actor.id);
        assert.equal(session.actor.role, 'owner');
        checks.push('tokenless form creates owner and authenticates browser in one request');
        checks.push('widget settings and actual Shadow DOM preview render after signup');
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('tab', { name: 'Code', exact: true }).waitFor();
        assert.equal(await page.evaluate(async () => (await fetch('/api/identity/session')).status), 200);
        checks.push('owner cookie and dashboard survive reload');
        await page.screenshot({ path: join(evidenceDir, 'created-workspace.png'), fullPage: true });
        assert.equal(await page.evaluate(async () => (await fetch('/api/identity/session', { method: 'DELETE' })).status), 200);
        await page.goto(origin + '/login');
        await page.getByLabel('Email',{exact:true}).fill(email);
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await page.waitForURL('**/conversations');
        checks.push('chosen password signs in after session revocation');
        // A signed-in owner who opens /setup is sent on to the workspace; nobody can create another owner.
        await page.goto(origin + '/setup');
        await page.waitForURL(/\/projects\/[^/]+\/activation$/);
        assert.equal(await page.getByRole('button', { name: 'Create workspace', exact: true }).count(), 0);
        checks.push('a signed-in owner opening /setup continues to the workspace');
        assert.equal(await page.evaluate(async () => (await fetch('/api/identity/session', { method: 'DELETE' })).status), 200);
        await page.goto(origin + '/setup');
        await page.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href'), '/login?returnTo=%2Fsetup');
        assert.equal(await page.getByRole('button', { name: 'Create workspace', exact: true }).count(), 0);
        checks.push('completed setup shows sign-in and cannot create another owner');
        await page.screenshot({ path: join(evidenceDir, 'setup-complete.png'), fullPage: true });
        assert.deepEqual(errors, []);
        assert.deepEqual(failed, []);
        return { checks, errors, failed };
    } finally {
        await writeFile(join(evidenceDir, 'result.json'), JSON.stringify({ checks, errors, failed }, null, 2));
        await browser.close();
    }
}
