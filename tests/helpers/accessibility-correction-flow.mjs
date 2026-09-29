import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {measureFocusIndicator} from './accessibility-focus-contrast.mjs';

export async function checkNoteLoop(page, evidenceDir) {
    const dialog = page.getByRole('dialog', {name: 'Add Note'});
    // Wait beyond Bootstrap's entrance transition, when its enforceFocus handler is active.
    await page.waitForTimeout(450);
    const controls = dialog.locator('button, textarea');
    assert.equal(await controls.count(), 4);
    for (const [key, index] of [['Tab', 0], ['Shift+Tab', 3]]) {
        await dialog.focus();
        await page.keyboard.press(key);
        assert.equal(await controls.nth(index).evaluate(element => element === document.activeElement), true, `settled container ${key} did not reach a control`);
    }
    const stops = [];
    for (const direction of ['Tab', 'Shift+Tab']) {
        await controls.first().focus();
        for (let step = 0; step < 12; step++) {
            await page.keyboard.press(direction);
            const state = await dialog.evaluate(element => {
                const active = document.activeElement;
                return {contained: element.contains(active), tag: active.tagName, id: active.id, name: active.getAttribute('aria-label') || active.labels?.[0]?.textContent || active.textContent};
            });
            const expected = direction === 'Tab' ? [1, 2, 3, 0][step % 4] : [3, 2, 1, 0][step % 4];
            assert.equal(await controls.nth(expected).evaluate(element => element === document.activeElement), true, `${direction} step ${step}: ${JSON.stringify(state)}`);
            assert.equal(state.contained, true);
            stops.push({direction, step, ...state});
        }
    }
    await page.screenshot({path: join(evidenceDir, 'note-dialog-repeated-navigation.png')});
    await writeFile(join(evidenceDir, 'note-dialog-repeated-navigation.json'), JSON.stringify({settledMilliseconds: 450, stops}, null, 2));
}

export async function checkBrandingFocus(page, evidenceDir) {
    const measurements = [];
    for (const viewport of [{width: 1440, height: 1000}, {width: 320, height: 568}]) {
        await page.setViewportSize(viewport);
        const summary = page.locator('summary').filter({hasText: 'Additional branding'});
        await summary.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await summary.evaluate(element => element === document.activeElement), true);
        const indicator = await measureFocusIndicator(page, {samplePixels: true});
        measurements.push({viewport, ...indicator});
        await writeFile(join(evidenceDir, 'branding-focus-contrast.json'), JSON.stringify(measurements, null, 2));
        await page.screenshot({path: join(evidenceDir, `branding-focus-${viewport.width}.png`)});
        assert.ok(indicator.ringContrastAgainstHalo >= 3, 'branding focus computed contrast');
        assert.ok(indicator.pixelSample.contrastRatio >= 3, 'branding focus rendered contrast');
        await page.keyboard.press('Enter');
        assert.equal(await summary.evaluate(element => element.parentElement.open), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.getByLabel('Logo URL', {exact: true}).evaluate(element => element === document.activeElement), true);
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Space');
        assert.equal(await summary.evaluate(element => element.parentElement.open), false);
    }
    await page.setViewportSize({width: 1440, height: 1000});
    await writeFile(join(evidenceDir, 'branding-focus-contrast.json'), JSON.stringify(measurements, null, 2));
}

export async function submitBusyNote(page, evidenceDir) {
    const dialog = page.getByRole('dialog', {name: 'Add Note'});
    const routePattern = '**/api/dashboard/projects/*/conversations/*/notes';
    let release;
    const held = new Promise(resolve => { release = resolve; });
    // Delay transport only; continue the original request to the real Worker unchanged.
    const handler = async route => { await held; await route.continue(); };
    await page.route(routePattern, handler);
    try {
        await dialog.getByRole('button', {name: 'Add', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('[role="dialog"] form')?.getAttribute('aria-busy') === 'true');
        assert.equal(await dialog.locator('button:not(:disabled), textarea:not(:disabled)').count(), 0);
        await page.keyboard.press('Tab');
        for (const key of ['Tab', 'Shift+Tab', 'Escape']) {
            await page.keyboard.press(key);
            assert.equal(await dialog.evaluate(element => element === document.activeElement), true, `busy note ${key} lost dialog focus`);
            assert.equal(await dialog.isVisible(), true);
        }
        await writeFile(join(evidenceDir, 'note-dialog-busy.json'), JSON.stringify({transport: 'delayed, then forwarded to real local Worker', disabledControls: 4, retainedFocus: ['Tab', 'Shift+Tab', 'Escape']}, null, 2));
    } finally {
        release();
        await dialog.waitFor({state: 'detached'});
        await page.unroute(routePattern, handler);
    }
}

export async function checkPopulatedArticle({page, runtime, projectId, ownerToken, call, audit, evidenceDir}) {
    const article = await call(`/api/knowledge/${projectId}/articles`, {title: 'Keyboard support article', slug: 'keyboard-support', content: 'Synthetic local audit article.', status: 'draft'}, ownerToken);
    await page.goto(`${runtime.origin}/projects/${projectId}/articles/${article.id}`);
    await page.getByRole('button', {name: 'Delete', exact: true}).waitFor();
    for (const viewport of [{width: 1440, height: 1000}, {width: 320, height: 568}]) {
        await page.setViewportSize(viewport);
        const label = `dashboard-populated-article-${viewport.width}`;
        audit.assertAxeClean(await audit.scan(page, label), label);
        await audit.measureContrast(page, label, [{label: 'article Delete action', selector: '.knowledge-form-actions .btn-link.text-danger'}]);
        const layout = await audit.measureLayout(page, label);
        assert.equal(layout.horizontalOverflow, false);
        assert.equal(layout.targetsClipped.length, 0);
        const spacing = layout.targetsBelow24.map(target => {
            const cx = target.x + target.width / 2, cy = target.y + target.height / 2;
            const others = layout.interactive.filter(other => !(other.name === target.name && other.x === target.x && other.y === target.y));
            const clearances = others.map(other => other.targetBelow24
                ? Math.hypot(cx - other.x - other.width / 2, cy - other.y - other.height / 2) - 24
                : Math.hypot(Math.max(other.x - cx, 0, cx - other.right), Math.max(other.y - cy, 0, cy - other.bottom)) - 12);
            const minimumClearance = Math.min(...clearances);
            assert.ok(minimumClearance >= 0, `${target.name} fails the 24px target-spacing circle check`);
            return {name: target.name, width: target.width, height: target.height, minimumClearance, disposition: '24px circle centered on this target does not intersect other targets or their undersized-target circles'};
        });
        await writeFile(join(evidenceDir, `${label}-target-spacing.json`), JSON.stringify(spacing, null, 2));
        const action = page.getByRole('button', {name: 'Delete', exact: true});
        await action.focus();
        const confirmation = page.waitForEvent('dialog').then(async prompt => {
            try {
                assert.equal(prompt.type(), 'confirm');
                assert.match(prompt.message(), /Keyboard support article/);
            } finally {
                await prompt.dismiss();
            }
        });
        await Promise.all([page.keyboard.press('Enter'), confirmation]);
        assert.equal(await action.isVisible(), true);
        await action.scrollIntoViewIfNeeded();
        await action.focus();
        await page.screenshot({path: join(evidenceDir, `${label}-delete-focus.png`)});
    }
    await page.setViewportSize({width: 1440, height: 1000});
}
