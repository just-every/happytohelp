import { findModel } from '../data/model_data.js';
let emitEventFunction = null;
let hasEventHandlerFunction = null;
export function setEventControllerFunctions(emitFn, hasFn) {
    emitEventFunction = emitFn;
    hasEventHandlerFunction = hasFn;
}
class CostTracker {
    entries = [];
    started = new Date();
    onAddUsageCallbacks = [];
    calculateCost(usage) {
        if (typeof usage.cost === 'number') {
            return usage;
        }
        if (usage.isFreeTierUsage) {
            usage.cost = 0;
            return usage;
        }
        const model = findModel(usage.model);
        if (!model) {
            console.error(`Model not found when recording usage: ${usage.model}`);
            throw new Error(`Model not found when recording usage: ${usage.model}`);
        }
        if (usage.cost !== undefined && usage.cost !== null && usage.cost > 0) {
            return usage;
        }
        usage.cost = 0;
        const original_input_tokens = usage.input_tokens || 0;
        const output_tokens = usage.output_tokens || 0;
        const cached_tokens = usage.cached_tokens || 0;
        const cache_write_tokens = usage.cache_write_tokens || 0;
        const cache_write_1h_tokens = usage.cache_write_1h_tokens || 0;
        const image_count = usage.image_count || 0;
        const video_seconds = usage.video_seconds || 0;
        const inputComponentTokens = cached_tokens + cache_write_tokens + cache_write_1h_tokens;
        if (inputComponentTokens > original_input_tokens) {
            throw new Error(`Input token components (${inputComponentTokens}) exceed total input tokens (${original_input_tokens}) for ${usage.model}`);
        }
        const calculationTime = usage.timestamp || new Date();
        const hasTimeBasedPricing = (costStructure) => {
            if (!costStructure || typeof costStructure !== 'object')
                return false;
            if ('peak_price_per_million' in costStructure)
                return true;
            if ('text' in costStructure ||
                'audio' in costStructure ||
                'video' in costStructure ||
                'image' in costStructure) {
                const modalityPrice = costStructure;
                return ['text', 'audio', 'video', 'image'].some(modality => hasTimeBasedPricing(modalityPrice[modality]));
            }
            return false;
        };
        const usesTimeBasedPricing = hasTimeBasedPricing(model.cost?.input_per_million) ||
            hasTimeBasedPricing(model.cost?.output_per_million) ||
            hasTimeBasedPricing(model.cost?.cached_input_per_million) ||
            hasTimeBasedPricing(model.cost?.cache_write_input_per_million) ||
            hasTimeBasedPricing(model.cost?.cache_write_1h_input_per_million);
        if (!usage.timestamp && usesTimeBasedPricing) {
        }
        const getPrice = (tokensForTierCheck, costStructure, modality) => {
            if (typeof costStructure === 'number') {
                return costStructure;
            }
            if (typeof costStructure === 'object' && costStructure !== null) {
                if ('text' in costStructure ||
                    'audio' in costStructure ||
                    'video' in costStructure ||
                    'image' in costStructure) {
                    const modalityPrice = costStructure;
                    const selectedModality = modality || 'text';
                    const modalityCost = modalityPrice[selectedModality];
                    if (modalityCost !== undefined) {
                        return getPrice(tokensForTierCheck, modalityCost);
                    }
                    return getPrice(tokensForTierCheck, modalityPrice.text || 0);
                }
                if ('peak_price_per_million' in costStructure) {
                    const timeBasedCost = costStructure;
                    const currentTimeInMinutes = calculationTime.getUTCHours() * 60 + calculationTime.getUTCMinutes();
                    const utcDay = calculationTime.getUTCDay();
                    const isoWeekday = utcDay === 0 ? 7 : utcDay;
                    const isPeakDay = !timeBasedCost.peak_days || timeBasedCost.peak_days.includes(isoWeekday);
                    const isPeakWindow = timeBasedCost.peak_windows_utc.some(([peakStartInMinutes, peakEndInMinutes]) => peakStartInMinutes <= peakEndInMinutes
                        ? currentTimeInMinutes >= peakStartInMinutes && currentTimeInMinutes < peakEndInMinutes
                        : currentTimeInMinutes >= peakStartInMinutes || currentTimeInMinutes < peakEndInMinutes);
                    const isPeakTime = isPeakDay && isPeakWindow;
                    return isPeakTime ? timeBasedCost.peak_price_per_million : timeBasedCost.off_peak_price_per_million;
                }
                else if ('threshold_tokens' in costStructure) {
                    const tieredCost = costStructure;
                    const tierBasisTokens = tieredCost.tier_basis === 'input_tokens' ? original_input_tokens : tokensForTierCheck;
                    if (tierBasisTokens <= tieredCost.threshold_tokens) {
                        return tieredCost.price_below_threshold_per_million;
                    }
                    else {
                        return tieredCost.price_above_threshold_per_million;
                    }
                }
            }
            return 0;
        };
        const actualCachedTokens = cached_tokens > 0 && model.cost?.cached_input_per_million !== undefined ? cached_tokens : 0;
        const usesOpenAICacheWriteRate = model.provider === 'openai' && model.cost?.input_per_million !== undefined;
        if (cache_write_tokens > 0 &&
            model.cost?.cache_write_input_per_million === undefined &&
            !usesOpenAICacheWriteRate) {
            throw new Error(`Cache-write pricing is missing for ${usage.model}`);
        }
        if (cache_write_1h_tokens > 0 && model.cost?.cache_write_1h_input_per_million === undefined) {
            throw new Error(`1-hour cache-write pricing is missing for ${usage.model}`);
        }
        const nonCachedInputTokens = original_input_tokens - actualCachedTokens - cache_write_tokens - cache_write_1h_tokens;
        if (nonCachedInputTokens > 0 && model.cost?.input_per_million !== undefined) {
            const inputPricePerMillion = getPrice(original_input_tokens, model.cost.input_per_million, usage.input_modality);
            usage.cost += (nonCachedInputTokens / 1000000) * inputPricePerMillion;
        }
        if (actualCachedTokens > 0 && model.cost?.cached_input_per_million !== undefined) {
            const cachedPricePerMillion = getPrice(actualCachedTokens, model.cost.cached_input_per_million, usage.input_modality);
            usage.cost += (actualCachedTokens / 1000000) * cachedPricePerMillion;
        }
        if (cache_write_tokens > 0) {
            const cacheWritePricePerMillion = model.cost?.cache_write_input_per_million !== undefined
                ? getPrice(cache_write_tokens, model.cost.cache_write_input_per_million, usage.input_modality)
                : getPrice(original_input_tokens, model.cost?.input_per_million, usage.input_modality) * 1.25;
            usage.cost += (cache_write_tokens / 1000000) * cacheWritePricePerMillion;
        }
        if (cache_write_1h_tokens > 0 && model.cost?.cache_write_1h_input_per_million !== undefined) {
            const cacheWrite1hPricePerMillion = getPrice(cache_write_1h_tokens, model.cost.cache_write_1h_input_per_million, usage.input_modality);
            usage.cost += (cache_write_1h_tokens / 1000000) * cacheWrite1hPricePerMillion;
        }
        if (output_tokens > 0 && model.cost?.output_per_million !== undefined) {
            const outputPricePerMillion = getPrice(output_tokens, model.cost.output_per_million, usage.output_modality);
            usage.cost += (output_tokens / 1000000) * outputPricePerMillion;
        }
        const perImageOverride = usage.metadata && typeof usage.metadata.cost_per_image === 'number'
            ? usage.metadata.cost_per_image
            : undefined;
        const perImageCost = typeof perImageOverride === 'number'
            ? perImageOverride
            : typeof model.cost?.per_image === 'number'
                ? model.cost.per_image
                : undefined;
        if (image_count > 0 && typeof perImageCost === 'number') {
            usage.cost += image_count * perImageCost;
        }
        const perSecondOverride = usage.metadata && typeof usage.metadata.cost_per_second === 'number'
            ? usage.metadata.cost_per_second
            : undefined;
        const perSecondCost = typeof perSecondOverride === 'number'
            ? perSecondOverride
            : typeof model.cost?.per_second === 'number'
                ? model.cost.per_second
                : undefined;
        if (video_seconds > 0 && typeof perSecondCost === 'number') {
            usage.cost += video_seconds * perSecondCost;
        }
        usage.cost = Math.max(0, usage.cost);
        return usage;
    }
    onAddUsage(callback) {
        this.onAddUsageCallbacks.push(callback);
    }
    offAddUsage(callback) {
        this.onAddUsageCallbacks = this.onAddUsageCallbacks.filter(cb => cb !== callback);
    }
    addUsage(usage) {
        try {
            usage = this.calculateCost({ ...usage });
            usage.timestamp = new Date();
            this.entries.push(usage);
            if (hasEventHandlerFunction && hasEventHandlerFunction()) {
                const costUpdateEvent = {
                    type: 'cost_update',
                    usage: {
                        ...usage,
                        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
                    },
                    timestamp: new Date().toISOString(),
                };
                if (emitEventFunction) {
                    emitEventFunction(costUpdateEvent).catch(error => {
                        console.error('Error emitting cost_update event:', error);
                    });
                }
            }
            for (const callback of this.onAddUsageCallbacks) {
                try {
                    callback(usage);
                }
                catch (error) {
                    console.error('Error in cost tracker callback:', error);
                }
            }
            return usage;
        }
        catch (err) {
            console.error('Error recording usage:', err);
            return usage;
        }
    }
    getTotalCost() {
        return this.entries.reduce((sum, entry) => sum + (entry.cost || 0), 0);
    }
    getCostsByModel() {
        const models = {};
        for (const entry of this.entries) {
            if (!models[entry.model]) {
                models[entry.model] = {
                    cost: 0,
                    calls: 0,
                };
            }
            models[entry.model].cost += entry.cost || 0;
            models[entry.model].calls += 1;
        }
        return models;
    }
    printSummary() {
        if (!this.entries.length) {
            return;
        }
        const totalCost = this.getTotalCost();
        const costsByModel = this.getCostsByModel();
        const runtime = Math.round((new Date().getTime() - this.started.getTime()) / 1000);
        console.log('\n\nCOST SUMMARY');
        console.log(`Runtime: ${runtime} seconds`);
        console.log(`Total API Cost: $${totalCost.toFixed(6)}`);
        console.log('\nModels:');
        for (const [model, modelData] of Object.entries(costsByModel)) {
            console.log(`\t${model}:\t$${modelData.cost.toFixed(6)} (${modelData.calls} calls)`);
        }
        this.reset();
    }
    getCostInTimeWindow(seconds) {
        const cutoffTime = new Date(Date.now() - seconds * 1000);
        return this.entries
            .filter(entry => entry.timestamp && entry.timestamp >= cutoffTime)
            .reduce((sum, entry) => sum + (entry.cost || 0), 0);
    }
    getCostRate(windowSeconds = 60) {
        const costInWindow = this.getCostInTimeWindow(windowSeconds);
        return (costInWindow / windowSeconds) * 60;
    }
    getUsageInTimeWindow(seconds) {
        const cutoffTime = new Date(Date.now() - seconds * 1000);
        return this.entries.filter(entry => entry.timestamp && entry.timestamp >= cutoffTime);
    }
    getCostsByModelInTimeWindow(seconds) {
        const models = {};
        const entriesInWindow = this.getUsageInTimeWindow(seconds);
        for (const entry of entriesInWindow) {
            if (!models[entry.model]) {
                models[entry.model] = {
                    cost: 0,
                    calls: 0,
                };
            }
            models[entry.model].cost += entry.cost || 0;
            models[entry.model].calls += 1;
        }
        return models;
    }
    reset() {
        this.entries = [];
        this.started = new Date();
    }
    static estimateTokens(text) {
        if (!text)
            return 0;
        return Math.ceil(text.length / 4);
    }
    addEstimatedUsage(model, inputText, outputText, metadata) {
        const usage = {
            model,
            input_tokens: CostTracker.estimateTokens(inputText),
            output_tokens: CostTracker.estimateTokens(outputText),
            metadata: {
                ...metadata,
                estimated: true,
            },
        };
        return this.addUsage(usage);
    }
}
const globalObj = globalThis;
if (!globalObj.__ENSEMBLE_COST_TRACKER__) {
    globalObj.__ENSEMBLE_COST_TRACKER__ = new CostTracker();
}
export const costTracker = globalObj.__ENSEMBLE_COST_TRACKER__;
export { CostTracker };
