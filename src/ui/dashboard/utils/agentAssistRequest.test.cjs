const test = require('node:test');
const assert = require('node:assert/strict');
const { canSendAgentAssistRequest } = require('./agentAssistRequest');

test('an agent assist request can send on its authenticated socket', () => {
    const keyState = { key: 'key' };
    assert.equal(canSendAgentAssistRequest({
        expired: false,
        expectedKeyState: keyState,
        currentKeyState: keyState,
        socketOpen: true,
    }), true);
});

test('an agent assist request cannot send after expiry during encryption', async () => {
    const keyState = { key: 'key' };
    let expired = false;
    const encryption = new Promise(resolve => setTimeout(resolve, 5));

    expired = true;
    await encryption;

    assert.equal(canSendAgentAssistRequest({
        expired,
        expectedKeyState: keyState,
        currentKeyState: keyState,
        socketOpen: true,
    }), false);
});

test('an agent assist request cannot cross a close or a re-authentication', () => {
    const originalKeyState = { key: 'original' };
    const replacementKeyState = { key: 'replacement' };

    assert.equal(canSendAgentAssistRequest({
        expired: false,
        expectedKeyState: originalKeyState,
        currentKeyState: replacementKeyState,
        socketOpen: true,
    }), false);
    assert.equal(canSendAgentAssistRequest({
        expired: false,
        expectedKeyState: originalKeyState,
        currentKeyState: originalKeyState,
        socketOpen: false,
    }), false);
});
