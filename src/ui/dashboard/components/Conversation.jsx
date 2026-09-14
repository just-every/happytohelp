import { ConversationSuggestionsProvider } from '../contexts/ConversationSuggestionsContext';
import React, { useContext, useEffect, useRef, useState } from 'react';
import Api from "../api";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import ConversationHeader from "./ConversationHeader";
import ConversationForm from "./ConversationForm";
import PropTypes from "prop-types";
import { ChatContext } from "../contexts/ChatContext";
import ScrollToBottom from 'react-scroll-to-bottom';
import ConversationAssistant from "./ConversationAssistant";
import { v4 as uuidv4 } from 'uuid';
import useConversationAssistant from "../hooks/useConversationAssistant";
import useConversationLoading from '../hooks/useConversationLoading';
import ConversationBody from "./ConversationBody";

import '../styles/components/Conversation.css';
import NoteModal from "./NoteModal";

function Conversation({ projectId, conversationId, conversation, buckets }) {
    const {
        currentAgent,
        setIsMainVisible,
        setBuckets,
        setConversationData,
        sendAction,
        fetchConversation,
        fetchBucketList,
        updateBucket,
        sendPluginEvent,
        lastConnected,
        transcriptError,
        retryTranscriptMessages,
    } = useContext(ChatContext);
    const assistant = useConversationAssistant();
    const [ isSending, setIsSending ] = useState(false);
    const [ atTop, setAtTop ] = useState(true);
    const [ files, setFiles ] = useState([]);
    const [ content, setContent ] = useState('');
    const [ loadingContent, setLoadingContent ] = useState('');
    const [ isAssistantDisabled, setIsAssistantDisabled ] = useState(false);
    const [ isNoteModalVisible, setIsNoteModalVisible ] = useState(false);
    const draftConversationIdRef = useRef(conversationId);
    const activeConversationIdRef = useRef(conversationId);

    activeConversationIdRef.current = conversationId;

    // In the global inbox the conversation dictates the project, not the page.
    const conversationProjectId = (conversation && conversation.project_id) || projectId;
    const {
        hasNextPage,
        isConversationReady,
        isLoading,
        isLoadingMore,
        isRefreshing,
        loadError,
        loadMoreError,
        loadOlderBuckets,
        retryConversationLoad,
        refreshConversation,
    } = useConversationLoading({
        conversationId,
        projectId,
        conversationProjectId,
        buckets,
        fetchConversation,
        fetchBucketList,
        setBuckets,
        setConversationData,
        setIsMainVisible,
        lastConnected,
    });
    const visibleTranscriptError = transcriptError?.conversationId === conversationId;

    const handleSendFile = selectedFiles => {
        const uploadConversationId = conversationId;
        setIsSending(true);

        const params = new FormData();
        params.append('file', selectedFiles[0]);
        params.append('conversation_id', conversationId);

        Api.create(`/projects/${ conversationProjectId }/media`, params)
            .then(data => {
                if (activeConversationIdRef.current === uploadConversationId) {
                    setFiles(currentFiles => [ ...currentFiles, data.data ]);
                    setIsSending(false);
                }
            })
            .catch(error => {
                console.log(error);
                if (activeConversationIdRef.current === uploadConversationId) {
                    setIsSending(false);
                }
            });
    };

    const handleRemoveFile = file => {
        setFiles(currentFiles => currentFiles.filter(item => item.id !== file.id));
    };

    const handleSendMessage = async (messageContent, sendAndClose = false) => {
        const lastBucket = buckets[buckets.length - 1];
        if (!lastBucket) {
            return Promise.reject(new Error('Conversation history is not ready.'));
        }

        setIsSending(true);
        const message = {
            content: messageContent,
            conversation_id: conversationId,
            media_ids: files.map(file => file.id),
            local_id: uuidv4(),
        };
        if (sendAndClose) {
            message.resolve = true;
        }

        try {
            await sendAction('sendMessage', message, conversationProjectId);
            setFiles([]);
        } finally {
            setIsSending(false);
        }
        if (sendAndClose) {
            sendPluginEvent('resolveConversation', conversation);
        }

        return Promise.resolve();
    };

    useEffect(() => {
        draftConversationIdRef.current = conversationId;
        setContent('');
        setLoadingContent('');
        setFiles([]);
        setIsSending(false);
        setIsAssistantDisabled(false);
        setIsNoteModalVisible(false);
    }, [ conversationId ]);

    const updateDraftContent = (nextContent, attachments) => {
        draftConversationIdRef.current = conversationId;
        setContent(nextContent);
        if (Array.isArray(attachments)) {
            setFiles(currentFiles => Array.from(new Map([ ...currentFiles, ...attachments ].map(file => [ file.id, file ])).values()));
        }
    };
    const isDraftCurrent = draftConversationIdRef.current === conversationId;
    const draftContent = isDraftCurrent ? content : '';
    const draftFiles = isDraftCurrent ? files : [];
    const draftLoadingContent = isDraftCurrent ? loadingContent : '';
    const infiniteRef = useInfiniteScroll({
        loading: isLoading || isRefreshing || isLoadingMore,
        hasNextPage: isConversationReady && hasNextPage && !loadMoreError,
        onLoadMore: loadOlderBuckets,
        scrollContainer: 'parent',
        direction: 'to-top',
    });

    if (!conversation) {
        return <div className="chat flex-column justify-content-center text-center">
            <div className="container-xxl">
                { loadError ? <p className="conversation-load-error" role="alert">
                    Couldn’t load this conversation. <button type="button" onClick={ retryConversationLoad }>Retry</button>
                </p> : <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div> }
            </div>
        </div>;
    }

    return (
        <ConversationSuggestionsProvider
            key={ conversationId }
            conversationId={ conversationId }
            message={ draftContent }
            disabled={ isAssistantDisabled || !isConversationReady || isLoading || isSending }
            onMessageChange={ updateDraftContent }
            onLoadingMessageChange={ nextLoadingContent => {
                draftConversationIdRef.current = conversationId;
                setLoadingContent(nextLoadingContent);
            } }>
            <div className="chat">
                <div className="chat-body">
                    <ConversationHeader
                        conversation={ conversation }
                        onPanelToggle={ assistant.toggle }
                        onLocalPanelOpen={ assistant.openLocal }
                        isPanelVisible={ assistant.isVisible }
                        panelToggleRef={ assistant.toggleRef }
                        localPanelToggleRef={ assistant.localToggleRef }
                        isLoading={ isLoading || isLoadingMore }
                        atTop={ atTop }
                    />

                    <ScrollToBottom className="chat-content" followButtonClassName="follow-button-hide" forwardRef={ infiniteRef }>
                        { loadError && <p className="conversation-load-error px-2 py-2" role="alert">
                            Couldn’t refresh this conversation. <button type="button" onClick={ retryConversationLoad }>Retry</button>
                        </p> }
                        { visibleTranscriptError && <p className="conversation-load-error px-2 py-2" role="alert">
                            Couldn’t load newer messages. <button type="button" onClick={ () => retryTranscriptMessages() }>Retry</button>
                        </p> }
                        { isLoading && <div className="text-center px-2 py-2" role="status">Loading conversation...</div> }
                        <ConversationBody conversation={ conversation } buckets={ buckets } setAtTop={ setAtTop } />
                        { loadMoreError && <p className="conversation-load-error px-2 py-2" role="alert">
                            Couldn’t load older messages. <button type="button" onClick={ loadOlderBuckets }>Retry</button>
                        </p> }
                    </ScrollToBottom>

                    <ConversationForm
                        key={ conversationId }
                        content={ draftContent }
                        conversationId={ conversationId }
                        projectId={ conversationProjectId }
                        loadingContent={ draftLoadingContent }
                        onSendMessage={ handleSendMessage }
                        onFileSelect={ handleSendFile }
                        onFileRemove={ handleRemoveFile }
                        onAddNote={ () => setIsNoteModalVisible(true) }
                        onContentChange={ updateDraftContent }
                        onAssistantDisabledChange={ setIsAssistantDisabled }
                        files={ draftFiles }
                        isEnabled={ isConversationReady && buckets.length > 0 && !isLoading && !isSending }
                    />
                </div>

                { assistant.isVisible && <button type="button" className="conversation-assistant-backdrop" onClick={ assistant.close } aria-label="Close conversation panel overlay" tabIndex={ -1 } /> }
                <ConversationAssistant
                    closeButtonRef={ assistant.closeRef }
                    conversation={ conversation }
                    conversationId={ conversationId }
                    isVisible={ assistant.isVisible }
                    onClose={ assistant.close }
                    onInsertDraft={ updateDraftContent }
                    onConversationChanged={ refreshConversation }
                    panelRef={ assistant.panelRef }
                    requestedTab={ assistant.requestedTab }
                    requestedTabVersion={ assistant.requestedTabVersion }
                />

                { isNoteModalVisible && <NoteModal conversation={ conversation } onHide={ () => setIsNoteModalVisible(false) } /> }
            </div>
        </ConversationSuggestionsProvider>
    );
}

Conversation.propTypes = {
    conversationId: PropTypes.string,
    projectId: PropTypes.string,
    conversation: PropTypes.object,
    buckets: PropTypes.array,
};

export default Conversation;
