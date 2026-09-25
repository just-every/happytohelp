'use strict';

const fs = require('node:fs');
const path = require('node:path');

const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const summarize = file => {
    const rows = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    const groups = new Map();
    for (const row of rows) {
        const key = [row.model, row.insight_model || row.model].join('/');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    return [...groups.values()].map(group => {
        const usage = group.flatMap(row => Array.isArray(row.usage) ? row.usage : [row.usage]).filter(Boolean);
        const unknown = usage.some(record => record.cost_unknown || record.cost === null);
        const cost = usage.reduce((sum, record) => sum + (record.cost || 0), 0);
        return {
            artifact: path.basename(file),
            model: group[0].model,
            insight_model: group[0].insight_model || null,
            attempts: group.length,
            completed: group.filter(row => !row.error).length,
            automated_passes: group.every(row => typeof row.passed === 'boolean')
                ? group.filter(row => row.passed).length : null,
            // Completion is not a semantic quality grade. Review the replies separately.
            usd_recorded: cost,
            has_unknown_cost: unknown,
            usd_per_1000_attempts: unknown ? null : cost * 1000 / group.length,
            median_latency_ms: median(group.map(row => row.latency_ms ?? row.latencyMs)),
            input_tokens: usage.reduce((sum, record) => sum + record.input_tokens, 0),
            output_tokens: usage.reduce((sum, record) => sum + record.output_tokens, 0),
            cached_input_tokens: usage.reduce((sum, record) => sum + record.cached_tokens, 0),
            errors: group.filter(row => row.error).map(row => ({ case_id: row.case_id, error: row.error })),
        };
    });
};

if (require.main === module) {
    if (!process.argv[2]) throw new Error('Provide one or more JSONL evaluation artifacts.');
    process.stdout.write(JSON.stringify(process.argv.slice(2).flatMap(summarize), null, 2) + '\n');
}

module.exports = { summarize };
