/** Fresh responses from this navigation's explicit conversation reads. This is
 * neither a shared request cache nor authority for a later navigation. */
export function createInitialInboxReads(raw) {
    if (!raw?.projectId || !raw?.conversationId) return undefined;
    const { projectId, conversationId } = raw;
    const path = `/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}`;
    const remaining = new Map(['conversation', 'buckets', 'connections'].filter(key => raw[key]).map(key => [key, raw[key]]));
    let expired = false;
    return {
        id: crypto.randomUUID(), projectId, conversationId, path,
        matches(scope) {
            return scope.projectId === projectId && scope.conversationId === conversationId
                && scope.path?.replace(/\/$/, '') === path;
        },
        expire() { expired = true; remaining.clear(); },
        async take(resource, scope) {
            // StrictMode tears down its first setup before this continuation.
            // That aborted setup must leave the response for the committed one.
            await Promise.resolve();
            if (scope.signal?.aborted) throw scope.signal.reason || new DOMException('Request aborted', 'AbortError');
            if (expired || !this.matches(scope) || !scope.isCurrent()) return undefined;
            const outcome = remaining.get(resource);
            if (!outcome) return undefined;
            remaining.delete(resource);
            if (outcome.error) {
                const error = Object.assign(new Error(outcome.error.message), outcome.error);
                if (error.status === 401 && typeof window !== 'undefined' && window.chatSettings) {
                    window.dispatchEvent(new CustomEvent('h2h:session-expired'));
                }
                throw error;
            }
            return outcome;
        },
    };
}
