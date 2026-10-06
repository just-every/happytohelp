import { nativeRequest } from '../transport';

/** Plain-language names for the scopes an application can be granted. */
export const scopeLabels = {
    'support.conversation.read': 'Read support conversations',
    'knowledge.article.read': 'Read help articles',
    'knowledge.article.update': 'Edit help articles',
    'knowledge.article.publish': 'Publish help articles',
};

export const dateTime = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const failures = {
    INVALID_REQUEST: 'These details were not accepted. Use the application\'s https address, a callback on that exact address, and allow loopback only for local development.',
    SCOPE_DENIED: 'Only owners and admins of this workspace can register applications.',
    CLIENT_EXISTS: 'An application with this identifier is already registered.',
};
export const failureMessage = error => failures[error.code] || error.message || 'The request could not be completed.';

/**
 * Submit a delegation form post. The server answers success with a redirect back to the
 * page, so a manual redirect is the success signal and any other failure carries a JSON code.
 */
export async function postDelegationForm(path, fields) {
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin', redirect: 'manual', body: new URLSearchParams(fields) });
    if (response.type === 'opaqueredirect' || response.ok) return;
    if (response.status === 401 && window.chatSettings) window.dispatchEvent(new CustomEvent('h2h:session-expired'));
    let body = null;
    try { body = await response.json(); } catch { /* the status alone describes the failure */ }
    throw Object.assign(new Error(body?.error?.message || `Request failed (${response.status})`), { status: response.status, code: body?.error?.code });
}

export const readDelegation = path => nativeRequest(path).then(response => response.data);
