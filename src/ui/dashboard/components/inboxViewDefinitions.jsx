export const INBOX_VIEWS = [
    { id: 'mine', label: 'Your inbox', filter: { status: 'unresolved', assigned_to: 'myself' } },
    { id: 'open', label: 'All open', filter: { status: 'unresolved', assigned_to: 'anyone' } },
    { id: 'unassigned', label: 'Unassigned', filter: { status: 'unresolved', assigned_to: 'none' } },
    { id: 'ai', label: 'AI conversations', filter: { status: 'ai', assigned_to: 'anyone' } },
    { id: 'closed', label: 'Closed', filter: { status: 'resolved', assigned_to: 'anyone' } },
];

export const DEFAULT_INBOX_VIEW = 'mine';

export function normalizeInboxView(view) {
    return INBOX_VIEWS.some(item => item.id === view) ? view : DEFAULT_INBOX_VIEW;
}

export function getInboxView(view) {
    return INBOX_VIEWS.find(item => item.id === normalizeInboxView(view));
}

export function inboxViewFilter(view, query = '') {
    const filter = { ...getInboxView(view).filter };

    if (query.trim()) {
        filter.q = query.trim();
    }

    return filter;
}

export function inboxViewCountsPath(isGlobalInbox, projectId) {
    return isGlobalInbox
        ? '/conversations/counts'
        : `/projects/${ projectId }/conversations/counts`;
}
