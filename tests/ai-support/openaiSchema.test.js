import assert from 'node:assert/strict';
import test from 'node:test';

import { processSchemaForOpenAI } from '../../src/modules/ai-support/vendor/ensemble/utils/json_schema.js';

test('OpenAI structured output preserves evidence array cardinality', () => {
    const schema = {
        type: 'object',
        properties: {
            evidence_ids: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 4,
            },
        },
        required: ['evidence_ids'],
        additionalProperties: false,
    };

    const processed = processSchemaForOpenAI(schema, undefined, 'json_schema');
    assert.equal(processed.properties.evidence_ids.minItems, 1);
    assert.equal(processed.properties.evidence_ids.maxItems, 4);
});
