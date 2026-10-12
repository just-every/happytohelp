import React, { useContext, useEffect, useState } from 'react';
import ConversationsList from "./ConversationsList";
import Conversation from "./Conversation";
import {ActivationChecklist} from '../../native/activation';
import InboxNextSteps from './InboxNextSteps';
import { useDashboardSettings, useDashboardLocation } from '../../native/dashboard-state';
import InboxViews from './InboxViews';
import { updateNavigationUnreadBadge } from './navigationInboxBadge';
import { ChatContext } from "../contexts/ChatContext";
import useInboxRoute from "../hooks/useInboxRoute";

export default function Chat() {
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

    const canTryDemo = !settings.isGlobalInbox && settings.project?.role === 'owner'
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
            <InboxViews />

            <div className="layout">
                <ConversationsList canTryDemo={canTryDemo && isCompactViewport} hideBehindConversation={isMainVisible && isCompactViewport} />

                <div className={ isMainVisible ? 'main main-visible' : 'main' }>
                    {activeConversationId && <Conversation
                        projectId={ activeProjectId }
                        conversationId={ activeConversationId }
                        conversation={ conversationData[activeConversationId] }
                        buckets={ buckets.filter(bucket => bucket.conversation_id === activeConversationId) } />}
                    {!activeConversationId && <div className={`chat flex-column justify-content-center text-center${canTryDemo ? ' activation-empty-inbox' : ''}`}>
                        <div className="container-xxl">
                            <h4>{ `Hey, ${currentAgent.name}!` }</h4>
                            {canTryDemo ? !isCompactViewport && <div><ActivationChecklist projectId={settings.project.id}/><InboxNextSteps /></div> : <p>Please select a chat to start messaging.</p>}
                        </div>
                    </div>}
                </div>
            </div>
        </>
    );
}
