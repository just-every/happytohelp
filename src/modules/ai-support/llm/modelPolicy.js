import { DEFAULT_ASSIST_MODEL } from '../assist/models.js';
import { workerRuntime } from '../vendor/ensemble/worker-runtime.js';
const DEFAULT_MAX_RETRIES = 0;



const TASKS = {
    USER_REPLY: 'user_reply',
    INSIGHT: 'insight',
    AGENT_REPLY: 'agent_reply',
    AGENT_SUGGESTIONS: 'agent_suggestions',
    SUMMARY: 'summary',
    PROFILE: 'profile',
    ANALYSIS: 'analysis',
    OPTIMIZE: 'optimize',
};

const TASK_MODEL_DEFAULTS = {
    [TASKS.USER_REPLY]: 'gpt-5.6-luna',
    [TASKS.INSIGHT]: 'gpt-5.6-luna',
    [TASKS.AGENT_REPLY]: DEFAULT_ASSIST_MODEL,
    [TASKS.AGENT_SUGGESTIONS]: DEFAULT_ASSIST_MODEL,
    [TASKS.SUMMARY]: 'gpt-5.4-nano',
    [TASKS.PROFILE]: 'gpt-5.6-luna',
    [TASKS.ANALYSIS]: 'gemini-3.5-flash-lite',
    [TASKS.OPTIMIZE]: 'gpt-5.6-luna',
};

const TASK_MODEL_ENV_KEYS = {
    [TASKS.USER_REPLY]: 'ENSEMBLE_MODEL_USER_REPLY',
    [TASKS.INSIGHT]: 'ENSEMBLE_MODEL_INSIGHT',
    [TASKS.AGENT_REPLY]: 'ENSEMBLE_MODEL_AGENT_REPLY',
    [TASKS.AGENT_SUGGESTIONS]: 'ENSEMBLE_MODEL_AGENT_SUGGESTIONS',
    [TASKS.SUMMARY]: 'ENSEMBLE_MODEL_SUMMARY',
    [TASKS.PROFILE]: 'ENSEMBLE_MODEL_PROFILE',
    [TASKS.ANALYSIS]: 'ENSEMBLE_MODEL_ANALYSIS',
    [TASKS.OPTIMIZE]: 'ENSEMBLE_MODEL_OPTIMIZE',
};

const envModel = (envKey, defaultModel) => {
    const value = String(workerRuntime().settings?.[envKey] || '').trim();
    return value || defaultModel;
};

const modelForTask = (task, options) => {
    if (typeof options?.model === 'string' && options.model.trim()) {
        return options.model.trim();
    }

    const defaultModel = TASK_MODEL_DEFAULTS[task] || envModel('ENSEMBLE_MODEL_DEFAULT', 'gpt-5.4-nano');
    const envKey = TASK_MODEL_ENV_KEYS[task] || 'ENSEMBLE_MODEL_DEFAULT';
    return envModel(envKey, defaultModel);
};

const modelLabelForTask = (task) => {
    switch (task) {
        case TASKS.USER_REPLY:
            return 'user reply';
        case TASKS.INSIGHT:
            return 'insight';
        case TASKS.AGENT_REPLY:
            return 'agent reply';
        case TASKS.AGENT_SUGGESTIONS:
            return 'agent suggestions';
        case TASKS.SUMMARY:
            return 'summary';
        case TASKS.PROFILE:
            return 'profile';
        case TASKS.ANALYSIS:
            return 'analysis';
        case TASKS.OPTIMIZE:
            return 'optimize';
        default:
            return 'default';
    }
};


export { TASKS, DEFAULT_MAX_RETRIES, modelForTask, modelLabelForTask };
