'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { extractResponseObjects } = require('./checks');
const { loadFixture } = require('./fixture');

const readJsonLines = inputPath => fs.readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
        try {
            return JSON.parse(line);
        } catch (error) {
            throw new Error(`Invalid JSONL at ${inputPath}:${index + 1}: ${error.message}`);
        }
    });

const fileDigest = inputPath => crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex');

const candidateOutput = output => {
    const source = output?.responses || output?.output?.responses || output?.result?.responses || [];
    return source.map((item, index) => ({
        reply_id: index + 1,
        title: typeof item?.title === 'string' ? item.title : (typeof item?.button === 'string' ? item.button : ''),
        icon: typeof item?.icon === 'string' ? item.icon : '',
        response: extractResponseObjects({ responses: [item] })[0]?.text || '',
    })).filter(item => item.response);
};

const scenarioForCase = (caseDefinition, index) => ({
    scenario_id: `scenario-${String(index + 1).padStart(2, '0')}`,
    customer_language: caseDefinition.contact?.language || 'en',
    transcript: (caseDefinition.messages || []).map(message => ({
        role: message.role,
        content: message.content,
    })),
    draft: caseDefinition.request?.draft || '',
    operator_goal: caseDefinition.request?.instructions || '',
    attachment_present: (caseDefinition.attachments || []).length > 0,
});

const candidateRank = (seed, record, recordIndex) => crypto.createHash('sha256')
    .update(`${seed}\u0000${record.case_id}\u0000${recordIndex}`)
    .digest('hex');

const isEvaluationRun = record => (
    record?.kind === 'happytohelp-suggestion-evaluation-run'
    || (typeof record?.case_id === 'string' && typeof record?.variant === 'string' && record?.output)
);

const createBlindReview = ({ records, fixture, seed = 'happytohelp-blind-review-v1' }) => {
    const caseIndex = new Map((fixture.cases || []).map((item, index) => [item.id, index]));
    const candidates = records
        .filter(record => isEvaluationRun(record) && !record.error && candidateOutput(record.output).length > 0)
        .map((record, recordIndex) => {
            const index = caseIndex.get(record.case_id);
            if (index === undefined) throw new Error(`Result references a case absent from the fixture: ${record.case_id}`);
            return {
                rank: candidateRank(seed, record, recordIndex),
                scenario: scenarioForCase(fixture.cases[index], index),
                responses: candidateOutput(record.output),
            };
        })
        .sort((left, right) => left.rank.localeCompare(right.rank))
        .map(({ scenario, responses }, index) => ({
            candidate_id: `candidate-${String(index + 1).padStart(4, '0')}`,
            scenario,
            responses,
        }));

    return {
        kind: 'happytohelp-suggestion-blind-review-v1',
        candidate_count: candidates.length,
        rubric: [
            'Score each candidate 1–5 for factual grounding, privacy, usefulness, clarity, and proportionate response length.',
            'Treat each suggested card as independently sendable. Flag any card that invents an action, contradicts another card, or exposes private/operator-only information.',
            'The candidate source model, implementation variant, usage, latency, deterministic checks, and internal evidence IDs are intentionally withheld.',
        ],
        candidates,
    };
};

const argValue = name => {
    const index = process.argv.indexOf(name);
    if (index !== -1) return String(process.argv[index + 1] || '').trim();
    const inline = process.argv.find(argument => argument.startsWith(name + '='));
    return inline ? inline.slice(name.length + 1).trim() : '';
};

const main = () => {
    const inputPath = argValue('--input');
    if (!inputPath) throw new Error('Pass --input=<evaluation JSONL>.');
    const absoluteInput = path.resolve(inputPath);
    const outputPath = path.resolve(argValue('--output') || absoluteInput.replace(/\.jsonl$/i, '.blind-review.json'));
    const { value: fixture } = loadFixture(argValue('--fixture') || undefined);
    const sourceDigest = fileDigest(absoluteInput);
    const review = createBlindReview({
        records: readJsonLines(absoluteInput),
        fixture,
        seed: argValue('--seed') || sourceDigest,
    });
    fs.writeFileSync(outputPath, JSON.stringify({
        source_result_digest: sourceDigest,
        ...review,
    }, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ output_path: outputPath, candidate_count: review.candidate_count }) + '\n');
};

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.stack || error.message || error);
        process.exit(1);
    }
}

module.exports = {
    candidateOutput,
    createBlindReview,
    isEvaluationRun,
    readJsonLines,
};
