import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && context.parentURL) {
            const candidate = new URL(`${specifier}.ts`, context.parentURL);
            if (existsSync(candidate)) return nextResolve(candidate.href, context);
        }
        return nextResolve(specifier, context);
    },
});

const { handleToolCall, prepareToolArguments } = await import('../../src/modules/ai-support/vendor/ensemble/utils/tool_execution_manager.js');
const { repositoryTools } = await import('../../src/modules/ai-support/repository-tools.ts');

const nullableParameters = {
    type: 'object',
    properties: {
        ref: { type: ['string', 'null'] },
    },
    required: ['ref'],
};

test('required nullable values distinguish omitted, disallowed, and explicit null', () => {
    const missingRef = error => /Required parameter/.test(error?.message || '') && /ref/.test(error?.message || '');
    assert.deepEqual(
        prepareToolArguments(JSON.stringify({ ref: null }), { definition: { function: { parameters: nullableParameters } } }),
        [null],
    );
    assert.throws(
        () => prepareToolArguments('{}', { definition: { function: { parameters: nullableParameters } } }),
        missingRef,
    );
    const nonNullableParameters = {
        ...nullableParameters,
        properties: { ref: { type: 'string' } },
    };
    assert.throws(
        () => prepareToolArguments(JSON.stringify({ ref: null }), { definition: { function: { parameters: nonNullableParameters } } }),
        missingRef,
    );
    assert.throws(
        () => prepareToolArguments(JSON.stringify({ ref: null }), { definition: { function: { parameters: {
            ...nullableParameters,
            properties: { ref: { type: ['string', 'null'], enum: ['main'] } },
        } } } }),
        missingRef,
    );
    assert.deepEqual(
        prepareToolArguments(JSON.stringify({ ref: null }), { definition: { function: { parameters: {
            ...nullableParameters,
            properties: { ref: { type: ['string', 'null'], enum: ['main', null] } },
        } } } }),
        [null],
    );
});

test('repository read dispatch accepts the nullable default arguments and records evidence', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async url => {
        assert.equal(String(url), 'https://api.github.com/repos/just-every/happytohelp/contents/README.md');
        return Response.json({
            type: 'file',
            encoding: 'base64',
            size: 24,
            sha: 'sha-readme',
            html_url: 'https://github.com/just-every/happytohelp/blob/sha-readme/README.md',
            content: btoa('Product README evidence.\n'),
        });
    };
    try {
        const evidenceIds = new Set();
        const env = {
            DB: { prepare: sql => ({ bind: () => ({ first: async () => sql.includes('github_connections') ? null : ({ repositories_json: '["just-every/happytohelp"]', allow_agents: 1, allow_contacts: 1 }) }) }) },
            GITHUB_TOKENS: JSON.stringify({ project: 'mapped-token' }),
        };
        const tools = await repositoryTools(env, 'project', 'agent', evidenceIds);
        const tool = tools.find(item => item.definition.function.name === 'repo_read_file');
        const result = await handleToolCall({
            id: 'repo-read-dispatch',
            call_id: 'repo-read-dispatch',
            type: 'function',
            function: {
                name: 'repo_read_file',
                arguments: JSON.stringify({ repository: 'just-every/happytohelp', path: 'README.md', ref: null, start_offset: 0, expected_sha: null }),
            },
        }, tool, { agent_id: 'test-agent', tools: [tool], modelSettings: {} });

        const output = JSON.parse(result);
        assert.equal(output.repository, 'just-every/happytohelp');
        assert.equal(output.path, 'README.md');
        assert.equal(output.ref, null);
        assert.equal(output.evidence_id, 'repo:just-every/happytohelp:sha-readme:README.md');
        assert.deepEqual(output.evidence_ids, ['repo:just-every/happytohelp:sha-readme:README.md']);
        assert.deepEqual([...evidenceIds], ['repo:just-every/happytohelp:sha-readme:README.md']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
