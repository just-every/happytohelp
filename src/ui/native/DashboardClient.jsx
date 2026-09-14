import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Chat from '../dashboard/components/Chat';
import { Provider } from '../dashboard/contexts/ChatContext';
import WorkspacePages from './WorkspacePages';
import Navigation from './Navigation';
export default function DashboardClient() {
    const settings = window.chatSettings;
    const isInbox = location.pathname === '/' || location.pathname.startsWith('/conversations') || /\/conversations(?:\/|$)/.test(location.pathname);
    useEffect(() => {
        document.body.className = `${isInbox ? 'conversation-workspace' : 'workspace-page'} theme-happytohelp`;
    }, [isInbox]);
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
