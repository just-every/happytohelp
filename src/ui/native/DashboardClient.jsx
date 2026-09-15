import React, { useEffect } from 'react';
import { createWorkspaceTheme, normalizeWorkspaceMode } from './workspaceModes';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Chat from '../dashboard/components/Chat';
import { Provider } from '../dashboard/contexts/ChatContext';
import WorkspacePages from './WorkspacePages';
import Navigation from './Navigation';
export default function DashboardClient() {
    const settings = window.chatSettings;
    const isInbox = location.pathname === '/' || location.pathname.startsWith('/conversations') || /\/conversations(?:\/|$)/.test(location.pathname);
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
    return <BrowserRouter><Navigation settings={settings} /><Provider {...settings} conversationLists={{}} conversationData={{}} projectId={settings.project?.id}>
        <Routes>
            <Route path="/" element={<div className="main-content"><div id="chat"><Chat /></div></div>} />
            <Route path="/conversations" element={<div className="main-content"><div id="chat"><Chat /></div></div>} />
            <Route path="/conversations/:urlConversationId" element={<div className="main-content"><div id="chat"><Chat /></div></div>} />
            <Route path="/projects/:urlProjectId/conversations" element={<div className="main-content"><div id="chat"><Chat /></div></div>} />
            <Route path="/projects/:urlProjectId/conversations/:urlConversationId" element={<div className="main-content"><div id="chat"><Chat /></div></div>} />
            <Route path="*" element={<WorkspacePages settings={settings} />} />
        </Routes>
    </Provider></BrowserRouter>;
}
