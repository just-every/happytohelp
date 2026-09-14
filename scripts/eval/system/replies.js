'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
async function main() {
    const root = path.resolve(__dirname, '../../..');
    const output = process.argv[2] || '/tmp/h2h-system-review/replies-v1.jsonl';
    const models = (process.argv[3] || 'gpt-5.4,gpt-5.6-luna,deepseek-v4-flash,gemini-3.8-flash,gemini-3.5-flash-lite').split(',');
    const built = await build({ entryPoints: [path.resolve(__dirname, '../live-adapter.js')], bundle: true,
        platform: 'node', format: 'cjs', packages: 'external', write: false, logLevel: 'silent' });
    const module = new Module(path.join(root, '.cache/customer-eval.cjs'), null);
    module.filename = path.join(root, '.cache/customer-eval.cjs');
    module.paths = Module._nodeModulePaths(root);
    module._compile(built.outputFiles[0].text, module.filename);
    const adapter = module.exports;
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/training/fixtures/eval-cases.v1.json')));
    const cases = fixture.cases.filter(item => adapter.CUSTOMER_REPLY_EVALUATION_CASE_IDS.includes(item.id));
    const jobs = models.flatMap(model => cases.map(caseDefinition => ({ model, caseDefinition })));
    if (fs.existsSync(output)) throw new Error('Choose a new output path; preserve existing evaluation evidence.');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    let next = 0;
    try {
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (next < jobs.length) {
                const job = jobs[next++];
                const result = await adapter.runCustomerReplyVariant({ ...job, timeoutMs: 90000 });
                result.case_id = job.caseDefinition.id;
                fs.appendFileSync(output, JSON.stringify(result) + '\n');
                console.log(JSON.stringify({ model: job.model, case: job.caseDefinition.id, error: result.error, latencyMs: result.latencyMs }));
            }
        }));
    } finally { await adapter.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
