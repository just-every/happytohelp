import {takeInitialWorkspaceRead} from './initial-workspace-reads.js';
/** Native command transport. Commands are persisted by the server before UI acknowledgement. */
export async function nativeRequest(path, init = {}) {
    const initial = await takeInitialWorkspaceRead(path, init);
    if (initial) {
        if ('error' in initial) {
            notifyExpiredSession(path, initial.error.status);
            throw Object.assign(new Error(initial.error.message), {status: initial.error.status, data: initial.error.data});
        }
        return initial.result;
    }
    const response = await fetch(path, { credentials: 'same-origin', ...init });
    const body = await response.json();
    notifyExpiredSession(path, response.status);
    if (!response.ok) throw Object.assign(new Error(body.error?.message || body.error || `Request failed (${response.status})`), { status: response.status, data: body });
    return body;
}
function notifyExpiredSession(path, status) {
    if (status === 401 && typeof window !== 'undefined' && window.chatSettings
        && path !== '/api/identity/login' && path !== '/api/identity/password') {
        window.dispatchEvent(new CustomEvent('h2h:session-expired'));
    }
}
export async function sendCommand(projectId, conversationId, action, data) {
    if (action === 'setConversationId') return;
    if (action === 'sendMessage') {
        const frontier = await nativeRequest(`/api/conversations/${encodeURIComponent(conversationId)}`);
        return nativeRequest(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localId: data.local_id, content: data.content, expectedRevision: frontier.revision,
                expectedLastMessageId: frontier.last_message_id, mediaIds: data.media_ids, resolve: data.resolve, authoring: data.authoring }),
        });
    }
    return nativeRequest(`/api/dashboard/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/actions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }),
    });
}

/** Reconnect uses the persisted event cursor. Never repeats a mutation on a reconnect. */
function connectSocket(resourcePath, cursorKey, onFrame, onReconnect, onError) {
    let socket, timer, stopped = false, connected = false, attempt = 0;
    const key = cursorKey;
    let cursor = sessionStorage.getItem(key) || '';
    const open = () => {
        const url = new URL(resourcePath, location.origin);
        url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (cursor) url.searchParams.set('after', cursor);
        if (window.chatSettings.socketToken) url.searchParams.set('token', window.chatSettings.socketToken);
        socket = new WebSocket(url);
        socket.onopen = () => { attempt = 0; if (connected) onReconnect(); connected = true; };
        socket.onmessage = event => {
            try {
                const frame = JSON.parse(event.data);
                onFrame(frame);
                if (frame.eventId) { cursor = frame.eventId; sessionStorage.setItem(key, cursor); }
            } catch (error) { onError(error); }
        };
        // A socket closed on purpose (teardown) is not an outage: report only failures that will reconnect.
        socket.onerror = () => { if (!stopped) onError(new Error('Live connection unavailable; reconnecting.')); };
        socket.onclose = () => { if (!stopped) timer = setTimeout(open, Math.min(15000, 500 * 2 ** attempt++)); };
    };
    open();
    return () => { stopped = true; clearTimeout(timer); socket?.close(); };
}

export function connectConversation(conversationId, onFrame, onReconnect, onError) {
    return connectSocket(`/api/conversations/${encodeURIComponent(conversationId)}/socket`, `h2h-event:${conversationId}`, onFrame, onReconnect, onError);
}
export function connectProject(projectId, onFrame, onReconnect, onError) {
    return connectSocket(`/api/projects/${encodeURIComponent(projectId)}/socket`, `h2h-project-event:${projectId}`, onFrame, onReconnect, onError);
}
