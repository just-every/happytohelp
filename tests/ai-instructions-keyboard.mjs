import assert from 'node:assert/strict';
import { submitInstructionsOnEnter } from '../src/ui/dashboard/utils/submitInstructionsOnEnter.js';

function press(overrides = {}, options = {}) {
    let prevented = 0;
    let submits = 0;
    submitInstructionsOnEnter({
        key: 'Enter', shiftKey: false, repeat: false, nativeEvent: {},
        preventDefault() { prevented++; },
        currentTarget: { form: { requestSubmit() { submits++; } } },
        ...overrides,
    }, { busy: false, composing: false, ...options });
    return { prevented, submits };
}
assert.deepEqual(press(), { prevented: 1, submits: 1 }, 'Enter uses the form submit path exactly once');
for (const overrides of [{ shiftKey: true }, { key: 'a' }, { nativeEvent: { isComposing: true } }, { nativeEvent: { keyCode: 229 } }]) {
    assert.deepEqual(press(overrides), { prevented: 0, submits: 0 }, 'Typing, newlines and IME remain native');
}
assert.deepEqual(press({}, { composing: true }), { prevented: 0, submits: 0 });
assert.deepEqual(press({ repeat: true }), { prevented: 1, submits: 0 }, 'Holding Enter cannot repeat generation');
assert.deepEqual(press({}, { busy: true }), { prevented: 1, submits: 0 }, 'Busy/disabled instructions cannot submit');
console.log('AI instructions keyboard checks passed');
