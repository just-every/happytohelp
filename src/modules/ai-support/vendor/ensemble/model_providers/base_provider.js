import { isValidBase64, detectImageType } from '../utils/image_validation.js';
import { retryStreamWithBackoff } from '../utils/retry_handler.js';
export class BaseModelProvider {
    providerId;
    provider_id;
    constructor(providerId) {
        this.providerId = providerId;
        this.provider_id = providerId;
    }
    async *createResponseStreamWithRetry(messages, model, agent, requestId) {
        const retryOptions = {
            maxRetries: agent.retryOptions?.maxRetries ?? 3,
            initialDelay: agent.retryOptions?.initialDelay ?? 1000,
            maxDelay: agent.retryOptions?.maxDelay ?? 30000,
            backoffMultiplier: agent.retryOptions?.backoffMultiplier ?? 2,
            onRetry: (error, attempt) => {
                console.error(`${this.providerId} error ${model}: Retry attempt ${attempt} after error:`, error.message || error);
                agent.retryOptions?.onRetry?.(error, attempt);
            },
        };
        if (agent.retryOptions?.additionalRetryableErrors) {
            retryOptions.retryableErrors = new Set([
                ...(retryOptions.retryableErrors || []),
                ...agent.retryOptions.additionalRetryableErrors,
            ]);
        }
        if (agent.retryOptions?.additionalRetryableStatusCodes) {
            retryOptions.retryableStatusCodes = new Set([
                ...(retryOptions.retryableStatusCodes || []),
                ...agent.retryOptions.additionalRetryableStatusCodes,
            ]);
        }
        yield* retryStreamWithBackoff(() => this.createResponseStream(messages, model, agent, requestId), retryOptions);
    }
    isValidBase64(str) {
        return isValidBase64(str);
    }
    detectImageType(base64Data) {
        return detectImageType(base64Data);
    }
}
