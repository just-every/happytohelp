import React, { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useNavigationGuard } from '../../native/NavigationGuard';
import { nativeRequest } from '../../native/transport';
import { useDashboardSettings } from '../../native/dashboard-state';
import { rememberDemoReturn, returnWorkspace } from '../../native/demo/return-workspace';

/** The empty inbox's quiet way to look around: opens the fictional demo project and remembers this workspace as the way back. */
export default function DemoInboxInvitation() {
    const navigate = useNavigate();
    const settings = useDashboardSettings();
    const originId = settings.project.id;
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

    return <div className="inbox-start__demo">
        <button type="button" className="inbox-start__quiet" data-testid="inbox-demo" disabled={ loading } onClick={ openDemo }>
            { loading ? 'Opening demo inbox…' : 'Try a demo inbox' }
        </button>
        { loading && <p role="status">Preparing your demo project…</p> }
        { error && <p className="text-danger" role="alert">{ error }</p> }
    </div>;
}
