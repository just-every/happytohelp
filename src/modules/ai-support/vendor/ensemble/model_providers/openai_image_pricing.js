import { findModel } from '../data/model_data.js';
const GPT_IMAGE_2_COSTS = {
    low: { square: 0.00588, large: 0.00474 },
    medium: { square: 0.05268, large: 0.04116 },
    high: { square: 0.21072, large: 0.16464 },
};
const GPT_IMAGE_2_OUTPUT_PRICE_PER_MILLION = 30;
const GPT_IMAGE_2_LARGE_PIXELS = 1536 * 1024;
const GPT_IMAGE_2_MIN_PIXELS = 655_360;
const GPT_IMAGE_2_MAX_PIXELS = 8_294_400;
const GPT_IMAGE_2_MAX_ASPECT_RATIO = 3;
const GPT_IMAGE_2_SIZE_MULTIPLE = 16;
const GPT_IMAGE_15_COSTS = {
    low: { square: 0.009, large: 0.013 },
    medium: { square: 0.034, large: 0.05 },
    high: { square: 0.133, large: 0.2 },
};
const GPT_IMAGE_1_COSTS = {
    low: { square: 0.007, large: 0.011 },
    medium: { square: 0.026, large: 0.042 },
    high: { square: 0.103, large: 0.167 },
};
const GPT_IMAGE_1_MINI_COSTS = {
    low: { square: 0.005, large: 0.006 },
    medium: { square: 0.011, large: 0.015 },
    high: { square: 0.015, large: 0.02 },
};
export function normalizeOpenAIImageQuality(quality) {
    if (quality === 'standard')
        return 'medium';
    if (quality === 'hd')
        return 'high';
    if (quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto')
        return quality;
    return 'auto';
}
export function normalizeOpenAIImageSize(model, size) {
    if (!size || size === 'auto')
        return 'auto';
    if (size === 'square')
        return '1024x1024';
    if (size === 'landscape')
        return '1536x1024';
    if (size === 'portrait')
        return '1024x1536';
    if (size === '1024x1024' || size === '1536x1024' || size === '1024x1536')
        return size;
    if (isGptImage2(model)) {
        if (isPixelSize(size)) {
            assertValidGptImage2Size(size);
            return size;
        }
        const aspectSize = mapGptImage2AspectSize(size);
        if (aspectSize)
            return aspectSize;
    }
    return 'auto';
}
export function getOpenAIImageCostEstimate(model, quality, size) {
    const normalizedQuality = quality === 'auto' ? 'medium' : quality;
    const sizeClass = size === '1536x1024' || size === '1024x1536' ? 'large' : 'square';
    if (isGptImage2(model)) {
        return estimateGptImage2Cost(normalizedQuality, size);
    }
    if (model === 'chatgpt-image-latest' || model === 'gpt-image-1.5') {
        return GPT_IMAGE_15_COSTS[normalizedQuality][sizeClass];
    }
    if (model === 'gpt-image-1')
        return GPT_IMAGE_1_COSTS[normalizedQuality][sizeClass];
    if (model === 'gpt-image-1-mini')
        return GPT_IMAGE_1_MINI_COSTS[normalizedQuality][sizeClass];
    return 0.04;
}
export function getOpenAIImageCostMetadata(model, quality, size) {
    if (!isGptImage2(model))
        return {};
    const cost = estimateGptImage2Cost(quality === 'auto' ? 'medium' : quality, size);
    const outputTokens = Math.round((cost / GPT_IMAGE_2_OUTPUT_PRICE_PER_MILLION) * 1_000_000);
    return {
        pricing_source: hasPublishedGptImage2Estimate(size) ? 'openai_pricing_calculator' : 'ensemble_size_estimate',
        estimated_output_tokens: outputTokens,
        output_price_per_million: GPT_IMAGE_2_OUTPUT_PRICE_PER_MILLION,
    };
}
export function calculateOpenAIImageUsageCost(model, usage) {
    const modelCost = findModel(model)?.cost;
    if (!modelCost)
        return undefined;
    const textInputTokens = usage.input_tokens_details?.text_tokens;
    const imageInputTokens = usage.input_tokens_details?.image_tokens;
    const outputTokens = usage.output_tokens || 0;
    let cost = 0;
    if (typeof textInputTokens === 'number') {
        cost += tokenCost(textInputTokens, modelCost.input_per_million, 'text');
    }
    if (typeof imageInputTokens === 'number') {
        cost += tokenCost(imageInputTokens, modelCost.input_per_million, 'image');
    }
    if (outputTokens > 0) {
        cost += tokenCost(outputTokens, modelCost.output_per_million, 'image');
    }
    if (cost === 0 && !textInputTokens && !imageInputTokens && outputTokens === 0)
        return undefined;
    return cost;
}
export function buildOpenAIImageUsageRecord(model, usage, imageCount, requestId, metadata) {
    const cost = calculateOpenAIImageUsageCost(model, usage);
    if (typeof cost !== 'number')
        return undefined;
    return {
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        total_tokens: usage.total_tokens,
        image_count: imageCount,
        cost,
        request_id: requestId,
        metadata: {
            ...metadata,
            token_priced: true,
            input_tokens_details: usage.input_tokens_details,
        },
    };
}
function tokenCost(tokens, costStructure, modality) {
    const price = getModalityPrice(costStructure, modality);
    if (typeof price !== 'number')
        return 0;
    return (tokens / 1_000_000) * price;
}
function getModalityPrice(costStructure, modality) {
    if (typeof costStructure === 'number')
        return costStructure;
    if (!costStructure || typeof costStructure !== 'object')
        return undefined;
    if ('text' in costStructure || 'audio' in costStructure || 'video' in costStructure || 'image' in costStructure) {
        const modalityCost = costStructure[modality];
        return typeof modalityCost === 'number' ? modalityCost : undefined;
    }
    return undefined;
}
function isGptImage2(model) {
    return model === 'gpt-image-2' || model.startsWith('gpt-image-2-');
}
function estimateGptImage2Cost(quality, size) {
    if (size === 'auto' || size === '1024x1024')
        return GPT_IMAGE_2_COSTS[quality].square;
    if (size === '1536x1024' || size === '1024x1536')
        return GPT_IMAGE_2_COSTS[quality].large;
    const [width, height] = size.split('x').map(Number);
    const longEdge = Math.max(width, height);
    const shortEdge = Math.min(width, height);
    const longCells = { low: 16, medium: 48, high: 96 }[quality];
    const shortCells = Math.round((longCells * shortEdge) / longEdge);
    const outputTokens = Math.ceil((longCells * shortCells * (2_000_000 + width * height)) / 4_000_000);
    return roundCost((outputTokens / 1_000_000) * GPT_IMAGE_2_OUTPUT_PRICE_PER_MILLION);
}
function hasPublishedGptImage2Estimate(size) {
    return size === 'auto' || size === '1024x1024' || size === '1536x1024' || size === '1024x1536';
}
function roundCost(cost) {
    return Math.round(cost * 1_000_000) / 1_000_000;
}
function isPixelSize(size) {
    return /^\d+x\d+$/.test(size);
}
function mapGptImage2AspectSize(size) {
    const ratio = parseAspectRatioSize(size);
    if (!ratio)
        return undefined;
    const ratioWidth = ratio.width / ratio.height;
    const aspectRatio = Math.max(ratio.width, ratio.height) / Math.min(ratio.width, ratio.height);
    if (aspectRatio > GPT_IMAGE_2_MAX_ASPECT_RATIO)
        return undefined;
    if (ratio.width === ratio.height)
        return '1024x1024';
    const width = roundToMultiple(Math.sqrt(GPT_IMAGE_2_LARGE_PIXELS * ratioWidth), GPT_IMAGE_2_SIZE_MULTIPLE);
    const height = roundToMultiple(Math.sqrt(GPT_IMAGE_2_LARGE_PIXELS / ratioWidth), GPT_IMAGE_2_SIZE_MULTIPLE);
    const sizeValue = `${width}x${height}`;
    assertValidGptImage2Size(sizeValue);
    return sizeValue;
}
function parseAspectRatioSize(size) {
    const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(size);
    if (!match)
        return undefined;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        return undefined;
    return { width, height };
}
function roundToMultiple(value, multiple) {
    return Math.max(multiple, Math.round(value / multiple) * multiple);
}
function assertValidGptImage2Size(size) {
    const [width, height] = size.split('x').map(Number);
    const shortEdge = Math.min(width, height);
    const longEdge = Math.max(width, height);
    const pixels = width * height;
    if (width % 16 !== 0 || height % 16 !== 0) {
        throw new Error(`gpt-image-2 size ${size} is invalid: both edges must be multiples of 16px.`);
    }
    if (longEdge / shortEdge > GPT_IMAGE_2_MAX_ASPECT_RATIO) {
        throw new Error(`gpt-image-2 size ${size} is invalid: long edge to short edge ratio must not exceed ${GPT_IMAGE_2_MAX_ASPECT_RATIO}:1.`);
    }
    if (pixels < GPT_IMAGE_2_MIN_PIXELS || pixels > GPT_IMAGE_2_MAX_PIXELS) {
        throw new Error(`gpt-image-2 size ${size} is invalid: total pixels must be between ${GPT_IMAGE_2_MIN_PIXELS.toLocaleString('en-US')} and ${GPT_IMAGE_2_MAX_PIXELS.toLocaleString('en-US')}.`);
    }
}
