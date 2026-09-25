const test = require('node:test');
const assert = require('node:assert/strict');
const { within } = require('./boundedPromise');

test('within resolves before its deadline', async () => {
    assert.equal(await within(Promise.resolve('sent'), 20, 'timed out'), 'sent');
});

test('within rejects and invokes its expiry callback once', async () => {
    let expired = 0;
    await assert.rejects(
        within(new Promise(() => {}), 5, 'Chat service is unavailable', () => { expired += 1; }),
        /Chat service is unavailable/,
    );
    assert.equal(expired, 1);
});

test('a late source resolution does not replace a timeout', async () => {
    let resolveSource;
    const source = new Promise(resolve => { resolveSource = resolve; });
    const outcome = within(source, 5, 'timed out').then(
        () => 'resolved',
        error => error.message,
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    resolveSource('late');
    assert.equal(await outcome, 'timed out');
});
