const externalModels = new Map();
const externalProviders = new Map();
const modelClassOverrides = new Map();
export function registerExternalModel(model, provider) {
    const modelId = model.id;
    const modelWithDefaults = {
        ...model,
        cost: model.cost || {
            input_per_million: 0,
            output_per_million: 0,
        },
        features: model.features || {
            context_length: 1000000,
            tool_use: true,
            streaming: true,
            json_output: true,
            input_modality: ['text', 'image', 'audio', 'video'],
            output_modality: ['text'],
            max_output_tokens: 100000,
        },
    };
    externalModels.set(modelId, modelWithDefaults);
    externalProviders.set(model.provider, provider);
    console.log(`[Ensemble] Registered external model: ${modelId} with provider: ${model.provider}`);
}
export function getExternalModel(modelId) {
    const directModel = externalModels.get(modelId);
    if (directModel)
        return directModel;
    for (const model of externalModels.values()) {
        if (model.aliases?.includes(modelId)) {
            return model;
        }
    }
    return undefined;
}
export function getExternalProvider(providerId) {
    return externalProviders.get(providerId);
}
export function isExternalModel(modelId) {
    return getExternalModel(modelId) !== undefined;
}
export function clearExternalRegistrations() {
    externalModels.clear();
    externalProviders.clear();
    modelClassOverrides.clear();
}
export function overrideModelClass(className, modelClass) {
    modelClassOverrides.set(className, modelClass);
    console.log(`[Ensemble] Overrode model class: ${className} with models: ${modelClass.models?.join(', ')}`);
}
export function getModelClassOverride(className) {
    return modelClassOverrides.get(className);
}
