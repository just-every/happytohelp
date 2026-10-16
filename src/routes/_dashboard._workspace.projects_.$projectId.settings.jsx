import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import WorkspacePages from '../ui/native/WorkspacePages';
import ProjectSettings from '../ui/native/pages/ProjectSettings';

export const Route = createFileRoute('/_dashboard/_workspace/projects_/$projectId/settings')({ ...dashboardLoaderOptions, component: Settings });

function Workspace({ settings }) {
    return <WorkspacePages settings={settings} pages={{ ProjectSettings }} />;
}

function Settings() {
    return <DashboardContent Workspace={Workspace} />;
}
