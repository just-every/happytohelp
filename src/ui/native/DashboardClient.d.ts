import type { ComponentType } from 'react';
declare const DashboardClient: ComponentType<{ settings: any }>;
export interface DashboardContentProps {
    Inbox?: ComponentType<{ settings: any; Conversation?: ComponentType<any> }>;
    Workspace?: ComponentType<{ settings: any }>;
    Conversation?: ComponentType<any>;
}
export declare const DashboardContent: ComponentType<DashboardContentProps>;
export default DashboardClient;
