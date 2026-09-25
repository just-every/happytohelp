'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { instrumentAgentSuggestionTrace } = require('../../scripts/eval/baseline');
const { imageInputsForRequestMessages } = require('../../scripts/eval/request-image-observer');
const { defaultOutputPath } = require('../../scripts/eval/run');
const { auditToolSummaryPaths } = require('../../scripts/eval/tool-summary-audit');

test('legacy bundle instrumentation observes optimized messages without altering its frozen source', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'scripts', 'eval', 'fixtures', 'baseline', 'src', 'llm', 'prompt', 'request.js');
    const frozen = fs.readFileSync(sourcePath, 'utf8');
    const instrumented = instrumentAgentSuggestionTrace(frozen);

    assert.match(instrumented, /onRequestMessages\?\.\(outgoingMessages\)/);
    assert.match(instrumented, /trace: options\?\.trace/);
    assert.equal(fs.readFileSync(sourcePath, 'utf8'), frozen);
});

test('request image observer records image transport metadata without retaining the source URL', () => {
    const inputs = imageInputsForRequestMessages([{
        content: [
            { type: 'text', text: 'Attached.' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } },
        ],
    }]);

    assert.deepEqual(inputs, [{
        transport: 'message_content.image_url',
        message_index: 0,
        content_index: 1,
        url_sha256: '3ce781d3ab1d65fee96552a54415d9902cf9622911ab54192015a158e18dc0e6',
        url_length: 30,
        data_url: true,
        mime_type: 'image/png',
        decoded_bytes: 5,
    }]);
});

test('evaluation output defaults to an operating-system temporary JSONL path', () => {
    assert.match(defaultOutputPath(123), /happytohelp-eval[\\/]suggestions-123\.jsonl$/);
});

test('tool summary audit marks only summary paths whose cost cannot be traced', () => {
    const audit = auditToolSummaryPaths([{
        type: 'tool_done',
        name: 'search_conversation_history',
        call_id: 'call-1',
        result: { output: 'partial output\n\n[Summary generation failed, output truncated]' },
    }]);

    assert.deepEqual(audit, {
        attempted_count: 1,
        unmetered: true,
        signals: [{
            tool_name: 'search_conversation_history',
            call_id: 'call-1',
            output_length: 61,
            status: 'summary_path_failed',
        }],
    });
});
