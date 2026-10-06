// Validation for the evaluation-run form. It mirrors the limits enforced by POST /api/training/projects/:id/runs
// (src/modules/training-runs/routes.ts) so each problem is reported next to its field before anything is sent.
export const TRAINING_LIMITS = {maxCases: 10000, maxModels: 64, modelLength: 200, idLength: 200, caseLength: 100000, maxTokens: 32000};
export const RUN_KINDS = [{value: 'evaluation', label: 'Evaluation'}, {value: 'simulation', label: 'Simulation'}];
export const VARIANTS = ['prototype', 'baseline', 'legacy-ui'];
export const kindLabel = kind => RUN_KINDS.find(option => option.value === kind)?.label || kind;
const count = value => value.toLocaleString('en-US');
const blank = value => !String(value ?? '').trim();

/** Wording for a JSON syntax problem that never exposes the browser's parser message. */
function syntaxMessage(label, failure) {
    const where = /line (\d+) column (\d+)/.exec(String(failure?.message));
    return `${label} are not valid JSON${where ? ` (near line ${where[1]}, column ${where[2]})` : ''}. Check for a missing quote, comma or bracket.`;
}

export function parseModels(text) {
    const models = String(text ?? '').split('\n').map(line => line.trim()).filter(Boolean);
    if (!models.length) return {error: 'Enter at least one model, one per line.'};
    if (models.length > TRAINING_LIMITS.maxModels) return {error: `Use at most ${TRAINING_LIMITS.maxModels} models per run.`};
    if (models.some(model => model.length >= TRAINING_LIMITS.modelLength)) return {error: `Each model name must be shorter than ${TRAINING_LIMITS.modelLength} characters.`};
    return {value: models};
}

export function parseCases(text) {
    if (blank(text)) return {error: 'Add at least one case. Paste a list such as [{"id": "refund-status"}], with a unique text id on every case.'};
    let parsed;
    try { parsed = JSON.parse(text); } catch (failure) { return {error: syntaxMessage('Case definitions', failure)}; }
    if (!Array.isArray(parsed)) return {error: 'Case definitions must be a list of cases written between [ and ].'};
    if (!parsed.length) return {error: 'Add at least one case to the list.'};
    if (parsed.length > TRAINING_LIMITS.maxCases) return {error: `Use at most ${count(TRAINING_LIMITS.maxCases)} cases per run; split larger studies into separate runs.`};
    const seen = new Set();
    for (const [index, definition] of parsed.entries()) {
        if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return {error: `Case ${index + 1} must be an object with a text "id".`};
        if (typeof definition.id !== 'string' || blank(definition.id) || definition.id.length > TRAINING_LIMITS.idLength) return {error: `Case ${index + 1} needs a text "id" of up to ${TRAINING_LIMITS.idLength} characters.`};
        if (seen.has(definition.id)) return {error: `Case ids must be unique, but "${definition.id}" appears more than once.`};
        seen.add(definition.id);
        if (JSON.stringify(definition).length > TRAINING_LIMITS.caseLength) return {error: `Case "${definition.id}" is too large (the limit is ${count(TRAINING_LIMITS.caseLength)} characters).`};
    }
    return {value: parsed};
}

export function parseVariants(text) {
    if (blank(text)) return {value: undefined};
    let parsed;
    try { parsed = JSON.parse(text); } catch (failure) { return {error: syntaxMessage('Variants', failure)}; }
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every(variant => VARIANTS.includes(variant))) return {error: `Variants must be a list using only ${VARIANTS.map(variant => `"${variant}"`).join(', ')}, for example ["prototype", "baseline"]. Leave it empty to run the prototype only.`};
    return {value: [...new Set(parsed)]};
}

/** Returns `{errors}` keyed by field when anything is wrong, otherwise `{value}` ready to send. */
export function validateTrainingRun(draft) {
    const errors = {}, models = parseModels(draft.models), cases = parseCases(draft.cases), variants = parseVariants(draft.variants);
    if (models.error) errors.models = models.error;
    if (cases.error) errors.cases = cases.error;
    if (variants.error) errors.variants = variants.error;
    const cost = draft.max_cost === '' || draft.max_cost === undefined || draft.max_cost === null ? NaN : Number(draft.max_cost);
    if (!Number.isFinite(cost) || cost <= 0) errors.max_cost = 'Enter a maximum cost greater than 0 (a limit of 0 is not accepted, so a run always has a budget).';
    const tokens = draft.max_tokens === '' || draft.max_tokens === undefined || draft.max_tokens === null ? NaN : Number(draft.max_tokens);
    if (!Number.isInteger(tokens) || tokens < 1 || tokens > TRAINING_LIMITS.maxTokens) errors.max_tokens = `Enter a whole number of tokens from 1 to ${count(TRAINING_LIMITS.maxTokens)}.`;
    if (!RUN_KINDS.some(option => option.value === draft.kind)) errors.kind = 'Choose evaluation or simulation.';
    if (Object.keys(errors).length) return {errors};
    return {value: {kind: draft.kind, models: models.value, cases: cases.value, ...(variants.value ? {variants: variants.value} : {}), max_cost: cost, max_tokens: tokens}};
}
