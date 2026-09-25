/**
 * Co-ordinates inbox list invalidation with the more expensive count request.
 *
 * Invalidations are batched from the first event in a burst. A count request is
 * never concurrent with another request; an event that arrives during one causes
 * exactly one trailing count refresh after the active request settles.
 */
function createInboxRefreshScheduler({
    fetchCounts,
    onInvalidate,
    onCounts,
    onError = () => {},
    delayMs = 100,
    setTimeoutFn = globalThis.setTimeout,
    clearTimeoutFn = globalThis.clearTimeout,
    createAbortController = () => new AbortController(),
}) {
    let refreshTimer = null;
    let requestInFlight = false;
    let needsTrailingRequest = false;
    let activeController = null;
    let activeRequest = null;
    let disposed = false;

    const runCountRequest = () => {
        if (disposed) return Promise.resolve();

        if (requestInFlight) {
            needsTrailingRequest = true;
            return activeRequest;
        }

        requestInFlight = true;
        activeController = createAbortController();
        const signal = activeController?.signal;

        let request;
        try {
            request = fetchCounts({ signal });
        } catch (error) {
            request = Promise.reject(error);
        }

        activeRequest = Promise.resolve(request)
            .then(counts => {
                if (!disposed) onCounts(counts);
                return counts;
            })
            .catch(error => {
                if (!disposed) onError(error);
                return undefined;
            })
            .finally(() => {
                requestInFlight = false;
                activeController = null;

                if (!disposed && needsTrailingRequest) {
                    needsTrailingRequest = false;
                    runCountRequest();
                }
            });

        return activeRequest;
    };

    const flush = () => {
        refreshTimer = null;
        if (disposed) return;

        // The list may begin fetching immediately; it never waits for counts.
        onInvalidate();
        runCountRequest();
    };

    const invalidate = () => {
        if (disposed || refreshTimer !== null) return;

        refreshTimer = setTimeoutFn(flush, delayMs);
    };

    const loadInitialCounts = () => {
        return runCountRequest();
    };

    const dispose = () => {
        disposed = true;
        needsTrailingRequest = false;

        if (refreshTimer !== null) {
            clearTimeoutFn(refreshTimer);
            refreshTimer = null;
        }

        activeController?.abort();
        activeController = null;
    };

    return {
        dispose,
        invalidate,
        loadInitialCounts,
    };
}

function affectsInboxListing(updated) {
    // Draft/suggestion metadata has no effect on inbox filtering, sorting or counts.
    return Object.keys(updated).some(key => !['id', 'project_id', 'metadata'].includes(key));
}

export { createInboxRefreshScheduler, affectsInboxListing };
