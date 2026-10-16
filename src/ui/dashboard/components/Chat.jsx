import React, { useContext, useEffect, useState } from 'react';
import ConversationsList from "./ConversationsList";
import { Conversation as LazyConversation } from '../../native/inbox-page-code';
import InboxStart from './InboxStart';
import { useDashboardSettings, useDashboardLocation } from '../../native/dashboard-state';
import { TwoBubbles } from '../../native/drawings';
import { updateNavigationUnreadBadge } from './navigationInboxBadge';
import { ChatContext } from "../contexts/ChatContext";
import useInboxRoute from "../hooks/useInboxRoute";

export default function Chat({ Conversation = LazyConversation }) {
    const [ isCompactViewport, setIsCompactViewport ] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1199.98px)').matches);
    const { urlConversationId } = useInboxRoute();
    const settings = useDashboardSettings();
    const search = useDashboardLocation().search;
    const {
        currentAgent,
        isMainVisible,
        activeConversationId,
        setActiveConversationId,
        activeProjectId,
        conversationData,
        buckets,
        inboxViewCounts,
    } = useContext(ChatContext);

    const isFirstRun = !settings.isGlobalInbox && settings.project?.role === 'owner'
        && !settings.project?.is_demo && !String(search.q||'').trim() && (!search.view || ['mine','open'].includes(search.view)) && inboxViewCounts.open === 0 && inboxViewCounts.closed === 0;

    useEffect(() => {
        setActiveConversationId(urlConversationId);
        return () => setActiveConversationId(null);
    }, [ urlConversationId, setActiveConversationId ]);

    useEffect(() => {
        const compactViewport = window.matchMedia('(max-width: 1199.98px)');
        const updateViewport = () => setIsCompactViewport(compactViewport.matches);
        updateViewport();
        compactViewport.addEventListener('change', updateViewport);
        return () => compactViewport.removeEventListener('change', updateViewport);
    }, []);

    useEffect(() => {
        updateNavigationUnreadBadge(inboxViewCounts.unread);
    }, [ inboxViewCounts ]);

    return (
        <>
            <div className="layout">
                <ConversationsList isFirstRun={isFirstRun} startHere={isFirstRun && isCompactViewport} hideBehindConversation={isMainVisible && isCompactViewport} />

                <div className={ isMainVisible ? 'main main-visible' : 'main' }>
                    {activeConversationId && <Conversation
                        projectId={ activeProjectId }
                        conversationId={ activeConversationId }
                        conversation={ conversationData[activeConversationId] }
                        buckets={ buckets.filter(bucket => bucket.conversation_id === activeConversationId) } />}
                    {!activeConversationId && (isFirstRun
                        ? isCompactViewport ? null : <div className="chat inbox-start-pane"><InboxStart name={ currentAgent.name } penLine/></div>
                        : <div className="chat inbox-welcome">
                            <TwoBubbles/>
                            <h4>{ `Hey, ${currentAgent.name}!` }</h4>
                            <p>Please select a chat to start messaging.</p>
                        </div>)}
                </div>
            </div>
        </>
    );
}
