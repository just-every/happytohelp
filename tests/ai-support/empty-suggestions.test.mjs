import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('wrangler')] }));
const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler')] }));

const migrationFiles = [
    '0001_identity.sql',
    '0002_conversations.sql',
    '0004_message_intent.sql',
    '0005_widget_identity.sql',
    '0050_knowledge.sql',
    '0060_customer_context.sql',
    '0060_customer_context_engine.sql',
    '0070_management.sql',
    '0080_integrations.sql',
    '0081_billing_receipts.sql',
    '020_ai_support.sql',
    '0085_ai_context_guards.sql',
];

test('empty ordinary suggestions stop before queue while draft tools and idempotence remain available', async () => {
    const bundle = await build({
        entryPoints: ['tests/ai-support/empty-suggestions-worker.ts'],
        write: false,
        bundle: true,
        format: 'esm',
        platform: 'node',
        external: ['node:*', 'cloudflare:workers'],
        logLevel: 'silent',
    });
    let providerCalls = 0;
    const mf = new Miniflare(convertV4MiniflareOptions({
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-09-14',
        compatibilityFlags: ['nodejs_compat'],
        bindings: { OPENAI_API_KEY: 'sk-test' },
        d1Databases: ['DB'],
        durableObjects: { CONVERSATIONS: 'ConversationSocket' },
        outboundService: async () => {
            providerCalls += 1;
            return new Response('', { status: 500 });
        },
    }));

    try {
        const db = await mf.getD1Database('DB');
        for (const file of migrationFiles) {
            await db.exec((await readFile(`migrations/${file}`, 'utf8')).replaceAll('\n', ' '));
        }
        await db.exec("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://example.test',1);INSERT INTO contacts(id,project_id,name,email,external_id,created_at) VALUES('contact','p','Name',NULL,NULL,1);INSERT INTO ai_profiles VALUES('ai','p','Selected assistant','support','Use evidence','gpt-5.6-luna',1,0,NULL,1);");

        const insertConversation = async (id, { message = false } = {}) => {
            await db.prepare('INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
                .bind(id, 'p', 'contact', message ? 1 : 0, message ? `${id}-message` : null, 1, 1).run();
            await db.prepare('INSERT INTO conversation_ai VALUES(?,?)').bind(id, 'ai').run();
            if (message) {
                await db.prepare('INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
                    .bind(`${id}-message`, 'p', id, `${id}-local`, 'contact', 'contact', 'Customer question', 1, 1).run();
            }
        };
        const request = async body => {
            const response = await mf.dispatchFetch('http://local/request', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            return { response, body: await response.json() };
        };
        const actor = { id: 'operator', projectId: 'p', role: 'operator' };

        await insertConversation('empty');
        const empty = await request({
            projectId: 'p', conversationId: 'empty', actor, expectedRevision: 0,
            id: 'empty-suggestion', kind: 'suggestions',
        });
        assert.equal(empty.response.status, 409, JSON.stringify(empty.body));
        assert.match(empty.body.error, /CONVERSATION_MESSAGE_REQUIRED: Add a customer message first/);
        assert.equal(empty.body.queueCalls, 0);
        assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM ai_generations WHERE conversation_id='empty'").first()).total, 0);
        assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM ai_attempts').first()).total, 0);
        assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM ai_round_usage').first()).total, 0);
        assert.equal(providerCalls, 0);

        await db.prepare(`INSERT INTO ai_generations(id,project_id,conversation_id,state,source_revision,source_context_revision,source_last_message_id,actor_json,model,ai_id,ai_profile_json,kind,instruction,options_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind('existing-suggestion', 'p', 'empty', 'queued', 0, 0, null, JSON.stringify(actor), 'gpt-5.6-luna', 'ai', JSON.stringify({ id: 'ai', model: 'gpt-5.6-luna', prompt: 'Use evidence' }), 'suggestions', '', '{}', new Date().toISOString(), new Date().toISOString()).run();
        const existing = await request({
            projectId: 'p', conversationId: 'empty', actor, expectedRevision: 0,
            id: 'existing-suggestion', kind: 'suggestions',
        });
        assert.equal(existing.response.status, 200, JSON.stringify(existing.body));
        assert.deepEqual(existing.body.result, { id: 'existing-suggestion', state: 'queued' });
        assert.equal(existing.body.queueCalls, 0, 'idempotent readback must not dispatch');

        await insertConversation('draft');
        const draft = await request({
            projectId: 'p', conversationId: 'draft', actor, expectedRevision: 0,
            id: 'draft-tool', kind: 'suggestions', options: { tool: 'improve', message: 'Unsent draft' },
        });
        assert.equal(draft.response.status, 200, JSON.stringify(draft.body));
        assert.deepEqual(draft.body.result, { id: 'draft-tool', state: 'queued' });
        assert.equal(draft.body.queueCalls, 1, 'draft editing remains queueable without a customer message');

        await insertConversation('normal', { message: true });
        const normal = await request({
            projectId: 'p', conversationId: 'normal', actor, expectedRevision: 1,
            id: 'normal-suggestion', kind: 'suggestions',
        });
        assert.equal(normal.response.status, 200, JSON.stringify(normal.body));
        assert.deepEqual(normal.body.result, { id: 'normal-suggestion', state: 'queued' });
        assert.equal(normal.body.queueCalls, 2, 'normal suggestions remain queueable with a customer message');
        const repeat = await request({
            projectId: 'p', conversationId: 'normal', actor, expectedRevision: 1,
            id: 'normal-suggestion', kind: 'suggestions',
        });
        assert.equal(repeat.response.status, 200, JSON.stringify(repeat.body));
        assert.deepEqual(repeat.body.result, { id: 'normal-suggestion', state: 'queued' });
        assert.equal(repeat.body.queueCalls, 2, 'idempotent normal readback must not dispatch twice');
        assert.equal(providerCalls, 0, 'admission tests never call the provider');
    } finally {
        await mf.dispose();
    }
});
