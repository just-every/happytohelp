import React from 'react';

/** Status stays in the existing views row; assignment composes with every view. */
export default function ConversationsFilter({assignment, searchScope, searching, onChange}) {
    const allHistory = searching && searchScope !== 'view';
    return <div className="d-flex flex-column gap-2">
        <select className="form-select inbox-tag-filter" aria-label="Filter conversations by assignment" value={assignment || 'anyone'} disabled={allHistory} onChange={event => onChange({assigned_to:event.target.value})}>
            <option value="anyone">All agents</option>
            <option value="myself">Assigned to me</option>
            <option value="none">Unassigned</option>
        </select>
        { searching && <select className="form-select inbox-tag-filter" aria-label="Conversation search scope" value={searchScope} onChange={event => onChange({search_scope:event.target.value})}>
            <option value="all">Search all history</option>
            <option value="view">Search current filters</option>
        </select> }
    </div>;
}
