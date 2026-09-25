import { createFileRoute, notFound } from '@tanstack/react-router';
import { dashboardPath } from '../ui/native/dashboard-path';

// Validate document paths on the server before entering the client-only workspace.
export const Route = createFileRoute('/_dashboard')({
    beforeLoad: ({ location }) => {
        if (!dashboardPath.test(location.pathname)) throw notFound();
    },
});
