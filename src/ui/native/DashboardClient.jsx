import React, { useEffect } from 'react';
import { createWorkspaceTheme, normalizeWorkspaceMode } from './workspaceModes';
import { Outlet } from '@tanstack/react-router';
import { useDashboardSettings, useDashboardLocation } from './dashboard-state';
import { isInboxPath } from './workspace-scope';
import { useSessionProjectGuard } from './session-project-sync';
import Chat from '../dashboard/components/Chat';
import { Provider } from '../dashboard/contexts/ChatContext';
import WorkspacePages from './WorkspacePages';
import Navigation from './Navigation';
import { NavigationGuard } from './NavigationGuard';
import { MobileNavigationProvider } from './MobileNavigation';
import DemoWorkspaceBanner from './demo/DemoWorkspaceBanner';
export default function DashboardClient({ settings }) {
    const pathname = useDashboardLocation().pathname;
    const isInbox = isInboxPath(pathname, settings);
    useSessionProjectGuard(settings.projectId);
    useEffect(() => {
        document.body.className = `${isInbox ? 'conversation-workspace' : 'workspace-page'} workspace-themed theme-happytohelp`;
    }, [isInbox]);
    useEffect(() => {
        let properties = [];
        const apply = appearance => {
            const mode = normalizeWorkspaceMode(appearance?.display_mode);
            const palette = createWorkspaceTheme(appearance?.primary_color, mode);
            properties.filter(key => !(key in palette)).forEach(key => document.body.style.removeProperty(key));
            Object.entries(palette).forEach(([key,value]) => document.body.style.setProperty(key,value));
            properties = Object.keys(palette);
            document.body.dataset.workspaceMode = mode;
            document.documentElement.dataset.bsTheme = mode === 'dark' ? 'dark' : 'light';
        };
        apply(settings.isGlobalInbox ? {} : settings.project);
        const update = event => apply(event.detail);
        window.addEventListener('workspace-appearance',update);
        return () => { window.removeEventListener('workspace-appearance',update); properties.forEach(key=>document.body.style.removeProperty(key)); delete document.body.dataset.workspaceMode; document.documentElement.dataset.bsTheme='light'; };
    }, [settings]);
    const scopeKey = `${settings.sessionVersion}:${settings.currentAgent?.id}:${settings.isGlobalInbox ? 'global' : settings.projectId}:${settings.project?.id}`;
    return <NavigationGuard><MobileNavigationProvider>
        <a className="workspace-skip-link" href="#workspace-main">Skip to main content</a>
        <Navigation settings={settings} />
        <Provider key={scopeKey} {...settings} conversationLists={{}} conversationData={{}} projectId={settings.project?.id}>
            <main id="workspace-main" tabIndex={-1}>
                <DemoWorkspaceBanner settings={settings} />
                <Outlet />
            </main>
        </Provider>
    </MobileNavigationProvider></NavigationGuard>;
}

export function DashboardContent() {
    const settings = useDashboardSettings();
    const pathname = useDashboardLocation().pathname;
    const isInbox = isInboxPath(pathname, settings);
    return isInbox
        ? <div className="main-content"><h1 className="visually-hidden">Inbox</h1><div id="chat"><Chat /></div></div>
        : <WorkspacePages settings={settings} />;
}
