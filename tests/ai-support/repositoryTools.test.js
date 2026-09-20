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

test('repository read tool returns attributed bounded content and records its evidence ID', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async url => {
        calls.push(String(url));
        assert.equal(String(url), 'https://api.github.com/repos/org/repo/contents/README.md?ref=main');
        return Response.json({
            type: 'file',
            encoding: 'base64',
            size: 24,
            sha: 'sha-readme',
            html_url: 'https://github.com/org/repo/blob/sha-readme/README.md',
            content: btoa('Product README evidence.\n'),
        });
    };
    try {
        const evidenceIds = new Set();
        const env = {
            DB: { prepare: sql => ({ bind: () => ({ first: async () => sql.includes('github_connections') ? null : ({ repositories_json: '["org/repo"]', allow_agents: 1, allow_contacts: 1 }) }) }) },
            GITHUB_TOKENS: JSON.stringify({ project: 'mapped-token' }),
        };
        const tools = await repositoryTools(env, 'project', 'agent', evidenceIds);
        const read = tools.find(tool => tool.definition.function.name === 'repo_read_file');
        assert.ok(read);
        assert.deepEqual(Object.keys(read.definition.function.parameters.properties), ['repository', 'path', 'ref', 'start_offset', 'expected_sha']);
        assert.match(read.definition.function.description, /sha is a blob identity, not a ref/);
        assert.match(read.definition.function.description, /evidence_ids/);
        const output = await read.function('org/repo', 'README.md', 'main', 0);
        assert.equal(output.repository, 'org/repo');
        assert.equal(output.path, 'README.md');
        assert.equal(output.ref, 'main');
        assert.equal(output.content, 'Product README evidence.\n');
        assert.equal(output.evidence_id, 'repo:org/repo:sha-readme:README.md');
        assert.deepEqual(output.evidence_ids, ['repo:org/repo:sha-readme:README.md']);
        assert.deepEqual([...evidenceIds], ['repo:org/repo:sha-readme:README.md']);
        assert.deepEqual(calls, ['https://api.github.com/repos/org/repo/contents/README.md?ref=main']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('repository read continuation rejects a changed blob instead of switching refs silently', async () => {
    const originalFetch = globalThis.fetch;
    let call = 0;
    const urls = [];
    globalThis.fetch = async url => {
        call += 1;
        urls.push(String(url));
        return Response.json({
            type: 'file',
            encoding: 'base64',
            size: 24,
            sha: call === 1 ? 'sha-old' : 'sha-new',
            html_url: 'https://github.com/org/repo/blob/sha/readme',
            content: btoa(call === 1 ? 'old content' : 'new content'),
        });
    };
    try {
        const env = {
            DB: { prepare: sql => ({ bind: () => ({ first: async () => sql.includes('github_connections') ? null : ({ repositories_json: '["org/repo"]', allow_agents: 1, allow_contacts: 1 }) }) }) },
            GITHUB_TOKENS: JSON.stringify({ project: 'mapped-token' }),
        };
        const evidenceIds = new Set();
        const tools = await repositoryTools(env, 'project', 'agent', evidenceIds);
        const read = tools.find(tool => tool.definition.function.name === 'repo_read_file');
        await read.function('org/repo', 'README.md', 'main', 0, null);
        await assert.rejects(
            read.function('org/repo', 'README.md', 'main', 10, null),
            error => error?.status === 400 && /requires expected_sha/.test(error.message),
        );
        await assert.rejects(
            read.function('org/repo', 'README.md', 'main', 10, 'sha-old'),
            error => error?.status === 409 && /restart the read from offset 0/.test(error.message),
        );
        assert.equal(call, 2);
        assert.deepEqual(urls, [
            'https://api.github.com/repos/org/repo/contents/README.md?ref=main',
            'https://api.github.com/repos/org/repo/contents/README.md?ref=main',
        ]);
        assert.deepEqual([...evidenceIds], ['repo:org/repo:sha-old:README.md']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
