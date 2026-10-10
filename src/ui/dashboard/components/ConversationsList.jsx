import React, { useCallback, useContext, useMemo } from 'react';
import {ActivationChecklist} from '../../native/activation';
import DemoInboxInvitation from './DemoInboxInvitation';
import ConversationItem from "./ConversationItem";
import useInfiniteScroll from 'react-infinite-scroll-hook';
import { ChatContext } from "../contexts/ChatContext";
import { useNavigate } from '@tanstack/react-router';
import { useDashboardSettings, useDashboardLocation } from '../../native/dashboard-state';
import InboxSearch from './InboxSearch';
import { inboxViewFilter, inboxViewPhrase, normalizeInboxView } from './inboxViewDefinitions';
import useConversationList from '../hooks/useConversationList';
import useScrollEdge from '../hooks/useScrollEdge';

function ConversationsList({ canTryDemo = false, hideBehindConversation = false }) {
    const {
        conversationLists,
        setConversationLists,
        fetchConversationList,
        inboxDataVersion,
        inboxViewCounts,
    } = useContext(ChatContext);
    const settings = useDashboardSettings();
    const searchParams = useDashboardLocation().search;
    const navigate = useNavigate();
    const selectedView = normalizeInboxView(searchParams.view, inboxViewCounts);
    const searchQuery = searchParams.q == null ? '' : String(searchParams.q);
    const filter = useMemo(() => inboxViewFilter(selectedView, searchQuery), [ selectedView, searchQuery ]);
    const listKey = JSON.stringify(filter);
    const {
        conversations,
        hasNextPage,
        isInitialLoading,
        isLoadingMore,
        isRefreshing,
        loadMore,
        loadMoreError,
        refreshError,
        retryRefresh,
    } = useConversationList({
        conversationLists,
        setConversationLists,
        fetchConversationList,
        inboxDataVersion,
        filter,
        listKey,
    });
    const [ sentryRef, { rootRef } ] = useInfiniteScroll({
        loading: isInitialLoading || isRefreshing || isLoadingMore,
        hasNextPage: hasNextPage && !refreshError && !loadMoreError && conversations.length > 0,
        onLoadMore: loadMore,
    });
    const { ref: scrollEdgeRef, isScrolled } = useScrollEdge();
    const setListRefs = useCallback(element => {
        rootRef(element);
        scrollEdgeRef(element);
    }, [ rootRef, scrollEdgeRef ]);

    const handleSearch = query => {
        navigate({ search: { view: selectedView, ...(query.trim() ? { q: query.trim() } : {}) } });
    };

    return (
        <div className={ `sidebar conversation-inbox px-4 py-3${isScrolled ? ' is-scrolled' : ''}` } aria-hidden={ hideBehindConversation ? 'true' : undefined } inert={ hideBehindConversation || undefined }>
            <div className="conversation-inbox-header">
                <InboxSearch query={ searchQuery } viewPhrase={ inboxViewPhrase(selectedView) } onSearch={ handleSearch } />
            </div>
            <div className="conversation-list-items" ref={ setListRefs }>
                { conversations.map(conversation => <ConversationItem key={ conversation.id } conversation={ conversation } />) }
                { isInitialLoading && conversations.length === 0 && <p className="text-center" role="status">Loading conversations...</p> }
                { !isInitialLoading && !refreshError && !hasNextPage && conversations.length === 0 && (
                    searchQuery.trim()
                        ? <p className="conversation-empty-state" role="status">No results for “{ searchQuery.trim() }” in { inboxViewPhrase(selectedView) }. Search looks at customer names and email addresses.</p>
                        : <>
                            {!canTryDemo && <p className="conversation-empty-state">No conversations match this view.</p>}
                            {canTryDemo && <div className="conversation-empty-state d-xl-none"><ActivationChecklist projectId={settings.project.id} compact/><DemoInboxInvitation /></div>}
                        </>
                ) }
                { refreshError?.status === 400 && <p className="conversation-search-notice" role="alert">{ refreshError.message }</p> }
                { refreshError && refreshError.status !== 400 && <p className="conversation-list-error" role="alert">
                    {conversations.length ? 'Couldn’t refresh conversations.' : 'Couldn’t load conversations.'}
                    <button type="button" onClick={ retryRefresh }>Retry</button>
                </p> }
                { isLoadingMore && <p className="text-center" role="status">Loading more conversations...</p> }
                { loadMoreError && conversations.length > 0 && <p className="conversation-list-error" role="alert">
                    Couldn’t load more conversations. <button type="button" onClick={ loadMore }>Retry</button>
                </p> }
                { hasNextPage && !isInitialLoading && !isRefreshing && !isLoadingMore && !refreshError && !loadMoreError && conversations.length > 0 && (
                    <div className="conversation-list-sentinel" ref={ sentryRef } aria-hidden="true" />
                ) }
            </div>
        </div>
    );
}

export default ConversationsList;
