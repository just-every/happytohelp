'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function main() {
    const root = path.resolve(__dirname, '../../..');
    const output = path.resolve(process.argv[2] || '/tmp/h2h-system-review/monitoring.jsonl');
    const models = (process.argv[3] || 'gpt-5.4-nano,gpt-5.6-luna,deepseek-v4-flash,gemini-3.8-flash,gemini-3.5-flash-lite').split(',');
    const insightModel = process.argv[4];
    const { monitoringEvalCases } = require('./monitoring-cases');
    const built = await build({ entryPoints: [path.join(__dirname, 'adapter.js')], bundle: true,
        platform: 'node', format: 'cjs', packages: 'external', write: false, logLevel: 'silent' });
    const module = new Module(path.join(root, '.cache/system-eval.cjs'), null);
    module.filename = path.join(root, '.cache/system-eval.cjs');
    module.paths = Module._nodeModulePaths(root);
    module._compile(built.outputFiles[0].text, module.filename);
    const adapter = module.exports;
    const jobs = models.flatMap(model => monitoringEvalCases.map(fixture => ({ model, insightModel, caseId: fixture.id })));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (fs.existsSync(output)) throw new Error('Choose a new output path; existing evaluation evidence is immutable.');
    let next = 0;
    try {
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (next < jobs.length) {
                const job = jobs[next++];
                const started = Date.now();
                const result = await adapter.runMonitoring(job);
                result.latency_ms = Date.now() - started;
                fs.appendFileSync(output, JSON.stringify(result) + '\n');
                console.log(JSON.stringify({ model: result.model, case: result.case_id, passed: result.passed, error: result.error }));
            }
        }));
    } finally { await adapter.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
