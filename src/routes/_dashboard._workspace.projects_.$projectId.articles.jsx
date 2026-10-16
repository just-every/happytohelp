import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
import WorkspacePages from '../ui/native/WorkspacePages';
import KnowledgePage from '../ui/native/pages/KnowledgePage';

export const Route = createFileRoute('/_dashboard/_workspace/projects_/$projectId/articles')({ ...dashboardLoaderOptions, component: Articles });

function Workspace({ settings }) {
    return <WorkspacePages settings={settings} pages={{ KnowledgePage }} />;
}

function Articles() {
    return <DashboardContent Workspace={Workspace} />;
}
