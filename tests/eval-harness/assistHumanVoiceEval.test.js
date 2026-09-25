'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const {
    FIXTURE_PATH,
    contextForCase,
    evaluateHumanVoice,
    loadFixture,
    validateFixture,
} = require('../../scripts/eval/assist-human-voice');

const LIVE_ENTRY_PATH = path.join(__dirname, '..', '..', 'scripts', 'eval', 'assist-human-voice-live-entry.js');

const caseById = (fixture, id) => {
    const item = fixture.cases.find(candidate => candidate.id === id);
    assert.ok(item, `missing fixture case '${id}'`);
    return item;
};

const failureChecks = result => result.failures.map(failure => failure.check);

const loadLiveRunner = async ({ promptPath = null } = {}) => {
    const esbuild = require('esbuild');
    const resolvedPromptPath = promptPath ? path.resolve(promptPath) : null;
    if (resolvedPromptPath && !fs.existsSync(resolvedPromptPath)) {
        throw new Error(`Prompt override was not found: ${resolvedPromptPath}`);
    }
    const plugins = resolvedPromptPath ? [{
        name: 'assist-human-voice-prompt-override',
        setup(build) {
            build.onResolve({ filter: /^\.\.\/\.\.\/src\/assist\/prompt$/ }, args => (
                args.importer === LIVE_ENTRY_PATH
                    ? { path: resolvedPromptPath, namespace: 'assist-human-voice-prompt-override' }
                    : undefined
            ));
            build.onLoad({ filter: /.*/, namespace: 'assist-human-voice-prompt-override' }, () => ({
                contents: fs.readFileSync(resolvedPromptPath, 'utf8'),
                loader: 'js',
                resolveDir: path.join(__dirname, '..', '..', 'src', 'assist'),
            }));
        },
    }] : [];
    const result = await esbuild.build({
        entryPoints: [LIVE_ENTRY_PATH],
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'node22',
        packages: 'external',
        plugins,
        write: false,
        logLevel: 'silent',
    });
    const source = result.outputFiles?.[0]?.text;
    if (!source) throw new Error('Unable to bundle the human-voice live evaluation runner.');

    const compiled = new Module('assist-human-voice-live-evaluation.cjs', module);
    compiled.filename = path.join(__dirname, '..', '.cache', 'assist-human-voice-live-evaluation.cjs');
    compiled.paths = Module._nodeModulePaths(path.join(__dirname, '..'));
    compiled._compile(source, compiled.filename);
    return compiled.exports;
};

test('human-voice fixture is synthetic, focused, and supplies an in-memory human-draft packet', () => {
    const fixture = loadFixture();
    assert.equal(FIXTURE_PATH.endsWith('tests/eval-harness/fixtures/assist-human-voice.json'), true);
    assert.deepEqual(validateFixture(fixture), []);
    assert.deepEqual(fixture.cases.map(item => item.id), [
        'handoff_thanks',
        'no_human_name',
        'downstream_specialist',
        'draft_edit_handoff',
        'handoff_alternatives',
    ]);

    for (const item of fixture.cases) {
        const context = contextForCase(item);
        assert.equal(context.assist.packet.mode, 'human-draft');
        assert.equal(context.assist.packet.timeline.at(-1).author.kind, 'contact');
        assert.equal(context.assist.packet.timeline.some(entry => entry.author.kind === 'ai'), true);
        assert.equal(context.assist.packet.knowledge.catalog.length, 0);
        assert.equal(context.assist.evidenceIds.size, item.messages.length + 4);
        assert.equal(context.assist.packet.drafting_identity.ai_reference.name, 'Aster');
        assert.equal(context.options.agent_instructions, '');
        assert.equal(context.assist.policies.find(policy => policy.source === 'server-selected-ai').text, item.selected_ai.prompt);
    }

    assert.equal(contextForCase(caseById(fixture, 'no_human_name')).assist.packet.drafting_identity.human, null);
});

test('semantic check keeps primary and alternatives in the current operator voice', () => {
    const fixture = loadFixture();
    const item = caseById(fixture, 'handoff_thanks');
    const safe = evaluateHumanVoice(item, {
        responses: [
            {
                response: "Thanks — I'll review the delivery record for SV-HANDOFF-41 and update you on the next step.",
            },
            {
                response: "You're welcome. I'll check what is holding up the delivery update and keep working with you if anything is still unresolved.",
            },
        ],
    });
    assert.equal(safe.passed, true);
    assert.equal(evaluateHumanVoice(item, {
        responses: [{ response: 'Hi Riley, I’m taking over this issue. I’ll review the delivery record.' }],
    }).passed, true);
    assert.equal(evaluateHumanVoice(item, {
        responses: [{ response: 'Please confirm the delivery postcode.' }],
    }).passed, true, 'a useful detail request can be natural human voice without an explicit first-person phrase');

    const botVoice = evaluateHumanVoice(item, {
        responses: [
            { response: "We'll have a representative review the delivery update." },
            { response: 'To help the representative, please confirm your email address.' },
            { response: "I'll keep this open for the team. Since outbound emails arrive but replies do not, they'll focus specifically on the reply forwarding path." },
            { response: 'Aster has requested a human agent to help you.' },
        ],
    });
    assert.equal(botVoice.passed, false);
    assert.equal(failureChecks(botVoice).filter(check => check === 'bot_rehandoff').length, 4);
    assert.equal(failureChecks(botVoice).includes('selected_ai_as_sender'), true);
});

test('semantic check permits a concrete downstream specialist while preserving the current operator as owner', () => {
    const fixture = loadFixture();
    const item = caseById(fixture, 'downstream_specialist');
    const safe = evaluateHumanVoice(item, {
        responses: [
            {
                response: "Thanks — I'll review the tax exemption mismatch and coordinate with our billing specialist if their review is needed.",
            },
            {
                response: "I'll check the invoice details first, then update you after I work with the billing team on the exception.",
            },
        ],
    });
    assert.equal(safe.passed, true);

    const rehandoff = evaluateHumanVoice(item, {
        responses: [{ response: 'A human representative will take over and contact you about the invoice.' }],
    });
    assert.equal(rehandoff.passed, false);
    assert.equal(failureChecks(rehandoff).includes('bot_rehandoff'), true);
    assert.equal(failureChecks(rehandoff).includes('downstream_specialist'), true);
});

test('semantic check keeps an unnamed operator unnamed and catches draft-edit rehandoff language', () => {
    const fixture = loadFixture();
    const nameless = caseById(fixture, 'no_human_name');
    assert.equal(evaluateHumanVoice(nameless, {
        responses: [{ response: "I'm sorry this took so long — I'll review the duplicate renewal and update you after I check the account record." }],
    }).passed, true);
    const named = evaluateHumanVoice(nameless, {
        responses: [{ response: "I'm Casey, and another human representative will handle the renewal." }],
    });
    assert.equal(failureChecks(named).includes('assumed_human_name'), true);
    assert.equal(failureChecks(named).includes('bot_rehandoff'), true);

    const draftEdit = caseById(fixture, 'draft_edit_handoff');
    assert.equal(evaluateHumanVoice(draftEdit, {
        response: "Thanks — I'll review SV-DRAFT-63 and follow up once I've checked the delivery record.",
    }).passed, true);
    const staleDraft = evaluateHumanVoice(draftEdit, {
        response: 'Aster has asked another human representative to contact you about SV-DRAFT-63.',
    });
    assert.equal(failureChecks(staleDraft).includes('bot_rehandoff'), true);
    assert.equal(failureChecks(staleDraft).includes('selected_ai_as_sender'), true);
});

test('live runner bundles the real prompt path without contacting a provider', async () => {
    const { LIVE_MODEL, runLiveCase } = await loadLiveRunner({
        promptPath: process.env.ASSIST_HUMAN_VOICE_PROMPT || null,
    });
    assert.equal(LIVE_MODEL, 'gpt-5.6-luna');
    assert.equal(typeof runLiveCase, 'function');
});

const runLive = process.env.RUN_ASSIST_HUMAN_VOICE_LIVE === '1';

test('opt-in Luna run uses the real two-pass schemas without tools or database logging', {
    skip: runLive ? false : 'Set RUN_ASSIST_HUMAN_VOICE_LIVE=1 to call Luna.',
    timeout: 300000,
}, async t => {
    assert.equal(process.env.AI_USAGE_LOGGING_DISABLED, '1', 'live evaluation requires AI_USAGE_LOGGING_DISABLED=1');
    assert.ok(process.env.OPENAI_API_KEY, 'live evaluation requires OPENAI_API_KEY');

    const fixture = loadFixture();
    const promptPath = process.env.ASSIST_HUMAN_VOICE_PROMPT || null;
    const { LIVE_MODEL, runLiveCase } = await loadLiveRunner({ promptPath });
    assert.equal(LIVE_MODEL, 'gpt-5.6-luna');

    for (const item of fixture.cases) {
        await t.test(item.id, async subtest => {
            const result = await runLiveCase(item);
            subtest.diagnostic(JSON.stringify({
                prompt_variant: promptPath ? path.resolve(promptPath) : 'current',
                case_id: result.case_id,
                model: result.model,
                output: result.output,
                checks: result.checks,
                usage: result.usage,
            }));
            assert.equal(result.model, LIVE_MODEL);
            assert.deepEqual(result.tools, []);
            assert.equal(result.checks.passed, true, `${item.id}: ${JSON.stringify(result.checks.failures)}`);
            if (item.id === 'handoff_alternatives') {
                assert.ok(result.output.responses.length > 1, 'evaluate real alternatives as well as the primary');
                assert.ok(result.output.responses.slice(1).some(reply => reply.use_when), 'include a conditional action alternative');
            }
            if (item.mode === 'suggestions') {
                assert.deepEqual(result.usage.at(-1)?.metadata?.stages, ['primary', 'alternatives']);
            } else {
                assert.equal(result.usage.length, 1);
            }
        });
    }
});
