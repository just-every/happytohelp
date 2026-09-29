import React, { useContext, useEffect, useState } from 'react';
import ConversationsList from "./ConversationsList";
import Conversation from "./Conversation";
import DemoInboxInvitation from './DemoInboxInvitation';
import { useDashboardSettings } from '../../native/dashboard-state';
import InboxViews from './InboxViews';
import { updateNavigationUnreadBadge } from './navigationInboxBadge';
import { ChatContext } from "../contexts/ChatContext";
import useInboxRoute from "../hooks/useInboxRoute";

export default function Chat() {
    const [ isCompactViewport, setIsCompactViewport ] = useState(false);
    const { urlConversationId } = useInboxRoute();
    const settings = useDashboardSettings();
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

    const canTryDemo = !settings.isGlobalInbox && settings.project?.role === 'owner'
        && !settings.project?.is_demo && inboxViewCounts.open === 0 && inboxViewCounts.closed === 0;

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
            <InboxViews />

            <div className="layout">
                <ConversationsList canTryDemo={canTryDemo} hideBehindConversation={isMainVisible && isCompactViewport} />

                <div className={ isMainVisible ? 'main main-visible' : 'main' }>
                    {activeConversationId && <Conversation
                        projectId={ activeProjectId }
                        conversationId={ activeConversationId }
                        conversation={ conversationData[activeConversationId] }
                        buckets={ buckets.filter(bucket => bucket.conversation_id === activeConversationId) } />}
                    {!activeConversationId && <div className="chat flex-column justify-content-center text-center">
                        <div className="container-xxl">
                            <h4>{ `Hey, ${currentAgent.name}!` }</h4>
                            {canTryDemo ? <div className="d-none d-xl-block"><DemoInboxInvitation /></div> : <p>Please select a chat to start messaging.</p>}
                        </div>
                    </div>}
                </div>
            </div>
        </>
    );
}
