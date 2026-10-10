import assert from 'node:assert/strict';

async function bounded(promise, label) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 15000);
        })]);
    } finally { clearTimeout(timer); }
}

// Capture an actual native response, then delay its delivery to the mounted view.
export async function holdNativeResponse(page, path, method = 'GET') {
    let release, received, delivered;
    const gate = new Promise(resolve => { release = resolve; });
    const responseReady = new Promise(resolve => { received = resolve; });
    const deliveryDone = new Promise(resolve => { delivered = resolve; });
    let first = true;
    const handler = async route => {
        if (!first || route.request().method() !== method) return route.continue();
        first = false;
        const response = await route.fetch();
        received(response);
        await gate;
        try { await route.fulfill({response}); }
        finally { delivered(); }
    };
    await page.route('**' + path, handler);
    return {
        get responseReady() { return bounded(responseReady, `${method} ${path} native response`); },
        get deliveryDone() { return bounded(deliveryDone, `${method} ${path} delivery`); },
        release,
        close: async () => { release(); await page.unroute('**' + path, handler); },
    };
}

export async function fillTrainingRun(page) {
    await page.getByLabel('Models', {exact: false}).first().fill('gpt-5.6-luna');
    await page.getByLabel('Case definitions', {exact: false}).fill('[{"id":"readiness-case","type":"customer-reply"}]');
    await page.getByLabel('Maximum cost', {exact: false}).fill('5');
    await page.getByLabel('Maximum tokens', {exact: false}).fill('2000');
}

export async function settleFrames(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function assertUnavailable(page, posts) {
    assert.equal(await page.getByRole('button', {name: 'Create run', exact: true}).count(), 0, 'creation appears only after the real initial list');
    assert.equal(await page.getByLabel('Case definitions', {exact: false}).count(), 0, 'no editable draft before list readiness');
    assert.equal(await page.locator('table').count(), 0, 'loading/error is not an empty table');
    assert.doesNotMatch(await page.locator('.workspace-page-content').innerText(), /No evaluation runs yet/);
    assert.deepEqual(posts, [], 'no early training POST');
}

export async function switchTrainingProject(page, name, projectId) {
    const nav = page.getByRole('navigation', {name: 'Main navigation'});
    await nav.getByRole('button', {name: /Switch workspace:/}).click();
    await nav.getByRole('button', {name, exact: true}).click();
    await page.waitForURL('**/projects/' + projectId + '/conversations');
    await nav.getByRole('link', {name: 'Knowledge', exact: true}).click();
    await page.getByRole('navigation', {name: 'Knowledge sections'}).getByRole('link', {name: 'Evaluation runs', exact: true}).click();
    await page.waitForURL('**/projects/' + projectId + '/training-runs');
}
