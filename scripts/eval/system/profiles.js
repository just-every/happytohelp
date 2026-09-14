'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function main() {
    const root = path.resolve(__dirname, '../../..');
    const output = process.argv[2];
    if (!output || fs.existsSync(output)) throw new Error('Choose a new output path; preserve earlier evidence.');
    const models = (process.argv[3] || 'gpt-5.4-nano,gpt-5.6-luna,gemini-3.5-flash-lite').split(',');
    const built = await build({ entryPoints: [path.join(__dirname, 'profile-adapter.js')], bundle: true,
        platform: 'node', format: 'cjs', packages: 'external', write: false, logLevel: 'silent' });
    const adapterModule = new Module(path.join(root, '.cache/profile-eval.cjs'), null);
    adapterModule.filename = path.join(root, '.cache/profile-eval.cjs');
    adapterModule.paths = Module._nodeModulePaths(root);
    adapterModule._compile(built.outputFiles[0].text, adapterModule.filename);
    const adapter = adapterModule.exports;
    const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'tests/eval-harness/fixtures/profile-execution.v2.json')));
    const jobs = models.flatMap(model => fixtures.map(fixture => ({ model, fixture })));
    // Include the incumbent optimization route on those two cases only.
    jobs.push(...fixtures.filter(f => f.type.startsWith('optimize')).map(fixture => ({ fixture, model: 'gpt-5.4-mini' })));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    let next = 0;
    try {
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (next < jobs.length) {
                const result = await adapter.run(jobs[next++]);
                fs.appendFileSync(output, JSON.stringify(result) + '\n');
                console.log(JSON.stringify({ case: result.case_id, model: result.model, valid: result.valid, error: result.error }));
            }
        }));
    } finally { await adapter.close(); }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
