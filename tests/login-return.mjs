import assert from 'node:assert/strict';
import test from 'node:test';
import { loginDestination } from '../src/ui/native/dashboard-path.js';

const origin = 'https://support.example';
test('login restores an internal dashboard destination including filters', () => {
    assert.equal(loginDestination('/projects/abc/conversations/c1?q=follow%20up&view=active#message', origin), '/projects/abc/conversations/c1?q=follow%20up&view=active#message');
    assert.equal(loginDestination('/projects/create', origin, true), '/projects/create');
});
test('login refuses external, malformed, normalized, and non-dashboard destinations', () => {
    for (const target of [undefined, '', 'https://evil.example', 'https://support.example/conversations', '//evil.example', '/\\evil.example', '/%5cevil.example', '/conversations\n', '/conversations%0a', '/projects/abc/%', '/projects/abc/../../login', '/login', '/api/identity/session', 'javascript:alert(1)', '/\tevil.example', '//support.example/conversations']) {
        assert.equal(loginDestination(target, origin), '/conversations', String(target));
        assert.equal(loginDestination(target, origin, true), '/projects/create', String(target));
    }
});
test('login returns an invited person to their invitation link', () => {
    const link = '/accept-invitation?token=abc123';
    assert.equal(loginDestination(link, origin), link);
    assert.equal(loginDestination(link, origin, true), link);
    assert.equal(loginDestination('/accept-invitation', origin), '/accept-invitation');
    for (const target of ['/accept-invitation/extra', '/accept-invitation%0a', '//accept-invitation?token=1', 'https://evil.example/accept-invitation?token=1', '/register', '/verify-email?token=1']) {
        assert.equal(loginDestination(target, origin), '/conversations', target);
    }
});
