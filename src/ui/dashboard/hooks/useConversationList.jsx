import { useCallback, useEffect, useRef, useState } from 'react';
import {
    appendConversationPage,
    hasNextConversationPage,
    isAbortedConversationRequest,
    refreshConversationPages,
} from '../components/conversationListPagination';

function useConversationList({
    conversationLists,
    setConversationLists,
    fetchConversationList,
    inboxDataVersion,
    filter,
    listKey,
}) {
    const [ isInitialLoading, setIsInitialLoading ] = useState(false);
    const [ isRefreshing, setIsRefreshing ] = useState(false);
    const [ isLoadingMore, setIsLoadingMore ] = useState(false);
    const [ hasNextPage, setHasNextPage ] = useState(false);
    const [ refreshError, setRefreshError ] = useState(null);
    const [ loadMoreError, setLoadMoreError ] = useState(null);
    const fetchConversationListRef = useRef(fetchConversationList);
    const conversationListsRef = useRef(conversationLists);
    const listRequestScope = useRef(0);
    const activeRequest = useRef(null);
    const queuedRefreshScope = useRef(null);
    const startRefreshRef = useRef(null);
    const refreshVersion = useRef(inboxDataVersion);

    fetchConversationListRef.current = fetchConversationList;
    conversationListsRef.current = conversationLists;

    const abortActiveRequest = useCallback(() => {
        activeRequest.current?.controller.abort();
        activeRequest.current = null;
    }, []);

    const startRefresh = useCallback(scope => {
        if (scope !== listRequestScope.current) {
            return;
        }

        if (activeRequest.current) {
            queuedRefreshScope.current = scope;
            return;
        }

        const existingConversations = conversationListsRef.current[listKey] || [];
        const controller = new AbortController();
        const request = { controller, scope };
        activeRequest.current = request;
        setRefreshError(null);
        setLoadMoreError(null);

        if (existingConversations.length === 0) {
            setIsInitialLoading(true);
        } else {
            setIsRefreshing(true);
        }

        refreshConversationPages({
            fetchPage: fetchConversationListRef.current,
            filter,
            loadedCount: existingConversations.length,
            signal: controller.signal,
            isCurrent: () => activeRequest.current === request && scope === listRequestScope.current,
        })
            .then(refreshed => {
                if (!refreshed || activeRequest.current !== request || scope !== listRequestScope.current) {
                    return;
                }

                setHasNextPage(refreshed.hasNextPage);
                setConversationLists(lists => ({
                    ...lists,
                    [listKey]: refreshed.conversations,
                }));
            })
            .catch(error => {
                if (activeRequest.current !== request || scope !== listRequestScope.current || isAbortedConversationRequest(error)) {
                    return;
                }

                console.error('Unable to load conversations', error);
                setRefreshError(error);
            })
            .finally(() => {
                if (activeRequest.current !== request || scope !== listRequestScope.current) {
                    return;
                }

                activeRequest.current = null;
                setIsInitialLoading(false);
                setIsRefreshing(false);

                if (queuedRefreshScope.current === scope) {
                    queuedRefreshScope.current = null;
                    startRefreshRef.current(scope);
                }
            });
    }, [ filter, listKey, setConversationLists ]);

    startRefreshRef.current = startRefresh;

    useEffect(() => {
        const scope = ++listRequestScope.current;
        abortActiveRequest();
        queuedRefreshScope.current = null;
        setIsInitialLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        setHasNextPage(false);
        setRefreshError(null);
        setLoadMoreError(null);
        startRefresh(scope);

        return () => {
            if (scope === listRequestScope.current) {
                listRequestScope.current += 1;
                queuedRefreshScope.current = null;
                abortActiveRequest();
            }
        };
    }, [ abortActiveRequest, listKey, startRefresh ]);

    useEffect(() => {
        if (refreshVersion.current === inboxDataVersion) {
            return;
        }

        refreshVersion.current = inboxDataVersion;
        startRefresh(listRequestScope.current);
    }, [ inboxDataVersion, startRefresh ]);

    const loadMore = useCallback(() => {
        const scope = listRequestScope.current;
        const currentList = conversationListsRef.current[listKey] || [];
        const lastConversation = currentList[currentList.length - 1];

        if (activeRequest.current || !hasNextPage || !lastConversation) {
            return;
        }

        const controller = new AbortController();
        const request = { controller, scope };
        activeRequest.current = request;
        setLoadMoreError(null);
        setIsLoadingMore(true);

        fetchConversationListRef.current({
            ...filter,
            last_message_before: lastConversation.last_message_at,
            last_conversation_before: lastConversation.id,
        }, { signal: controller.signal })
            .then(result => {
                if (activeRequest.current !== request || scope !== listRequestScope.current) {
                    return;
                }

                setHasNextPage(hasNextConversationPage(result));
                setConversationLists(lists => ({
                    ...lists,
                    [listKey]: appendConversationPage(lists[listKey] || [], result),
                }));
            })
            .catch(error => {
                if (activeRequest.current !== request || scope !== listRequestScope.current || isAbortedConversationRequest(error)) {
                    return;
                }

                console.error('Unable to load more conversations', error);
                setLoadMoreError(error);
            })
            .finally(() => {
                if (activeRequest.current !== request || scope !== listRequestScope.current) {
                    return;
                }

                activeRequest.current = null;
                setIsLoadingMore(false);

                if (queuedRefreshScope.current === scope) {
                    queuedRefreshScope.current = null;
                    startRefreshRef.current(scope);
                }
            });
    }, [ filter, hasNextPage, listKey, setConversationLists ]);

    return {
        conversations: conversationLists[listKey] || [],
        hasNextPage,
        isInitialLoading,
        isLoadingMore,
        isRefreshing,
        loadMore,
        loadMoreError,
        refreshError,
        retryRefresh: () => startRefresh(listRequestScope.current),
    };
}

export default useConversationList;
