import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

// Call only against fresh isolated test storage: this exercises real first-owner setup.
export async function checkSetupBrowser(origin, evidenceDir) {
    await mkdir(evidenceDir, { recursive: true });
    const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
    const page = await context.newPage();
    const errors = [], failed = [], checks = [], submissions = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) failed.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/identity/bootstrap' && request.method() === 'POST') submissions.push(request); });
    const email = 'setup-browser@example.test', password = 'owner-setup-browser-password';
    try {
        // An agent- or hosted-driven link prefills email and website through the fragment, which the page reads once and removes.
        await page.goto(origin + '/setup#email=' + encodeURIComponent(email) + '&allowedOrigin=' + encodeURIComponent(origin));
        await page.getByLabel('Password', { exact: true }).waitFor();
        // The form is now SSR content; visibility no longer means its fragment effect has run.
        await page.waitForFunction(({ email, origin }) => location.hash === '' && document.querySelector('input[name=email]')?.value === email && document.querySelector('input[name=allowedOrigin]')?.value === origin, { email, origin });
        assert.equal(await page.getByLabel('Setup token').count(), 0);
        assert.equal(new URL(page.url()).hash, '');
        assert.equal(await page.getByLabel('Your email', { exact: true }).inputValue(), email);
        assert.equal(await page.getByLabel('Your website', { exact: true }).inputValue(), origin);
        // One screen: no wizard, no name or colour fields, nothing kept for later, and no password in browser storage.
        for (const gone of ['Your name', 'Workspace name', 'Brand colour', 'Widget website origin']) assert.equal(await page.getByLabel(gone).count(), 0, gone);
        for (const gone of ['Save for later', 'Continue', 'Review setup']) assert.equal(await page.getByRole('button', { name: gone }).count(), 0, gone);
        assert.equal(await page.getByRole('button', { name: 'Create workspace', exact: true }).count(), 1);
        checks.push('agent fragment consumed; one form with email, password and website only');
        await page.getByLabel('Password', { exact: true }).fill('temporary-password');
        assert.equal(await page.evaluate(() => JSON.stringify([{ ...sessionStorage }, { ...localStorage }, location.href]).includes('temporary-password')), false);
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByLabel('Password', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '');
        assert.equal(await page.getByLabel('Your website', { exact: true }).inputValue(), '', 'the website never starts as this app\'s own address');
        // The website follows a company email domain until it is edited, and stays empty for free mail.
        await page.getByLabel('Your email', { exact: true }).fill('ada@acme-widgets.example');
        assert.equal(await page.getByLabel('Your website', { exact: true }).inputValue(), 'https://acme-widgets.example');
        assert.match(await page.locator('.setup-promise').innerText(), /Acme Widgets/);
        await page.getByLabel('Your email', { exact: true }).fill('h2h-fixture-personal' + '@' + 'gmail.com');
        assert.equal(await page.getByLabel('Your website', { exact: true }).inputValue(), '');
        await page.getByLabel('Your website', { exact: true }).fill('https://typed.example.org');
        await page.getByLabel('Your email', { exact: true }).fill('ada@other-company.example');
        assert.equal(await page.getByLabel('Your website', { exact: true }).inputValue(), 'https://typed.example.org');
        checks.push('website prefills from a company email domain, never from the app, and an edit is kept');
        await page.getByLabel('Your email', { exact: true }).fill(email);
        await page.getByLabel('Your website', { exact: true }).fill(origin);
        await page.getByLabel('Password', { exact: true }).fill('short');
        await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
        assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(input => input.validity.tooShort), true);
        assert.equal(submissions.length, 0);
        assert.deepEqual(await (await page.request.get(origin + '/api/identity/setup')).json(), { available: true });
        checks.push('short password blocked before submission; setup remains available');
        await page.getByLabel('Password', { exact: true }).fill(password);
        const accepted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/identity/bootstrap' && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
        const response = await accepted;
        assert.equal(response.status(), 201);
        assert.deepEqual(Object.keys(JSON.parse(submissions[0].postData())).sort(), ['allowedOrigin', 'email', 'password']);
        await page.waitForURL(/\/projects\/[^/]+\/activation$/);
        // The widget preview is on the Widget settings page now that setup lands on the Setup page.
        const projectId = new URL(page.url()).pathname.split('/')[2];
        await page.goto(origin + `/projects/${projectId}/widget-settings`);
        await page.getByRole('tab', { name: 'Code', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Theme', exact: true }).click();
        await page.getByRole('complementary', { name: 'Widget preview' }).waitFor();
        await page.waitForFunction(() => {
            const target = document.getElementById('happytohelp');
            return target && Array.from(target.querySelectorAll('*')).some(element => element.shadowRoot?.childElementCount);
        });
        assert.equal(submissions.length, 1);
        assert.equal(submissions[0].headers().authorization, undefined);
        const session = await page.evaluate(async () => { const r = await fetch('/api/identity/session'); return { status: r.status, actor: await r.json() }; });
        assert.equal(session.status, 200);
        assert.equal(session.actor.projectId, projectId);
        assert.ok(session.actor.id);
        assert.equal(session.actor.role, 'owner');
        checks.push('one request creates the owner and workspace and authenticates the browser');
        checks.push('widget settings and actual Shadow DOM preview render after signup');
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('tab', { name: 'Code', exact: true }).waitFor();
        assert.equal(await page.evaluate(async () => (await fetch('/api/identity/session')).status), 200);
        checks.push('owner cookie and dashboard survive reload');
        await page.screenshot({ path: join(evidenceDir, 'created-workspace.png'), fullPage: true });
        assert.equal(await page.evaluate(async () => (await fetch('/api/identity/session', { method: 'DELETE' })).status), 200);
        await page.goto(origin + '/login?returnTo=' + encodeURIComponent(`/projects/${projectId}/conversations`));
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
        // The URL commits before the fresh Setup checks finish. Complete that
        // signed-in page before deliberately revoking its session below.
        await page.waitForLoadState('networkidle');
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
        await context.close();
        await browser.close();
    }
}
