import { DashboardError } from '../ui/native/Dashboard';
import { checkNativeSession } from '../ui/identity/loaders';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { dashboardPath } from '../ui/native/dashboard-path';

// Validate document paths on the server before entering the client-only workspace.
export const Route = createFileRoute('/_dashboard')({
    headers: () => ({ 'Cache-Control': 'no-store' }),
    errorComponent: DashboardError,
    beforeLoad: async ({ location }) => {
        if (!dashboardPath.test(location.pathname)) throw notFound();
        if (import.meta.env.SSR && !await checkNativeSession()) throw redirect({ to: '/login', search: { returnTo: location.href }, replace: true, headers: { 'Cache-Control': 'no-store' } });
    },
});
