export class OpenAIImageRequestError extends Error {
    reason;
    retryable;
    recoverable;
    status;
    requestID;
    request_id;
    code;
    type;
    param;
    providerCode;
    providerType;
    providerParam;
    cause;
    constructor(message, details) {
        super(message);
        this.name = 'OpenAIImageRequestError';
        this.reason = details.reason;
        this.retryable = details.retryable;
        this.recoverable = details.retryable;
        this.status = details.status;
        this.requestID = details.providerRequestId;
        this.request_id = details.providerRequestId;
        this.code = details.providerCode;
        this.type = details.providerType;
        this.param = details.providerParam;
        this.providerCode = details.providerCode;
        this.providerType = details.providerType;
        this.providerParam = details.providerParam;
        this.cause = details.cause;
    }
}
export const DEFAULT_OPENAI_IMAGE_TIMEOUT_MS = 5 * 60 * 1000;
const normalizedString = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};
const nestedProviderError = (error) => error.error && typeof error.error === 'object' ? error.error : {};
const providerRequestId = (error) => {
    const direct = normalizedString(error.requestID) ?? normalizedString(error.request_id);
    if (direct)
        return direct;
    return error.headers instanceof Headers ? normalizedString(error.headers.get('x-request-id')) : undefined;
};
const isPolicyFailure = (values) => {
    const description = values.filter(Boolean).join(' ').toLowerCase();
    return (description.includes('content_policy') ||
        description.includes('content policy') ||
        description.includes('moderation_blocked') ||
        description.includes('moderation blocked') ||
        description.includes('safety violation'));
};
export function normalizeOpenAIImageError(error) {
    if (error instanceof OpenAIImageRequestError)
        return error;
    const raw = error && typeof error === 'object' ? error : {};
    const nested = nestedProviderError(raw);
    const name = normalizedString(raw.name) ?? (error instanceof Error ? error.name : undefined);
    const message = normalizedString(raw.message) ??
        normalizedString(nested.message) ??
        (typeof error === 'string' ? error : undefined) ??
        'OpenAI image request failed.';
    const status = typeof raw.status === 'number' && Number.isFinite(raw.status) ? raw.status : undefined;
    const providerCode = normalizedString(raw.code) ?? normalizedString(nested.code);
    const providerType = normalizedString(raw.type) ?? normalizedString(nested.type);
    const providerParam = normalizedString(raw.param) ?? normalizedString(nested.param);
    const requestId = providerRequestId(raw);
    const policyFailure = isPolicyFailure([providerCode, providerType, message]);
    const timeout = name === 'APIConnectionTimeoutError' || name === 'TimeoutError' || providerCode === 'ETIMEDOUT';
    const aborted = name === 'AbortError' || providerCode === 'ABORT_ERR';
    const connection = name === 'APIConnectionError';
    const retryableStatus = status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500);
    const reason = policyFailure
        ? 'content_policy_violation'
        : timeout
            ? 'timeout'
            : aborted
                ? 'aborted'
                : connection
                    ? 'connection'
                    : 'http';
    return new OpenAIImageRequestError(message, {
        reason,
        retryable: timeout || connection || retryableStatus,
        status,
        providerRequestId: requestId,
        providerCode,
        providerType,
        providerParam,
        cause: error,
    });
}
const timeoutError = (operationName, timeoutMs) => new OpenAIImageRequestError(`${operationName} timed out after ${timeoutMs}ms`, {
    reason: 'timeout',
    retryable: true,
    providerCode: 'ETIMEDOUT',
});
const abortError = (operationName, cause) => new OpenAIImageRequestError(`${operationName} aborted`, {
    reason: 'aborted',
    retryable: false,
    providerCode: 'ABORT_ERR',
    cause,
});
export async function runOpenAIImageRequest(options) {
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
        throw new RangeError('OpenAI image timeoutMs must be a positive finite number.');
    }
    const controller = new AbortController();
    let abortListener;
    let rejectGuard;
    const guardPromise = new Promise((_, reject) => {
        rejectGuard = reject;
    });
    const abortWith = (error) => {
        if (!controller.signal.aborted)
            controller.abort(error);
        rejectGuard?.(error);
    };
    if (options.abortSignal?.aborted) {
        abortWith(abortError(options.operationName, options.abortSignal.reason));
    }
    else if (options.abortSignal) {
        abortListener = () => abortWith(abortError(options.operationName, options.abortSignal?.reason));
        options.abortSignal.addEventListener('abort', abortListener, { once: true });
    }
    const timeoutId = setTimeout(() => {
        abortWith(timeoutError(options.operationName, options.timeoutMs));
    }, options.timeoutMs);
    const operationPromise = Promise.resolve().then(() => options.execute(controller.signal));
    try {
        return await Promise.race([operationPromise, guardPromise]);
    }
    catch (error) {
        operationPromise.catch(() => {
        });
        throw normalizeOpenAIImageError(error);
    }
    finally {
        clearTimeout(timeoutId);
        if (options.abortSignal && abortListener) {
            options.abortSignal.removeEventListener('abort', abortListener);
        }
    }
}
