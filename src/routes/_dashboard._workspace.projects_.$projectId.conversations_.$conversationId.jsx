import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import InboxPage from '../ui/native/InboxPage';
import Conversation from '../ui/dashboard/components/Conversation';

export const Route = createFileRoute('/_dashboard/_workspace/projects_/$projectId/conversations_/$conversationId')({ ...dashboardLoaderOptions, component: ProjectConversationDetail });

function ProjectConversationDetail() {
    return <DashboardContent Inbox={InboxPage} Conversation={Conversation} />;
}
