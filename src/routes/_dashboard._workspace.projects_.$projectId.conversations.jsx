import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import InboxPage from '../ui/native/InboxPage';

export const Route = createFileRoute('/_dashboard/_workspace/projects_/$projectId/conversations')({ ...dashboardLoaderOptions, component: ProjectConversations });

function ProjectConversations() {
    return <DashboardContent Inbox={InboxPage} />;
}
