import React, { useContext, useEffect } from 'react';
import ConversationsList from "./ConversationsList";
import Conversation from "./Conversation";
import InboxViews from './InboxViews';
import { updateNavigationUnreadBadge } from './navigationInboxBadge';
import { ChatContext } from "../contexts/ChatContext";
import { useParams } from "react-router-dom";

export default function Chat() {
    const { urlConversationId } = useParams();
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

    useEffect(() => {
        setActiveConversationId(urlConversationId);
    }, [ urlConversationId ]);

    useEffect(() => {
        updateNavigationUnreadBadge(inboxViewCounts.unread);
    }, [ inboxViewCounts ]);

    return (
        <>
            <InboxViews />

            <div className="layout">
                <ConversationsList />

                <div className={ isMainVisible ? 'main main-visible' : 'main' }>
                    {activeConversationId && <Conversation
                        projectId={ activeProjectId }
                        conversationId={ activeConversationId }
                        conversation={ conversationData[activeConversationId] }
                        buckets={ buckets.filter(bucket => bucket.conversation_id === activeConversationId) } />}
                    {!activeConversationId && <div className="chat flex-column justify-content-center text-center">
                        <div className="container-xxl">
                            <h4>{ `Hey, ${currentAgent.name}!` }</h4>
                            <p>Please select a chat to start messaging.</p>
                        </div>
                    </div>}
                </div>
            </div>
        </>
    );
}
