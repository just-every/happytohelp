import { withVisualEdits } from '../../editor/VisualEditBoundary';
import { EditorLauncher } from '../../editor/EditorLauncher';
import { lazy, Suspense, useEffect } from 'react';
import { Link, useMatches, useRouter } from '@tanstack/react-router';
import { BrandLockup } from '../homepage/BrandLockup';
import { DashboardSettingsContext, useDashboardSessionVersion, invalidateDashboardSession } from './dashboard-state';
import '../homepage/outfit.css';
import '../homepage/brand-tokens.css';
import '../identity/identity.css';
import '../dashboard/styles/dashboard.scss';
import { PenLine, QuestionBubble } from './drawings';

const DashboardClient = lazy(() => import('./DashboardClient'));
const Content = lazy(() => import('./DashboardClient').then(module => ({ default: withVisualEdits(module.DashboardContent) })));

// Before the workspace loads, and when it cannot: the identity pages' paper frame under the HappyToHelp lockup.
export function DashboardPending() {
    return <main className="h2h-identity dashboard-state" aria-busy="true"><header className="id-header"><BrandLockup home="/" /></header>
        <div className="dashboard-state__body"><PenLine progress /><p className="dashboard-state__message">Loading your workspace…</p></div>
    </main>;
}
export function DashboardError({ error }: { error: unknown }) {
    const router = useRouter();
    useEffect(() => { delete (window as any).chatSettings; }, []);
    // Only an expired session offers sign-in; any other failure leaves a signed-in user a way to retry or leave.
    const expired = (error as { status?: number } | null)?.status === 401;
    return <main className="h2h-identity dashboard-state"><header className="id-header"><h1 className="dashboard-error-brand"><BrandLockup home="/" /></h1></header>
        <div className="dashboard-state__body"><QuestionBubble />
            <p className="dashboard-state__message" role="alert">{error instanceof Error ? error.message : 'The workspace could not be loaded.'}</p>
            {expired ? <div className="id-actions"><Link className="pill pill--ink" to="/login">Sign in</Link></div>
                : <div className="id-actions"><button type="button" className="pill pill--ink" onClick={() => { void router.invalidate(); }}>Try again</button><span className="id-links"><Link to="/">Back to the inbox</Link></span></div>}
        </div>
    </main>;
}
// Inside the shell, while a page's code loads: one quiet line where the page will be.
function ContentPending() {
    return <div className="dashboard-content-pending" aria-busy="true"><p>Loading your workspace…</p></div>;
}
export function DashboardContent() {
    return <Suspense fallback={<ContentPending />}><Content /></Suspense>;
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
