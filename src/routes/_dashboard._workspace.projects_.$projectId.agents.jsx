import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import WorkspacePages from '../ui/native/WorkspacePages';
import ManagementPage from '../ui/native/pages/ManagementPage';

export const Route = createFileRoute('/_dashboard/_workspace/projects_/$projectId/agents')({ ...dashboardLoaderOptions, component: Agents });

function Workspace({ settings }) {
    return <WorkspacePages settings={settings} pages={{ ManagementPage }} />;
}

function Agents() {
    return <DashboardContent Workspace={Workspace} />;
}
