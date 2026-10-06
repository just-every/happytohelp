import React, { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useNavigationGuard } from '../../native/NavigationGuard';
import { nativeRequest } from '../../native/transport';
import { useDashboardSettings } from '../../native/dashboard-state';
import { realWorkspaces, rememberDemoReturn, returnWorkspace } from '../../native/demo/return-workspace';

export default function DemoInboxInvitation() {
    const navigate = useNavigate();
    const settings = useDashboardSettings();
    const projects = realWorkspaces(settings);
    const [selected, setSelected] = useState('');
    const originId = !settings.isGlobalInbox && !settings.project?.is_demo ? settings.project?.id : selected || (projects.length === 1 ? projects[0].id : '');
    const { confirmNavigation } = useNavigationGuard();
    const pending = useRef(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const openDemo = async () => {
        if (pending.current) return;
        pending.current = true;
        try {
            if (!await confirmNavigation()) return;
            setLoading(true);
            setError('');
            const fresh = await nativeRequest('/api/management/bootstrap');
            if (!returnWorkspace(fresh, { userId: settings.currentAgent.id, projectId: originId })) throw new Error('Choose an available return workspace before opening the demo.');
            const project = await nativeRequest('/api/dashboard/demo-inbox', { method: 'POST' });
            rememberDemoReturn(window.localStorage, settings.currentAgent.id, project.id, originId);
            await nativeRequest('/api/identity/switch-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id }),
            });
            await navigate({ to: `/projects/${project.id}/conversations`, search: { view: 'open' }, ignoreBlocker: true });
        } catch (failure) {
            setError(failure.message || 'Couldn’t open the demo inbox. Please try again.');
        } finally {
            pending.current = false;
            setLoading(false);
        }
    };

    return <div className="demo-inbox-invitation mx-auto">
        <p>Explore fictional conversations in a separate demo project.</p>
        {settings.isGlobalInbox && <label className="d-block mb-2">Return workspace<select className="form-select form-select-sm mt-1" value={originId} onChange={event => setSelected(event.target.value)} disabled={loading}><option value="">Choose your workspace</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
        <button type="button" className="btn btn-sm btn-primary" disabled={loading || !originId} onClick={openDemo}>
            {loading ? 'Opening demo inbox…' : 'Try a demo inbox'}
        </button>
        {loading && <p className="mt-2" role="status">Preparing your demo project…</p>}
        {error && <p className="mt-2 text-danger" role="alert">{error}</p>}
    </div>;
}
