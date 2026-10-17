import React, { useContext, useEffect, useState } from 'react';
import { DashboardSettingsContext } from '../../native/dashboard-state';
import { nativeRequest } from '../../native/transport';
import '../styles/components/ConversationAccess.scss';

/** Whether the signed-in member's role in this workspace allows a permission; true where roles are not known (demo, widget). */
export function useCan(projectId, permission) {
    const access = useContext(DashboardSettingsContext)?.projects?.[projectId]?.access;
    return !access || access.permissions.includes(permission);
}

const followersPath = (projectId, conversationId) => `/api/dashboard/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}`;

/** Follow a conversation to keep track of it; shows who else follows it. */
export function FollowControl({ projectId, conversationId }) {
    const [state, setState] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        let active = true; setState(null); setError('');
        nativeRequest(`${followersPath(projectId, conversationId)}/followers`).then(result => { if (active) setState(result.data); }).catch(() => {});
        return () => { active = false; };
    }, [projectId, conversationId]);
    if (!state) return null;
    const toggle = async () => {
        setBusy(true); setError('');
        try { setState((await nativeRequest(`${followersPath(projectId, conversationId)}/follow`, { method: state.following ? 'DELETE' : 'POST' })).data); }
        catch (failure) { setError(failure.message); }
        setBusy(false);
    };
    return <div className="conversation-follow">
        <button type="button" className={`btn btn-sm ${state.following ? 'btn-white' : 'btn-outline-primary'}`} aria-pressed={state.following} disabled={busy} onClick={toggle}>{state.following ? 'Following' : 'Follow'}</button>
        {state.followers.length > 0 && <span className="conversation-follow__who">Followed by {state.followers.map(person => person.name).join(', ')}</span>}
        {error && <span role="alert" className="text-danger">{error}</span>}
    </div>;
}

/** In place of the reply box, for a role that cannot reply to customers (a collaborator). */
export function NotesOnlyComposer({ onAddNote }) {
    return <div className="conversation-notes-only" role="note">
        <p>You can read this conversation, add internal notes and follow it. Only teammates who can reply send messages to the customer.</p>
        <button type="button" className="btn btn-primary" onClick={onAddNote}>Add internal note</button>
    </div>;
}
