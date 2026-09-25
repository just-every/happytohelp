import { createFileRoute } from '@tanstack/react-router';
import Dashboard, { DashboardError, DashboardPending } from '../ui/native/Dashboard';

export const Route = createFileRoute('/_dashboard/_workspace')({
    ssr: false,
    validateSearch: (search: Record<string, unknown>) => ({ ...search, ...(search.q == null ? {} : { q: String(search.q) }) }),
    gcTime: 0,
    pendingMs: Infinity,
    pendingComponent: DashboardPending,
    errorComponent: DashboardError,
    component: Dashboard,
});
