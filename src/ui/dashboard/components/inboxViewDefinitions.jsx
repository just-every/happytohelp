export const INBOX_VIEWS = [
    { id: 'mine', label: 'Your inbox', filter: { status: 'unresolved', assigned_to: 'myself' } },
    { id: 'open', label: 'All open', filter: { status: 'unresolved', assigned_to: 'anyone' } },
    { id: 'unassigned', label: 'Unassigned', filter: { status: 'unresolved', assigned_to: 'none' } },
    { id: 'ai', label: 'AI conversations', filter: { status: 'ai', assigned_to: 'anyone' } },
    { id: 'closed', label: 'Closed', filter: { status: 'resolved', assigned_to: 'anyone' } },
];

export function defaultInboxView(inboxViewCounts) {
    return inboxViewCounts?.mine > 0 ? 'mine' : 'open';
}

export function normalizeInboxView(view, inboxViewCounts) {
    return INBOX_VIEWS.some(item => item.id === view) ? view : defaultInboxView(inboxViewCounts);
}

export function getInboxView(view) {
    return INBOX_VIEWS.find(item => item.id === normalizeInboxView(view));
}

/** The view's name as it reads inside a sentence ("all open", "AI conversations"). */
export function inboxViewPhrase(view) {
    return getInboxView(view).label
        .split(' ')
        .map(word => word === 'AI' ? word : word.toLowerCase())
        .join(' ');
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
