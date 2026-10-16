import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import WorkspacePages from '../ui/native/WorkspacePages';
import ProjectsPage from '../ui/native/pages/ProjectsPage';

export const Route = createFileRoute('/_dashboard/_workspace/projects')({ ...dashboardLoaderOptions, component: Projects });

function Workspace({ settings }) {
    return <WorkspacePages settings={settings} pages={{ ProjectsPage }} />;
}

function Projects() {
    return <DashboardContent Workspace={Workspace} />;
}
