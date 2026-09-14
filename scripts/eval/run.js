'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const { evaluateSuggestion } = require('./checks');
const { CHAT_ROOT, loadFixture, validateFixture } = require('./fixture');
const { auditToolSummaryPaths } = require('./tool-summary-audit');

const DEFAULT_PROTOTYPE_MODELS = [
    'gpt-5.5',
    'gpt-6-astra',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'claude-fable-5-1',
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-haiku-4-5-20251001',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
];

const parseArgs = (argv) => {
    const values = { cases: [] };
    for (let index = 0; index < argv.length; ++index) {
        const argument = argv[index];
        if (!argument.startsWith('--')) continue;
        const equal = argument.indexOf('=');
        const key = argument.slice(2, equal === -1 ? undefined : equal);
        const value = equal === -1
            ? (argv[index + 1]?.startsWith('--') ? true : (argv[++index] ?? true))
            : argument.slice(equal + 1);
        if (key === 'case') values.cases.push(String(value));
        else values[key] = value;
    }
    return values;
};

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const fileDigest = filePath => sha256(fs.readFileSync(filePath));

const loadDotEnv = () => {
    const envPath = path.join(CHAT_ROOT, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        const value = match[2].replace(/^("|')|("|')$/g, '');
        process.env[match[1]] = value;
    }
};

const loadLiveAdapter = async () => {
    const esbuild = require('esbuild');
    process.env.HAPPYTOHELP_CHAT_ROOT = CHAT_ROOT;
    const result = await esbuild.build({
        entryPoints: [path.join(CHAT_ROOT, 'scripts', 'eval', 'live-adapter.js')],
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'node22',
        packages: 'external',
        write: false,
        logLevel: 'silent',
    });
    const output = result.outputFiles?.[0]?.text;
    if (!output) throw new Error('Unable to bundle live evaluation adapter.');
    const compiled = new Module('happytohelp-live-evaluation-adapter.cjs', module.parent);
    compiled.filename = path.join(CHAT_ROOT, '.cache', 'happytohelp-live-evaluation-adapter.cjs');
    compiled.paths = Module._nodeModulePaths(CHAT_ROOT);
    compiled._compile(output, compiled.filename);
    if (typeof compiled.exports.runVariant !== 'function') {
        throw new Error('Live adapter does not export runVariant.');
    }
    return compiled.exports;
};

const planRuns = ({ fixture, args }) => {
    const requestedCases = args.cases.length > 0
        ? fixture.cases.filter(item => args.cases.includes(item.id))
        : fixture.cases;
    if (requestedCases.length === 0) throw new Error('No requested evaluation cases were found in the fixture.');
    const caseLimit = parsePositiveInteger(args['limit-cases'], requestedCases.length);
    const cases = requestedCases.slice(0, caseLimit);
    const requestedVariants = String(args.variants || 'baseline,prototype').split(',').map(value => value.trim()).filter(Boolean);
    const variants = new Set(requestedVariants);
    const models = String(args.models || DEFAULT_PROTOTYPE_MODELS.join(',')).split(',').map(value => value.trim()).filter(Boolean);
    const baselineModel = String(args['baseline-model'] || 'gpt-5.5');
    const planned = [];
    for (const caseDefinition of cases) {
        if (variants.has('baseline')) planned.push({ variant: 'baseline', model: baselineModel, caseDefinition });
        if (variants.has('legacy-ui')) planned.push({ variant: 'legacy-ui', model: baselineModel, caseDefinition });
        if (variants.has('prototype')) {
            for (const model of models) planned.push({ variant: 'prototype', model, caseDefinition });
        }
    }
    return planned;
};

const writeJsonLine = (filePath, value) => fs.appendFileSync(filePath, JSON.stringify(value) + '\n');

const knownCost = record => typeof record?.usage?.cost === 'number' && Number.isFinite(record.usage.cost);

const defaultOutputPath = (timestamp = Date.now()) => path.join(
    os.tmpdir(),
    'happytohelp-eval',
    `suggestions-${timestamp}.jsonl`,
);

const runPool = async ({ planned, concurrency, run }) => {
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, planned.length) }, async () => {
        while (true) {
            const current = next++;
            if (current >= planned.length) return;
            await run(planned[current]);
        }
    });
    await Promise.all(workers);
};

const promptDigests = () => ({
    baseline_commit_request: fileDigest(path.join(CHAT_ROOT, 'scripts/eval/fixtures/baseline/src/llm/prompt/request.js')),
    prototype_prompt: fileDigest(path.join(CHAT_ROOT, 'src/modules/ai-support/assist/prompt.js')),
    prototype_schema: fileDigest(path.join(CHAT_ROOT, 'src/modules/ai-support/assist/schema.js')),
});

const runLive = async ({ fixture, fixtureDigest, args, planned }) => {
    loadDotEnv();
    if (args['db-host']) process.env.DB_HOST = String(args['db-host']);
    if (args['project-id']) process.env.SUGGESTIONS_EVAL_PROJECT_ID = String(args['project-id']);
    let adapter;
    try {
        adapter = await loadLiveAdapter();
        const startedAt = new Date().toISOString();
        const outputPath = path.resolve(String(args.output || defaultOutputPath()));
        const evaluationRunId = String(args['run-id'] || path.basename(outputPath, path.extname(outputPath)));
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        const manifest = {
            kind: 'happytohelp-suggestion-evaluation-manifest',
            result_schema_version: 'happytohelp.suggestion-evaluation.v2',
            evaluation_run_id: evaluationRunId,
            started_at: startedAt,
            fixture_schema: fixture.schema_version,
            fixture_digest: fixtureDigest,
            prompt_digests: promptDigests(),
            planned_runs: planned.length,
            baseline_trace_instrumentation: 'Evaluation bundle forwards options.trace and observes optimized request messages in frozen agentSuggestions only; its frozen prompt, schema, and raw context are unchanged.',
            image_input_instrumentation: {
                prototype: 'Derived from provider-eligible attachments in the assist packet.',
                legacy: 'Observed from optimized frozen-request messages immediately before runStream; records URL metadata and digest, never the URL itself.',
            },
            cost_scope: 'Known cost is limited to traced outer generation rounds. Automatic Ensemble tool-result summary subrequests are separately marked as unmetered when observed.',
            db_usage_logging: 'actual provider calls are recorded by the application only in the guarded synthetic project; no fake usage is seeded',
        };
        writeJsonLine(outputPath, manifest);

        const timeoutMs = parsePositiveInteger(args['timeout-ms'], 90000);
        const concurrency = parsePositiveInteger(args.concurrency, 4);
        const records = [];
        await runPool({
            planned,
            concurrency,
            run: async ({ variant, model, caseDefinition }) => {
                const result = await adapter.runVariant({
                    variant,
                    model,
                    caseDefinition,
                    timeoutMs,
                });
                const checks = result.error
                    ? { passed: false, failures: [{ check: 'provider_error', actual: result.error.message }] }
                    : evaluateSuggestion(caseDefinition, result);
                const record = {
                    kind: 'happytohelp-suggestion-evaluation-run',
                    finished_at: new Date().toISOString(),
                    case_id: caseDefinition.id,
                    case_title: caseDefinition.title,
                    variant,
                    requested_model: model,
                    resolved_model: result.model,
                    context_digest: result.contextDigest,
                    usage: result.usage,
                    usage_rounds: result.usageRounds,
                    latency_ms: result.latencyMs,
                    first_token_ms: result.firstTokenMs,
                    tool_calls: result.toolCalls,
                    tool_summary_audit: auditToolSummaryPaths(result.toolCalls),
                    image_inputs: result.imageInputs,
                    image_input_instrumentation: result.imageInputInstrumentation,
                    output: result.output,
                    error: result.error,
                    checks,
                };
                records.push(record);
                writeJsonLine(outputPath, record);
            },
        });
        const summary = {
            kind: 'happytohelp-suggestion-evaluation-summary',
            finished_at: new Date().toISOString(),
            output_path: outputPath,
            total_runs: records.length,
            passed_checks: records.filter(record => record.checks.passed).length,
            provider_errors: records.filter(record => record.error).length,
            known_cost_runs: records.filter(knownCost).length,
            unknown_cost_runs: records.filter(record => !knownCost(record)).length,
            total_known_cost_usd: records.reduce((total, record) => (
                knownCost(record) ? total + record.usage.cost : total
            ), 0),
            harness_delta_runs: records.filter(record => record.checks.harness_failures?.length > 0).length,
            manual_review_flags: records.reduce((total, record) => total + (record.checks.manual_review_flags?.length || 0), 0),
            unmetered_tool_summary_paths: records.reduce((total, record) => total + (record.tool_summary_audit?.attempted_count || 0), 0),
        };
        writeJsonLine(outputPath, summary);
        return summary;
    } finally {
        await adapter?.close?.();
    }
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const loaded = loadFixture(args.fixture);
    const failures = validateFixture(loaded.value);
    if (failures.length) throw new Error('Fixture validation failed: ' + failures.join('; '));
    const planned = planRuns({ fixture: loaded.value, args });
    if (!args.live) {
        process.stdout.write(JSON.stringify({
            mode: 'dry-run',
            fixture: loaded.path,
            fixture_digest: loaded.digest,
            planned_runs: planned.length,
            variants: Array.from(new Set(planned.map(item => item.variant))),
            models: Array.from(new Set(planned.map(item => item.model))),
        }) + '\n');
        return;
    }
    const summary = await runLive({ fixture: loaded.value, fixtureDigest: loaded.digest, args, planned });
    process.stdout.write(JSON.stringify(summary) + '\n');
};

if (require.main === module) {
    main().catch(error => {
        console.error(error.stack || error.message || error);
        process.exit(1);
    });
}

module.exports = {
    DEFAULT_PROTOTYPE_MODELS,
    defaultOutputPath,
    parseArgs,
    planRuns,
};
