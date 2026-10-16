// `label` is what the views row shows; `phrase` is how the view reads inside a sentence (search placeholder, empty
// messages). Only the views flagged `disc` carry a count: the ones where a number above zero asks for attention.
export const INBOX_VIEWS = [
    { id: 'mine', label: 'Yours', phrase: 'your inbox', disc: true, filter: { status: 'unresolved', assigned_to: 'myself' } },
    { id: 'open', label: 'Open', phrase: 'all open', filter: { status: 'unresolved', assigned_to: 'anyone' } },
    { id: 'unassigned', label: 'Unassigned', phrase: 'unassigned', disc: true, filter: { status: 'unresolved', assigned_to: 'none' } },
    { id: 'ai', label: 'AI', phrase: 'AI conversations', filter: { status: 'ai', assigned_to: 'anyone' } },
    { id: 'closed', label: 'Closed', phrase: 'closed', filter: { status: 'resolved', assigned_to: 'anyone' } },
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

export function inboxViewPhrase(view) {
    return getInboxView(view).phrase;
}

export function inboxViewFilter(view, query = '', assignment, searchScope = 'all') {
    const filter = { ...getInboxView(view).filter };
    if (['anyone', 'myself', 'none'].includes(assignment)) filter.assigned_to = assignment;

    if (query.trim()) {
        filter.q = query.trim();
        filter.search_scope = searchScope === 'view' ? 'view' : 'all';
    }

    return filter;
}

export function inboxViewCountsPath(isGlobalInbox, projectId) {
    return isGlobalInbox
        ? '/conversations/counts'
        : `/projects/${ projectId }/conversations/counts`;
}
