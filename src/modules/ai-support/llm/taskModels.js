

import { registerAssistModel, calculateAssistCost } from '../assist/models.js';

const LEGACY_RATES = {
    'gpt-5.4': [2.5, 0.25, 15],
    'gpt-5.4-mini': [0.75, 0.075, 4.5],
    'gpt-5.4-nano': [0.2, 0.02, 1.25],
};

// Settings are explicit: provider defaults often enable expensive reasoning.
const taskModelSettings = (model, task) => {
    const background = ['analysis', 'summary', 'profile'].includes(task);
    const max_tokens = background ? 3000 : 6000;
    if (model.startsWith('gemini-')) return { max_tokens, thinking_level: 'LOW' };
    if (model.startsWith('deepseek-')) return { max_tokens, thinking_budget: background ? 0 : 2048 };
    if (/^gpt-/.test(model)) return { max_tokens, thinking_budget: task === 'analysis' && model === 'gpt-5.6-luna' ? 4096 : background ? 0 : 4096 };
    return { max_tokens };
};

const isDeepSeekPeak = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid pricing timestamp.');
    const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
    return date.getUTCDay() >= 1 && date.getUTCDay() <= 5 &&
        ((minute >= 60 && minute < 240) || (minute >= 360 && minute < 600));
};

// USD / million tokens; checked 2026-09-08 against provider pricing pages.
// Persist request timestamps so DeepSeek's two weekday peak windows are reproducible.
const calculateTaskCost = (model, usage, timestamp) => {
    const assistCost = calculateAssistCost(model, usage);
    if (assistCost !== null) return assistCost;
    let rates = LEGACY_RATES[model];
    if (model === 'deepseek-v4-flash') rates = isDeepSeekPeak(timestamp) ? [0.44, 0.014, 1.32] : [0.22, 0.007, 0.66];
    if (model === 'deepseek-v4-pro') rates = isDeepSeekPeak(timestamp) ? [1.32, 0.044, 3.96] : [0.66, 0.022, 1.98];
    if (!rates) return null;
    const input = usage.input_tokens || 0;
    const cached = usage.cached_tokens || 0;
    if (cached > input) throw new Error('Cached input exceeds total input.');
    if (usage.cache_write_tokens || usage.cache_write_1h_tokens) throw new Error('Unexpected cache-write usage for model.');
    if (model === 'gpt-5.4' && input > 272000) rates = [5, 0.5, 22.5];
    return ((input - cached) * rates[0] + cached * rates[1] + (usage.output_tokens || 0) * rates[2]) / 1e6;
};

export { taskModelSettings, calculateTaskCost, registerAssistModel as registerTaskModel, isDeepSeekPeak };
