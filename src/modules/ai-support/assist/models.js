
import { assistProvider } from './providerContract.js';

// Owner-selected prototype default after the 2026-09-07 sixteen-case comparison.
// Agent suggestions and draft edits can each be overridden through their env key.
const DEFAULT_ASSIST_MODEL = 'gpt-5.6-luna';

// Standard online text/image pricing, USD per million tokens; checked 2026-09-07.
// Keep the source and date with benchmark artifacts: provider bills remain authoritative.
const PRICING_SOURCES = {
    openai: 'https://developers.openai.com/api/docs/pricing',
    anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
    google: 'https://ai.google.dev/gemini-api/docs/pricing',
    xai: 'https://docs.x.ai/developers/models',
};
const model = (id, provider, input, cached, output, write = input, extra = {}) => ({
    id, provider, rates: { input, cached, output, write, write1h: input * 2 }, ...extra,
});
const ASSIST_EVALUATION_MODELS = [
    model('gpt-5.5', 'openai', 5, 0.5, 30, 5, { long: { threshold: 272000, input: 10, cached: 1, output: 45 } }),
    model('gpt-6-astra', 'openai', 10, 1, 50, 12.5, { long: { threshold: 272000, input: 20, cached: 2, output: 75, write: 25 } }),
    model('gpt-5.6-sol', 'openai', 4, 0.4, 20, 5, { long: { threshold: 272000, input: 8, cached: 0.8, output: 30, write: 10 } }),
    model('gpt-5.6-terra', 'openai', 2, 0.2, 12, 2.5, { long: { threshold: 272000, input: 4, cached: 0.4, output: 18, write: 5 } }),
    model('gpt-5.6-luna', 'openai', 0.2, 0.02, 1.2, 0.25, { long: { threshold: 272000, input: 0.4, cached: 0.04, output: 1.8, write: 0.5 } }),
    model('claude-fable-5-1', 'anthropic', 10, 0.25, 50, 12.5),
    model('claude-opus-5', 'anthropic', 5, 0.5, 25, 6.25),
    model('claude-sonnet-5', 'anthropic', 2, 0.2, 10, 2.5),
    model('claude-haiku-4-5-20251001', 'anthropic', 1, 0.1, 5, 1.25),
    model('gemini-3.8-flash', 'google', 0.75, 0.075, 3.75),
    model('gemini-3.5-flash-lite', 'google', 0.3, 0.03, 2.5),
    model('gemini-3.1-pro-preview', 'google', 2, 0.2, 12, 2, { long: { threshold: 200000, input: 4, cached: 0.4, output: 18 } }),
    model('grok-4.6', 'xai', 2, 2, 6),
];

const getAssistModelSettings = id => {
    if (id.startsWith('gemini-')) return { max_tokens: 12000, thinking_level: id.includes('pro') ? 'HIGH' : 'MEDIUM' };
    if (id.startsWith('claude-haiku')) return { max_tokens: 12000, thinking_budget: 4096 };
    if (id.startsWith('claude-')) return { max_tokens: 12000, thinking_budget: 8192 };
    // Ensemble maps 12,288 to medium reasoning effort for OpenAI.
    return { max_tokens: 12000, thinking_budget: 12288 };
};

const calculateAssistCost = (id, usage) => {
    const entry = ASSIST_EVALUATION_MODELS.find(item => item.id === id);
    if (!entry) return null;
    const input = usage.input_tokens || 0;
    const cached = usage.cached_tokens || 0;
    const write = usage.cache_write_tokens || 0;
    const write1h = usage.cache_write_1h_tokens || 0;
    if (cached + write + write1h > input) throw new Error('Cached input components exceed total input tokens.');
    const rates = entry.long && input > entry.long.threshold ? { ...entry.rates, ...entry.long } : entry.rates;
    return ((input - cached - write - write1h) * rates.input + cached * rates.cached + write * rates.write + write1h * rates.write1h + (usage.output_tokens || 0) * rates.output) / 1e6;
};

const registerAssistModel = (ensemble, id) => {
    const entry = ASSIST_EVALUATION_MODELS.find(item => item.id === id);
    if (!entry || !ensemble.registerExternalModel || !ensemble.getModelProvider) return;
    const provider = ensemble.getModelProvider(id);
    const rate = key => entry.long?.[key] === undefined ? entry.rates[key] : {
        threshold_tokens: entry.long.threshold, tier_basis: 'input_tokens',
        price_below_threshold_per_million: entry.rates[key], price_above_threshold_per_million: entry.long[key],
    };
    ensemble.registerExternalModel({
        id, name: id, provider: ensemble.getProviderFromModel(id), class: 'reasoning',
        cost: { input_per_million: rate('input'), cached_input_per_million: rate('cached'), output_per_million: rate('output'), cache_write_input_per_million: rate('write'), cache_write_1h_input_per_million: rate('write1h') },
        features: { context_length: entry.id.includes('haiku') ? 200000 : 1000000, max_output_tokens: 128000, input_modality: ['text', 'image'], output_modality: ['text'], tool_use: true, streaming: true, json_output: true },
    }, assistProvider(provider));
};

export { DEFAULT_ASSIST_MODEL, ASSIST_EVALUATION_MODELS, PRICING_SOURCES, getAssistModelSettings, calculateAssistCost, registerAssistModel };
