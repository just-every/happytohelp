const CURRENT_FLASH_ALIASES = new Set(['gemini-flash-latest', 'gemini-flash-lite-latest']);
function normalizeModelId(model) {
    return model.startsWith('models/') ? model.slice('models/'.length) : model;
}
export function usesCurrentGeminiGenerateContentContract(model) {
    const modelId = normalizeModelId(model);
    return (['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'].includes(modelId) ||
        modelId === 'gemini-3.5-flash-lite' ||
        CURRENT_FLASH_ALIASES.has(modelId));
}
