import { withVisualEdits } from '../../editor/VisualEditBoundary';
import { EditorLauncher } from '../../editor/EditorLauncher';
import { lazy, Suspense, useEffect } from 'react';
import { Link, useMatches, useRouter } from '@tanstack/react-router';
import { DashboardSettingsContext, useDashboardSessionVersion, invalidateDashboardSession } from './dashboard-state';
import '../dashboard/styles/dashboard.scss';
import '../dashboard/styles/layouts/_native-shell.scss';

const DashboardClient = lazy(() => import('./DashboardClient'));
const Content = lazy(() => import('./DashboardClient').then(module => ({ default: withVisualEdits(module.DashboardContent) })));

export function DashboardPending() {
    return <main className="container py-5" aria-busy="true">Loading your workspace…</main>;
}
export function DashboardError({ error }: { error: unknown }) {
    const router = useRouter();
    useEffect(() => { delete (window as any).chatSettings; }, []);
    // Only an expired session offers sign-in; any other failure leaves a signed-in user a way to retry or leave.
    const expired = (error as { status?: number } | null)?.status === 401;
    return <main className="container py-5"><h1>HappyToHelp</h1>
        <p role="alert">{error instanceof Error ? error.message : 'The workspace could not be loaded.'}</p>
        {expired ? <Link to="/login">Sign in</Link>
            : <p><button type="button" className="btn btn-primary me-3" onClick={() => { void router.invalidate(); }}>Try again</button><Link to="/">Back to the inbox</Link></p>}
    </main>;
}
export function DashboardContent() {
    return <Suspense fallback={<DashboardPending />}><Content /></Suspense>;
}
export default function Dashboard() {
    const match = useMatches({ select: matches => matches.at(-1) });
    const settings = match?.loaderData as any;
    const router = useRouter();
    useEffect(() => {
        const expired = () => {
            invalidateDashboardSession(router);
            void router.navigate({ to: '/login', search: { returnTo: router.state.location.href }, replace: true, ignoreBlocker: true });
        };
        window.addEventListener('h2h:session-expired', expired);
        return () => window.removeEventListener('h2h:session-expired', expired);
    }, [router]);
    const sessionVersion = useDashboardSessionVersion();
    if (match?.status === 'error') return <DashboardError error={match.error} />;
    if (!settings || settings.sessionVersion !== sessionVersion) return <DashboardPending />;
    // Embedded widgets still consume this compatibility object. Routing uses loader context.
    (window as any).chatSettings = settings;
    return <DashboardSettingsContext.Provider value={settings}>
        <EditorLauncher authorized={!!settings.project && ['owner', 'admin'].includes(settings.project.role)} />
        <Suspense fallback={<DashboardPending />}><DashboardClient settings={settings} /></Suspense>
    </DashboardSettingsContext.Provider>;
}
