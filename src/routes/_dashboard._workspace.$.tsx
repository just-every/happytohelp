import { createFileRoute } from '@tanstack/react-router';
import { DashboardContent } from '../ui/native/Dashboard';
import { dashboardLoaderOptions } from '../ui/native/dashboard-state';
export const Route = createFileRoute('/_dashboard/_workspace/$')({ codeSplitGroupings: [], ...dashboardLoaderOptions, component: DashboardContent });
