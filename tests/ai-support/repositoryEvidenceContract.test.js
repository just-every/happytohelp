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

const { repositoryTools } = await import('../../src/modules/ai-support/repository-tools.ts');
const { generateTwoPassSuggestions } = await import('../../src/modules/ai-support/assist/twoPassSuggestions.js');

const env = {
    DB: { prepare: sql => ({ bind: () => ({ first: async () => sql.includes('github_connections') ? null : ({ repositories_json: '["just-every/happytohelp"]', allow_agents: 1, allow_contacts: 1 }) }) }) },
    GITHUB_TOKENS: JSON.stringify({ project: 'mapped-token' }),
};

test('a real repository read result supplies the exact ID accepted by the suggestion validator', async () => {
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
        const tools = await repositoryTools(env, 'project', 'agent', evidenceIds);
        const read = tools.find(tool => tool.definition.function.name === 'repo_read_file');
        const toolOutput = await read.function('just-every/happytohelp', 'README.md', null, 0, null);
        const evidenceId = toolOutput.evidence_ids[0];

        const result = await generateTwoPassSuggestions({
            context: { options: {}, assist: { evidenceIds } },
            buildMessages: () => [],
            runPass: async pass => {
                if (pass.stage === 'primary') {
                    await pass.trace.onToolCall({
                        type: 'tool_done',
                        tool_call: { call_id: 'repo-read-1', function: { name: 'repo_read_file' } },
                        result: { call_id: 'repo-read-1', output: JSON.stringify(toolOutput) },
                    });
                    return {
                        user_goal: 'Understand the product behavior.',
                        responses: [{
                            button: 'Product behavior',
                            icon: 'circle-question-mark',
                            response: 'The repository README describes the product behavior.',
                            use_when: '',
                            evidence_ids: [evidenceId],
                        }],
                        missing_information: [],
                    };
                }
                return { alternatives: [], missing_information: [] };
            },
        });

        assert.deepEqual(toolOutput.evidence_ids, [evidenceId]);
        assert.equal(evidenceIds.has(evidenceId), true);
        assert.deepEqual(result.responses[0].evidence_ids, [evidenceId]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('a repository read cannot be replaced by an empty evidence result', async () => {
    await assert.rejects(generateTwoPassSuggestions({
        context: { options: {}, assist: { evidenceIds: new Set(['repo:just-every/happytohelp:sha-readme:README.md']) } },
        buildMessages: () => [],
        runPass: async pass => pass.stage === 'primary'
            ? {
                user_goal: 'Understand the product behavior.',
                responses: [{
                    button: 'Product behavior',
                    icon: 'circle-question-mark',
                    response: 'The repository README describes the product behavior.',
                    use_when: '',
                    evidence_ids: [],
                }],
                missing_information: [],
            }
            : { alternatives: [], missing_information: [] },
    }), /evidence_ids/);
});
