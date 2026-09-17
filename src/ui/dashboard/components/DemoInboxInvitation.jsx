import React, { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useNavigationGuard } from '../../native/NavigationGuard';
import { nativeRequest } from '../../native/transport';

export default function DemoInboxInvitation() {
    const navigate = useNavigate();
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
            const project = await nativeRequest('/api/dashboard/demo-inbox', { method: 'POST' });
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
        <p>Your inbox is ready for its first conversation.</p>
        <p>Explore fictional customer conversations in a separate demo project.</p>
        <button type="button" className="btn btn-sm btn-primary" disabled={loading} onClick={openDemo}>
            {loading ? 'Opening demo inbox…' : 'Try a demo inbox'}
        </button>
        {loading && <p className="mt-2" role="status">Preparing your demo project…</p>}
        {error && <p className="mt-2 text-danger" role="alert">{error}</p>}
    </div>;
}
