import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pbkdf2Sync, randomUUID } from 'node:crypto';

// Shared pieces of the identity browser suite: API calls, page contexts and the homepage-look assertions.
export const PAPER = 'rgb(246, 242, 234)', INK = 'rgb(20, 20, 20)', DASHBOARD_PURPLE = 'rgb(113, 62, 224)';

export function createKit({ browser, evidenceDir, errors }) {
    const checks = [];
    const kit = {
        checks,
        pass: message => checks.push(message),
        async api(origin, path, { body, token, method } = {}) {
            const response = await fetch(origin + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
            const text = await response.text();
            let json; try { json = JSON.parse(text); } catch { json = undefined; }
            return { status: response.status, json, text };
        },
        // A signed-out visitor by default; pass a session token for a signed-in browser.
        async open(origin, path, { token, mobile = false } = {}) {
            const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 } });
            if (token) await context.addCookies([{ name: 'h2h_session', value: token, url: origin }]);
            await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin }).catch(() => {});
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            page.on('pageerror', error => errors.push(`${path}: ${error.message}`));
            page.on('console', message => { if (message.type() === 'error' && !/status of (4|5)\d\d/.test(message.text())) errors.push(`${path}: ${message.text()}`); });
            page.requests = [];
            page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) page.requests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
            await page.goto(origin + path, { waitUntil: 'networkidle' });
            return page;
        },
        async shot(page, name) { await page.screenshot({ path: join(evidenceDir, `${name}.png`), fullPage: true }); },
        // Keep a screenshot as evidence (when named) and drop the whole browser context.
        async done(page, name) {
            if (name) await kit.shot(page, name);
            await page.context().close();
        },
        async text(page) { return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim(); },
        async hrefs(page) { return page.locator('a').evaluateAll(anchors => anchors.map(anchor => anchor.getAttribute('href'))); },
        async expectText(page, pattern, within = 'body') { await page.locator(within).filter({ hasText: pattern }).waitFor(); },
        async expectNoText(page, pattern) { assert.doesNotMatch(await kit.text(page), pattern); },
        async login(page, email, password) {
            await page.getByLabel('Email', { exact: true }).fill(email);
            await page.getByLabel('Password', { exact: true }).fill(password);
            await page.getByRole('button', { name: 'Login', exact: true }).click();
        },
        // The page must read as the homepage's sibling: wordmark home, paper, Outfit ink heading, black pill, no dashboard purple.
        async assertHomepageLook(page, label, { action = true } = {}) {
            const wordmark = page.getByRole('link', { name: 'HappyToHelp', exact: true });
            assert.equal(await wordmark.getAttribute('href'), '/', `${label}: wordmark links home`);
            const look = await page.evaluate(() => {
                const style = element => getComputedStyle(element);
                const heading = document.querySelector('h1'), pill = document.querySelector('.pill--ink');
                const purple = [...document.querySelectorAll('body *')].filter(element => ['color', 'backgroundColor', 'borderTopColor'].some(property => style(element)[property] === 'rgb(113, 62, 224)')).length;
                const probe = (x, y) => { const stack = document.elementsFromPoint(x, y); return stack.length ? style(stack[0]).backgroundColor : ''; };
                return {
                    bodyBackground: style(document.body).backgroundColor,
                    pageBackground: [style(document.querySelector('.h2h-identity')).backgroundColor, probe(2, 2), probe(2, innerHeight - 2), probe(2, innerHeight / 2)],
                    headingFont: heading && style(heading).fontFamily.split(',')[0].trim(), headingSize: heading && parseFloat(style(heading).fontSize), headingColor: heading && style(heading).color,
                    labelSizes: [...document.querySelectorAll('label')].map(label => parseFloat(style(label).fontSize)),
                    purple, overflow: document.documentElement.scrollWidth - innerWidth,
                    pill: pill && { background: style(pill).backgroundColor, color: style(pill).color, height: pill.getBoundingClientRect().height, radius: parseFloat(style(pill).borderTopLeftRadius) },
                    images: document.querySelectorAll('img').length,
                };
            });
            assert.equal(look.bodyBackground, PAPER, `${label}: body is the homepage paper`);
            assert.deepEqual(look.pageBackground.slice(1), [PAPER, PAPER, PAPER], `${label}: corners and edge are paper, not a photograph`);
            assert.equal(look.headingFont, 'Outfit', `${label}: Outfit heading`);
            assert.ok(look.headingSize >= 28, `${label}: heading ${look.headingSize}px`);
            assert.equal(look.headingColor, INK, `${label}: ink heading`);
            assert.ok(look.labelSizes.every(size => size >= 14), `${label}: labels ${look.labelSizes}`);
            assert.equal(look.purple, 0, `${label}: none of the dashboard purple`);
            assert.ok(look.overflow <= 0, `${label}: no horizontal scroll (${look.overflow})`);
            assert.equal(look.images, 0, `${label}: no photograph`);
            if (action) assert.ok(look.pill && look.pill.background === INK && look.pill.color === 'rgb(255, 255, 255)' && look.pill.height >= 40 && look.pill.radius >= 20, `${label}: black pill action ${JSON.stringify(look.pill)}`);
        },
        async assertNewPasswordField(page, label) {
            const field = page.locator('input[type=password]');
            assert.equal(await field.count(), 1, `${label}: one password field`);
            assert.deepEqual(await field.evaluate(input => ({ min: input.minLength, max: input.maxLength, complete: input.autocomplete })), { min: 12, max: 1024, complete: 'new-password' }, `${label}: 12-1024 and new-password`);
            assert.match(await kit.text(page), /12 to 1024 characters/, `${label}: the rule is stated`);
        },
        // A five-character password must be stopped by the browser: no request reaches the server.
        async assertShortPasswordBlocked(page, submit, label) {
            const before = page.requests.length;
            await page.locator('input[type=password]').fill('short');
            await submit();
            assert.equal(await page.locator('input[type=password]').evaluate(input => input.validity.tooShort), true, `${label}: browser reports too short`);
            await page.waitForTimeout(250);
            assert.equal(page.requests.length, before, `${label}: nothing was sent (${page.requests.slice(before)})`);
        },
    };
    return kit;
}

/** The server's own PBKDF2 format (src/modules/identity/credentials.ts), for rows the public API cannot create. */
export function passwordHash(password) {
    const salt = randomUUID();
    return `${salt}:${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
}
export const sqlQuote = value => "'" + String(value).replaceAll("'", "''") + "'";
