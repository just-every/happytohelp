import assert from 'node:assert/strict';
import {join} from 'node:path';

export async function checkDelayedArticle({page, origin, projectId, article, api, directory, width}) {
    const path = `/api/knowledge/${projectId}/articles`;
    const mutations = [];
    const observe = request => {
        if (new URL(request.url()).pathname === path && request.method() === 'POST') mutations.push(request.postDataJSON());
    };
    page.on('request', observe);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const delay = async route => {
        if (route.request().method() === 'GET') await held;
        await route.continue();
    };
    const save = page.getByRole('button', {name: 'Save', exact: true});
    const publish = page.getByRole('button', {name: 'Publish', exact: true});
    try {
        await page.route('**' + path, delay);
        await page.goto(`${origin}/projects/${projectId}/articles/${article.id}`);
        await page.getByRole('heading', {name: 'Edit article', exact: true}).waitFor();
        for (const action of [save, publish]) {
            assert.equal(await action.count(), 1, 'one persistent article action before load');
            assert.ok(await action.isVisible(), 'article action visible before load');
            assert.ok(await action.isDisabled(), 'article action disabled before record load');
        }
        assert.equal(await page.getByLabel('Title', {exact: true}).count(), 0, 'no fabricated editable article before load');
        await page.locator('.knowledge-form').evaluate(form => {
            form.requestSubmit();
            for (const button of form.querySelectorAll('button')) button.click();
        });
        assert.deepEqual(mutations, [], 'programmatic submit and disabled actions cannot mutate before load');
        await page.screenshot({path: join(directory, `${width}-article-loading.png`), fullPage: true});
        release();
        await page.getByLabel('Title', {exact: true}).waitFor();
        await page.unroute('**' + path, delay);
        assert.equal(await page.getByLabel('Title', {exact: true}).inputValue(), article.title);
        const content = page.getByRole('textbox', {name: 'Article content in Markdown', exact: true});
        assert.equal(await content.inputValue(), article.content);
        assert.ok(await save.isEnabled());
        assert.equal(await publish.count(), 0, 'a loaded published article offers Save, not Publish again');
        const changedTitle = `Edited loaded article ${width}`;
        await page.getByLabel('Title', {exact: true}).fill(changedTitle);
        const changedContent = `The loaded record keeps its identity at ${width}.`;
        await content.fill(changedContent);
        const response = page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'POST');
        await save.click();
        assert.equal((await response).status(), 201);
        await page.getByText('Published', {exact: true}).waitFor();
        assert.equal(mutations.length, 1, 'exactly one deliberate save');
        assert.equal(mutations[0].id, article.id, 'save updates the loaded record');
        assert.equal(mutations[0].title, changedTitle);
        assert.equal(mutations[0].content, changedContent);
        assert.equal(mutations[0].status, 'published', 'Save preserves loaded publication');
        const rows = await api(path);
        const persisted = (rows.data || rows).find(row => row.id === article.id);
        assert.equal(persisted.title, changedTitle);
        assert.equal(persisted.content, changedContent);
        assert.equal(persisted.status, 'published');
        const failSave = async route => {
            if (route.request().method() === 'POST') await route.abort('failed');
            else await route.continue();
        };
        await page.route('**' + path, failSave);
        await page.getByLabel('Title', {exact: true}).fill('Save interrupted');
        await save.click();
        await page.getByRole('alert').waitFor();
        await page.unroute('**' + path, failSave);
        assert.ok(await save.isEnabled(), 'loaded article remains editable after a failed save');
        const recoveredTitle = `Corrected after interrupted save ${width}`;
        await page.getByLabel('Title', {exact: true}).fill(recoveredTitle);
        const recovered = page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'POST');
        await save.click();
        assert.equal((await recovered).status(), 201, 'operator can correct and explicitly save after failure');
        const recoveredRows = await api(path);
        assert.equal((recoveredRows.data || recoveredRows).find(row => row.id === article.id).title, recoveredTitle);
        assert.equal(mutations.length, 3, 'one initial save, one interrupted attempt, one explicit correction');
        await page.route('**' + path, route => route.abort('failed'));
        await page.reload();
        await page.getByRole('alert').waitFor();
        assert.ok(await save.isVisible());
        assert.ok(await publish.isVisible());
        assert.ok(await save.isDisabled());
        assert.ok(await publish.isDisabled());
        await page.locator('.knowledge-form').evaluate(form => form.requestSubmit());
        assert.equal(mutations.length, 3, 'failed loading cannot mutate the record');
        await page.screenshot({path: join(directory, `${width}-article-load-error.png`), fullPage: true});
    } finally {
        release();
        // Drain held requests before closing the page, including assertion failure.
        await page.unrouteAll({behavior: 'wait'});
        page.off('request', observe);
    }
}
