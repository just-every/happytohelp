import { createFileRoute } from '@tanstack/react-router';
import Dashboard, { DashboardError, DashboardPending } from '../ui/native/Dashboard';
import { loadWorkspaceBootstrap } from '../ui/native/dashboard-bootstrap';

export const Route = createFileRoute('/_dashboard/_workspace')({
    codeSplitGroupings: [],
    ssr: 'data-only',
    validateSearch: (search: Record<string, unknown>) => ({ ...search, ...(search.q == null ? {} : { q: String(search.q) }) }),
    loader: { handler: loadWorkspaceBootstrap, staleReloadMode: 'blocking' },
    loaderDeps: ({ search }) => search,
    shouldReload: true,
    staleTime: 0,
    gcTime: 0,
    pendingMs: Infinity,
    pendingMinMs: 0,
    pendingComponent: DashboardPending,
    errorComponent: DashboardError,
    component: Dashboard,
});
