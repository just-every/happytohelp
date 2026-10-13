import './first-run.css';
import React, { useEffect } from 'react';
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
        document.body.className = `${isInbox ? 'conversation-workspace' : 'workspace-page'} workspace-themed`;
    }, [isInbox]);
    // The workspace chrome is always paper, ink and aqua; the workspace's own colour belongs to its widget and help centre.
    // Dark display mode swaps the brand tokens (brand-tokens.css); Light and Balanced both render the light tokens.
    useEffect(() => {
        const apply = appearance => { document.body.dataset.theme = appearance?.display_mode === 'dark' ? 'dark' : 'light'; };
        apply(settings.isGlobalInbox ? {} : settings.project);
        const update = event => apply(event.detail);
        window.addEventListener('workspace-appearance',update);
        return () => { window.removeEventListener('workspace-appearance',update); delete document.body.dataset.theme; };
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
        ? <div className="main-content inbox-with-header"><header className="inbox-workspace-header"><h1 className="visually-hidden">Inbox</h1></header><div id="chat"><Chat /></div></div>
        : <WorkspacePages settings={settings} />;
}
