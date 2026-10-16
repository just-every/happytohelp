import type { ComponentType } from 'react';

export declare const InboxPage: ComponentType<{ settings: any }>;
export declare const WorkspacePages: ComponentType<{ settings: any }>;
export declare function preloadDashboardPage(pathname: string, settings?: {
    accountOnly?: boolean;
    projectUnavailable?: string;
    currentAgent?: { id: string };
    isPlatformAdmin?: boolean;
}): Promise<unknown[]>;
