import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import WorkspacePages from '../ui/native/WorkspacePages';
import Reports from '../ui/native/pages/Reports';

export const Route = createFileRoute('/_dashboard/_workspace/projects_/$projectId/reports')({ ...dashboardLoaderOptions, component: ProjectReports });

function Workspace({ settings }) {
    return <WorkspacePages settings={settings} pages={{ Reports }} />;
}

function ProjectReports() {
    return <DashboardContent Workspace={Workspace} />;
}
