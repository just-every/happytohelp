import React, { useCallback, useContext, useMemo } from 'react';
import ConversationItem from "./ConversationItem";
import useInfiniteScroll from 'react-infinite-scroll-hook';
import { ChatContext } from "../contexts/ChatContext";
import { useSearchParams } from 'react-router-dom';
import InboxSearch from './InboxSearch';
import { getInboxView, inboxViewFilter, normalizeInboxView } from './inboxViewDefinitions';
import useConversationList from '../hooks/useConversationList';
import useScrollEdge from '../hooks/useScrollEdge';

function ConversationsList() {
    const {
        conversationLists,
        setConversationLists,
        fetchConversationList,
        inboxDataVersion,
    } = useContext(ChatContext);
    const [ searchParams, setSearchParams ] = useSearchParams();
    const selectedView = normalizeInboxView(searchParams.get('view'));
    const searchQuery = searchParams.get('q') || '';
    const filter = useMemo(() => inboxViewFilter(selectedView, searchQuery), [ selectedView, searchQuery ]);
    const listKey = JSON.stringify(filter);
    const view = getInboxView(selectedView);
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
        const params = new URLSearchParams();
        params.set('view', selectedView);
        if (query.trim()) {
            params.set('q', query.trim());
        }
        setSearchParams(params);
    };

    return (
        <div className={ `sidebar conversation-inbox px-4 py-3${isScrolled ? ' is-scrolled' : ''}` }>
            <div className="conversation-inbox-header">
                <InboxSearch query={ searchQuery } viewLabel={ view.label } onSearch={ handleSearch } />
            </div>
            <div className="conversation-list-items" ref={ setListRefs }>
                { conversations.map(conversation => <ConversationItem key={ conversation.id } conversation={ conversation } />) }
                { isInitialLoading && conversations.length === 0 && <p className="text-center" role="status">Loading conversations...</p> }
                { !isInitialLoading && !refreshError && !hasNextPage && conversations.length === 0 && (
                    <p className="conversation-empty-state">No conversations match this view.</p>
                ) }
                { refreshError && <p className="conversation-list-error" role="alert">
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
