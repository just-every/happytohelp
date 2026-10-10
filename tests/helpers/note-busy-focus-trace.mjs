import assert from 'node:assert/strict';

// Observe the commit before Bootstrap's deferred enforceFocus can conceal a blur.
// This changes no focus behavior, event default, or application response.
export async function startNoteFocusTrace(dialog) {
    await dialog.evaluate(element => {
        const form = element.querySelector('form');
        const trace = {events: [], commits: [], violations: []};
        const describe = node => node && ({tag: node.tagName, id: node.id, label: node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 80)});
        const busy = () => element.isConnected && form.getAttribute('aria-busy') === 'true';
        const snapshot = kind => {
            const active = document.activeElement;
            return {kind, time: performance.now(), busy: busy(), active: describe(active), dialogFocused: active === element,
                contained: element.contains(active), disabledControls: element.querySelectorAll('button:disabled, textarea:disabled').length};
        };
        const listener = event => {
            const record = {...snapshot(event.type), target: describe(event.target), relatedTarget: describe(event.relatedTarget)};
            trace.events.push(record);
            if (record.busy && (!record.contained || (event.type === 'focusout' && !element.contains(event.relatedTarget)))) trace.violations.push(record);
        };
        document.addEventListener('focusin', listener, true);
        document.addEventListener('focusout', listener, true);
        const observer = new MutationObserver(mutations => {
            if (!mutations.some(mutation => mutation.attributeName === 'aria-busy' || mutation.attributeName === 'disabled')) return;
            const record = snapshot('busy/disabled commit');
            trace.commits.push(record);
            if (record.busy && !record.dialogFocused) trace.violations.push(record);
        });
        observer.observe(element, {subtree: true, attributes: true, attributeFilter: ['aria-busy', 'disabled']});
        window.noteFocusTrace = {trace, stop: () => {
            observer.disconnect();
            document.removeEventListener('focusin', listener, true);
            document.removeEventListener('focusout', listener, true);
            return trace;
        }};
    });
}

export function assertNoteFocusTrace(trace) {
    const busyCommits = trace.commits.filter(commit => commit.busy);
    assert.ok(busyCommits.length, 'observed native busy/disabled commit before any keyboard input');
    assert.ok(busyCommits.some(commit => commit.disabledControls === 4), 'all four controls disabled in busy commit');
    assert.ok(busyCommits.every(commit => commit.dialogFocused), 'busy commit must already focus the dialog');
    assert.deepEqual(trace.violations, [], 'native focus never visits BODY or another outside target while busy');
}

export async function checkHeldNoteKeys(page, dialog) {
    assert.equal(await dialog.locator('button:not(:disabled), textarea:not(:disabled)').count(), 0);
    assert.equal(await dialog.evaluate(element => document.activeElement === element), true, 'busy dialog focused before first key');
    for (const key of ['Tab', 'Shift+Tab', 'Tab', 'Shift+Tab', 'Escape']) {
        await page.keyboard.press(key);
        assert.equal(await dialog.evaluate(element => document.activeElement === element), true, `${key} retains busy dialog focus`);
        assert.equal(await dialog.isVisible(), true, `${key} does not cancel in-flight note`);
    }
    // Backdrop dismissal must also leave the busy operation alone.
    await dialog.click({position: {x: 2, y: 2}});
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.evaluate(element => document.activeElement === element), true);
}
