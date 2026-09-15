import { useEffect, useState } from 'react';
import { nativeRequest } from './transport';
import '../dashboard/styles/theme.scss';

export default function Dashboard() {
    const [View, setView] = useState<any>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        const matchedProject = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
        const projectId = matchedProject === 'create' ? undefined : matchedProject;
        nativeRequest('/api/management/bootstrap' + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : '')).then(async (settings: any) => {
            if (cancelled) return;
            (window as any).chatSettings = { ...settings, apiUrl: '/api/dashboard', projectId, isGlobalInbox: !projectId };
            const module = settings.accountOnly ? await import('./pages/ProjectsPage') : await import('./DashboardClient');
            if (!cancelled) {
                // BrowserRouter adds its history index on first render. Initialize it here
                // so the outer TanStack router receives that update outside React render.
                if (!settings.accountOnly && window.history.state?.idx == null) {
                    window.history.replaceState({ ...window.history.state, idx: 0 }, '');
                }
                setView(() => module.default);
            }
        }).catch((failure: Error) => { if (!cancelled) setError(failure.message); });
        return () => { cancelled = true; };
    }, []);
    if (error) return <main className="container py-5"><h1>HappyToHelp</h1><p role="alert">{error}</p><a href="/login">Sign in</a></main>;
    return View ? <View /> : <main className="container py-5" aria-busy="true">Loading your workspace…</main>;
}
