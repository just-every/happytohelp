import React, { useState } from 'react';
import { nativeRequest } from '../transport';
import { Section } from './forms';

export default function DeleteWorkspace({ projectId, name }) {
    const [confirming, setConfirming] = useState(false), [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const remove = async () => {
        setBusy(true); setError('');
        try {
            const { data: projects } = await nativeRequest('/api/management/projects');
            const remaining = projects.find(project => project.id !== projectId);
            if (remaining) await nativeRequest('/api/identity/switch-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: remaining.id }) });
            await nativeRequest(`/api/management/projects/${projectId}`, { method: 'DELETE' });
            window.location.assign('/projects');
        } catch (failure) { setError(failure.message); setBusy(false); }
    };
    return <Section title="Delete workspace">
        <p>Remove this workspace from your account and stop its widget, invitations and automated replies. Retained history is archived; this action cannot be undone here.</p>
        {error && <p role="alert">{error}</p>}
        {confirming ? <>
            <label className="form-label" htmlFor="delete-workspace-name">Type {name} to confirm</label>
            <input id="delete-workspace-name" className="form-control" value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" />
            <div className="settings-actions"><button type="button" className="btn btn-danger" disabled={busy || typed !== name} onClick={remove}>{busy ? 'Deleting…' : 'Confirm deletion'}</button> <button type="button" className="btn btn-white" disabled={busy} onClick={() => { setConfirming(false); setTyped(''); }}>Cancel</button></div>
        </> : <button type="button" className="btn btn-outline-danger" onClick={() => setConfirming(true)}>Delete workspace</button>}
    </Section>;
}
