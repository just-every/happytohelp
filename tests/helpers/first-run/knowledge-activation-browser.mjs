import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRuntime } from '../emitted-runtime.mjs';
import { ARTICLE_RETRIEVAL_TOKEN, articleFixture, datasetDocument, DATASET_RETRIEVAL_TOKEN, longArticleContent } from '../../activation/knowledge-fixtures.mjs';
import {launchBrowser} from '../../journeys/kit/browser.mjs';

export async function knowledgeActivationBrowser(){
 const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
 const evidenceRoot = process.env.H2H_EVIDENCE_DIR
     ? resolve(process.env.H2H_EVIDENCE_DIR)
     : await mkdtemp(join(tmpdir(), 'h2h-knowledge-activation-'));
 const evidenceDir = join(evidenceRoot, 'knowledge-activation');
 const capturesDir = join(evidenceDir, 'captures');
 await mkdir(capturesDir, { recursive: true });

 const runtime = await createRuntime({
     queueConsumers: true,
     port: Number(process.env.H2H_RUNTIME_PORT || process.env.H2H_TEST_PORT) || 0,
     inspectorPort: process.env.H2H_RUNTIME_INSPECTOR_PORT ? Number(process.env.H2H_RUNTIME_INSPECTOR_PORT) : undefined,
 });
 const origin = runtime.origin;
 let browser;
 let success = false;
 const checks = [];
 const captures = [];
 const pageErrors = [];
 const dialogEvents = [];
 let projectId;
 let token;

 const request = async (path, { body, method = body === undefined ? 'GET' : 'POST', authToken = token } = {}) => {
     const response = await fetch(origin + path, {
         method,
         headers: {
             ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
             ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
         },
         body: body === undefined ? undefined : JSON.stringify(body),
     });
     const text = await response.text();
     assert.ok(response.ok, method + ' ' + path + ': ' + response.status + ' ' + text.slice(0, 500));
     return text ? JSON.parse(text) : {};
 };

 const record = async (name, work) => {
     await work();
     checks.push(name);
     console.log('PASS', name);
 };

 const waitForDataset = async (datasetId, predicate, description) => {
     const deadline = Date.now() + 20000;
     let row;
     while (Date.now() < deadline) {
         row = await request('/api/knowledge/' + projectId + '/datasets/' + datasetId);
         if (predicate(row)) return row;
         await new Promise(resolveWait => setTimeout(resolveWait, 150));
     }
     throw new Error('Timed out waiting for ' + description + ': ' + JSON.stringify(row));
 };

 const searchFor = async marker => {
     const result = await request('/api/knowledge/' + projectId + '/search?q=' + encodeURIComponent(marker));
     return result.citations || [];
 };

 const capture = async (page, name, viewport) => {
     const file = join(capturesDir, name);
     await page.screenshot({ path: file, fullPage: true });
     const bytes = await readFile(file);
     captures.push({
         file: 'captures/' + name,
         width: viewport.width,
         height: viewport.height,
         sha256: createHash('sha256').update(bytes).digest('hex'),
     });
 };

 try {
     const owner = { email: 'knowledge-owner@example.test', password: 'synthetic-native-knowledge-test-password-2026' };
     const setup = await request('/api/identity/bootstrap', {
         authToken: undefined,
         body: { ...owner, name: 'Knowledge Owner', allowedOrigin: origin },
     });
     projectId = setup.projectId;
     const login = await request('/api/identity/login', { authToken: undefined, body: owner });
     token = login.token;

     const dataset = await request('/api/knowledge/' + projectId + '/datasets', {
         body: { name: 'First-run docs' },
     });
     await request('/api/knowledge/' + projectId + '/datasets/' + dataset.id + '/refresh', {
         body: { documents: [datasetDocument()] },
     });
     const firstPublished = await waitForDataset(dataset.id, row => row.status === 'ready' && row.published_version, 'the local corpus publication');
     assert.ok((await searchFor(DATASET_RETRIEVAL_TOKEN)).some(citation => citation.content.includes(DATASET_RETRIEVAL_TOKEN)), 'the emitted Worker retrieves the newly published corpus');
     await request('/api/knowledge/' + projectId + '/datasets/' + dataset.id, {
         method: 'PUT', body: { name: 'First-run docs', url: 'https://knowledge-fixture.example.test', max_crawl_depth: 3, max_crawl_pages: 50 },
     });

     await request('/api/knowledge/' + projectId + '/datasets/' + dataset.id + '/refresh', { body: { documents: [] } });
     const failedRefresh = await waitForDataset(dataset.id, row => row.status === 'failed', 'the failed local refresh');
     assert.equal(failedRefresh.published_version, firstPublished.published_version, 'failed refresh retains the prior published version');
     assert.ok((await searchFor(DATASET_RETRIEVAL_TOKEN)).some(citation => citation.content.includes(DATASET_RETRIEVAL_TOKEN)), 'the retained corpus remains in real lexical retrieval after failure');
     console.log('PASS failed refresh retains the published corpus in the emitted Worker');
     checks.push('failed refresh retains the published corpus in the emitted Worker');

     browser = await launchBrowser();
     const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
     const page = await context.newPage();
     page.on('pageerror', error => pageErrors.push(error.message));
     page.on('dialog', async dialog => {
         dialogEvents.push({ type: dialog.type(), message: dialog.message() });
         await dialog.dismiss();
     });
     const articleWrites = [];
     page.on('request', requestEvent => {
         const url = new URL(requestEvent.url());
         if (url.pathname === '/api/knowledge/' + projectId + '/articles' && requestEvent.method() === 'POST') articleWrites.push(requestEvent);
     });

     await page.goto(origin + '/login?returnTo=' + encodeURIComponent(`/projects/${projectId}/conversations`));
     await page.getByLabel('Email', { exact: true }).fill(owner.email);
     await page.getByLabel('Password', { exact: true }).fill(owner.password);
     await page.getByRole('button', { name: 'Login', exact: true }).click();
     await page.waitForURL('**/conversations');
     const base = origin + '/projects/' + projectId;

     await record('Add URL starts the initial website run and opens its progress without Refresh now', async () => {
         await page.goto(base + '/datasets/create');
         await page.getByLabel('Starting URL', { exact: true }).fill('https://initial-crawl.example.test');
         await page.getByLabel('Excluded URLs', { exact: true }).fill('https://initial-crawl.example.test/private/**');
         await page.getByLabel('Max Crawl Depth', { exact: true }).fill('2');
         await page.getByLabel('Max Crawl Pages', { exact: true }).fill('7');
         const creation = page.waitForResponse(response => new URL(response.url()).pathname === '/api/knowledge/' + projectId + '/datasets' && response.request().method() === 'POST');
         await page.getByRole('button', { name: 'Add URL', exact: true }).click();
         const created = await (await creation).json();
         assert.equal(created.refresh.status, 'queued');
         await page.waitForURL('**/datasets/' + created.id);
         await page.locator('.knowledge-form [role="status"]').waitFor();
         const source = await request('/api/knowledge/' + projectId + '/datasets/' + created.id);
         assert.notEqual(source.status, 'empty');
         assert.equal(source.max_crawl_depth, 2);
         assert.equal(source.max_crawl_pages, 7);
         assert.deepEqual(JSON.parse(source.excluded_urls), ['https://initial-crawl.example.test/private/**']);
         // No provider account is selected in this isolated emitted-runtime journey.
         // The Worker fixture journey qualifies successful crawl and publication.
     });

     await record('Knowledge tabs expose articles, categories, website sources, and evaluation runs', async () => {
         await page.goto(base + '/articles');
         const tabs = page.getByRole('navigation', { name: 'Knowledge sections' });
         for (const label of ['Articles', 'Categories', 'Website sources', 'Evaluation runs']) {
             await tabs.getByRole('link', { name: label, exact: true }).waitFor();
         }
         assert.equal(await tabs.getByRole('link', { name: 'Articles', exact: true }).getAttribute('aria-current'), 'page');
         await page.goto(base + '/categories');
         assert.equal(await page.getByRole('navigation', { name: 'Knowledge sections' }).getByRole('link', { name: 'Categories', exact: true }).getAttribute('aria-current'), 'page');
         await page.goto(base + '/training-runs');
         const navigation = page.getByRole('navigation', { name: 'Knowledge sections' });
         assert.equal(await navigation.getByRole('link', { name: 'Evaluation runs', exact: true }).getAttribute('aria-current'), 'page');
         await page.getByRole('button', { name: 'Create run', exact: true }).waitFor();
     });

     const title = 'Fresh install answer article';
     await page.goto(base + '/articles/create');
     const actions = page.getByRole('group', { name: 'Article save and publish' });
     const saveButton = actions.getByRole('button', { name: 'Save', exact: true });
     const publishButton = actions.getByRole('button', { name: 'Publish', exact: true });
     await saveButton.waitFor();
     await publishButton.waitFor();
     await page.getByLabel('Title', { exact: true }).fill(title);
     await page.getByLabel('Summary', { exact: true }).fill('A long local first-run article for the editor checks.');
     await page.getByLabel('Article content in Markdown', { exact: true }).fill(longArticleContent());

     await record('article Save and Publish stay visible during desktop scrolling', async () => {
         const position = await actions.evaluate(element => getComputedStyle(element).position);
         assert.equal(position, 'sticky');
         await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
         const box = await actions.boundingBox();
         assert.ok(box && box.y >= 0 && box.y + box.height <= 1000, 'sticky controls remain in the desktop viewport');
         assert.equal(await saveButton.isVisible(), true);
         assert.equal(await publishButton.isVisible(), true);
         await page.evaluate(() => window.scrollTo(0, 0));
         await capture(page, 'article-editor-1440.png', { width: 1440, height: 1000 });
     });

     await record('article controls fit a 390px view while the editor remains keyboard-editable', async () => {
         await page.setViewportSize({ width: 390, height: 844 });
         await page.evaluate(() => window.scrollTo(0, 0));
         const textarea = page.getByLabel('Article content in Markdown', { exact: true });
         await textarea.focus();
         await page.keyboard.insertText(' Mobile keyboard editing remains available.');
         await page.setViewportSize({ width: 390, height: 360 });
         // The status row stays with the fields; the phone's controls are its fixed child.
         const controls = actions.locator('.article-editor-actions__buttons');
         assert.equal(await controls.evaluate(element => getComputedStyle(element).position), 'fixed');
         const box = await controls.boundingBox();
         assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'action bar fits mobile width');
         assert.ok(box.y >= 0 && box.y + box.height <= 360, 'action bar remains visible in the keyboard-sized viewport');
         assert.equal(await saveButton.isVisible(), true);
         assert.equal(await publishButton.isVisible(), true);
         assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile page does not overflow horizontally');
         await page.setViewportSize({ width: 390, height: 844 });
         await page.evaluate(() => window.scrollTo(0, 0));
         await capture(page, 'article-editor-390.png', { width: 390, height: 844 });
     });

     await record('Save creates an unpublished draft and does not send a duplicate request', async () => {
         articleWrites.length = 0;
         await saveButton.click();
         await page.waitForURL(url => url.pathname.startsWith('/projects/' + projectId + '/articles/') && !url.pathname.endsWith('/create'));
         assert.equal(articleWrites.length, 1, 'one Save sends one article write');
         const articleId = new URL(page.url()).pathname.split('/').pop();
         const rows = await request('/api/knowledge/' + projectId + '/articles');
         const row = rows.find(item => item.id === articleId);
         assert.ok(row);
         assert.equal(row.status, 'draft');
         assert.equal(row.is_published, false);
         // The saved article opens at its own address and loads its record there; its status reads Loading… until it arrives.
         await page.getByLabel('Title', { exact: true }).waitFor();
         assert.equal((await actions.getByRole('status').locator('strong').innerText()).trim(), 'Draft');
         assert.equal(await page.getByLabel('Published', { exact: true }).count(), 0, 'the old publication checkbox is removed');
     });

     const articleId = new URL(page.url()).pathname.split('/').pop();
     await record('Publish explicitly makes the draft published once and reload preserves it', async () => {
         articleWrites.length = 0;
         const publishedResponse = page.waitForResponse(response => {
             const url = new URL(response.url());
             return url.pathname === '/api/knowledge/' + projectId + '/articles' && response.request().method() === 'POST';
         });
         await publishButton.click();
         assert.equal((await publishedResponse).status(), 201);
         assert.equal(articleWrites.length, 1, 'one Publish sends one article write');
         let rows = await request('/api/knowledge/' + projectId + '/articles');
         assert.equal(rows.find(item => item.id === articleId).is_published, true);
         await page.reload();
         await page.getByLabel('Title', { exact: true }).waitFor();
         assert.equal((await actions.getByRole('status').locator('strong').innerText()).trim(), 'Published');
         rows = await request('/api/knowledge/' + projectId + '/articles');
         assert.equal(rows.find(item => item.id === articleId).status, 'published');
     });

     await record('Save on a published article preserves its published state', async () => {
         articleWrites.length = 0;
         await page.getByLabel('Title', { exact: true }).fill(title + ' edited');
         await saveButton.click();
         assert.equal(articleWrites.length, 1, 'one Save sends one article write');
         const rows = await request('/api/knowledge/' + projectId + '/articles');
         const row = rows.find(item => item.id === articleId);
         assert.equal(row.title, title + ' edited');
         assert.equal(row.status, 'published');
         assert.equal(row.is_published, true);
         await page.reload();
         assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), title + ' edited');
         assert.equal((await actions.getByRole('status').locator('strong').innerText()).trim(), 'Published');
     });

     await record('Unpublish withdraws article retrieval and Publish restores eligibility', async () => {
         // The viewport is still 390px wide here, where Unpublish waits behind the More actions button.
         await page.getByRole('button', { name: 'More actions', exact: true }).click();
         await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
         await actions.getByRole('status').locator('strong').filter({ hasText: /^Saved as draft$/ }).waitFor();
         const row = (await request('/api/knowledge/' + projectId + '/articles')).find(item => item.id === articleId);
         assert.equal(row.status, 'draft');
         assert.equal(row.aiEligibility, 'not_used');
         assert.ok(!(await searchFor(ARTICLE_RETRIEVAL_TOKEN)).some(citation => citation.id === 'article:' + articleId));
         await page.getByRole('button', { name: 'Publish', exact: true }).click();
         await actions.getByRole('status').locator('strong').filter({ hasText: /^Published$/ }).waitFor();
         assert.equal((await request('/api/knowledge/' + projectId + '/articles')).find(item => item.id === articleId).aiEligibility, 'used');
     });

     await record('Preview renders the article without the editing toolbar', async () => {
         await page.getByRole('tab', { name: 'Preview', exact: true }).click();
         assert.equal(await page.getByRole('toolbar', { name: 'Markdown formatting' }).count(), 0);
         assert.ok((await page.locator('.article-markdown-editor__preview').innerText()).includes(ARTICLE_RETRIEVAL_TOKEN));
         await page.getByRole('tab', { name: 'Write', exact: true }).click();
     });

     await record('unsaved article navigation can be cancelled without losing its draft', async () => {
         dialogEvents.length = 0;
         await page.getByLabel('Title', { exact: true }).fill('Unsaved navigation draft');
         await page.getByRole('link', { name: 'Categories', exact: true }).click();
         assert.ok(dialogEvents.some(event => event.type === 'confirm' && /unsaved changes/i.test(event.message)));
         assert.ok(new URL(page.url()).pathname.endsWith('/articles/' + articleId), 'dismissal keeps the editor open');
         assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Unsaved navigation draft');
         await saveButton.click();
         assert.equal((await request('/api/knowledge/' + projectId + '/articles')).find(item => item.id === articleId).title, 'Unsaved navigation draft');
     });

     const draftArticle = await request('/api/knowledge/' + projectId + '/articles', {
         body: articleFixture({ title: 'Unpublished source remains excluded', status: 'draft', token: 'synthetic-T022DraftArticleMarker' }),
     });
     const actualArticleCitations = await searchFor(ARTICLE_RETRIEVAL_TOKEN);
     const articleReturnedByRetrieval = actualArticleCitations.some(citation => citation.content.includes(ARTICLE_RETRIEVAL_TOKEN));
     const articleRows = await request('/api/knowledge/' + projectId + '/articles');
     const articleEligibility = articleRows.find(item => item.id === articleId)?.aiEligibility;
     assert.equal(articleEligibility === 'used', articleReturnedByRetrieval, 'API article eligibility agrees with current real retrieval for the unique content');

     await record('article list shows current AI retrieval status for each published and draft source', async () => {
         await page.goto(base + '/articles');
         const publishedRow = page.getByRole('row').filter({ hasText: 'Unsaved navigation draft' });
         const draftRow = page.getByRole('row').filter({ hasText: 'Unpublished source remains excluded' });
         const publishedLabel = articleReturnedByRetrieval ? 'Used by AI answers' : articleEligibility === 'unknown' ? 'AI use not confirmed' : 'Not used by AI answers';
         await publishedRow.getByText(publishedLabel, { exact: true }).waitFor();
         await draftRow.getByText('Not used by AI answers', { exact: true }).waitFor();
         assert.equal(await publishedRow.getByText(publishedLabel, { exact: true }).count(), 1);
         assert.equal(await draftRow.getByText('Not used by AI answers', { exact: true }).count(), 1);
     });

     await record('failed website refresh remains labelled as used by AI answers', async () => {
         await page.goto(base + '/datasets');
         const sourceRow = page.getByRole('row').filter({ hasText: 'knowledge-fixture.example.test' });
         await sourceRow.getByText('Used by AI answers', { exact: true }).waitFor();
         assert.equal(await sourceRow.getByText('Used by AI answers', { exact: true }).count(), 1);
         assert.match(await sourceRow.innerText(), /failed/i, 'the failed refresh is visible without discarding the active source');
         assert.ok((await searchFor(DATASET_RETRIEVAL_TOKEN)).some(citation => citation.content.includes(DATASET_RETRIEVAL_TOKEN)));
     });

     assert.deepEqual(pageErrors, [], 'the Knowledge editor reports no uncaught browser errors');
     const exactRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
     const manifest = {
         sourceRevision: exactRevision,
         capturedAt: new Date().toISOString(),
         captures,
         checks,
         browser: 'headless Playwright Chromium',
         viewportNote: '390x360 after focusing the editor approximates a reduced visual viewport; the browser does not expose a native mobile software keyboard.',
     };
     await writeFile(join(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
     await writeFile(join(evidenceDir, 'result.json'), JSON.stringify({ passed: checks, pageErrors, failed: [] }, null, 2) + '\n');
     console.log('Knowledge activation browser evidence:', evidenceDir);
     console.log('Knowledge activation browser passed:', checks.length, 'checks on', exactRevision);
     success = true;
     await context.close();
 } catch (error) {
     await writeFile(join(evidenceDir, 'result.json'), JSON.stringify({ passed: checks, pageErrors, failed: [{ message: String(error?.stack || error) }] }, null, 2) + '\n');
     console.error('Knowledge activation browser failed:', error);
     throw error;
 } finally {
     await browser?.close();
     await runtime.close(success);
 }
}
