import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from "prop-types";
import Api from "../api";
import useWindowFocus from "use-window-focus";
import usePluginMessageEvent from "../hooks/usePluginMessageEvent";
import useTranscriptEvents from '../hooks/useTranscriptEvents';
import { sendCommand, connectConversation, connectProject } from '../../native/transport';

import useInboxRefresh from '../hooks/useInboxRefresh';
import { affectsInboxListing } from '../utils/inboxRefreshScheduler';
import { mergeConversationSuggestionMetadata } from '../hooks/replySuggestionLifecycle';


import Favcount from '../favcount';

export const ChatContext = createContext({});

export const Provider = (props) => {
    const {
        activeConversationId: initialActiveConversationId,
        conversationLists: initialConversationLists,
        conversationData: initialConversationData,
        agents: initialAgents,
        ais: initialAis,
        plugins: initialPlugins,
        currentAgent: initialCurrentAgent,
        apiUrl: initialApiUrl,
        agentToken: initialAgentToken,
        publicKey,
        wsUrl: initialWsUrl,
        projectId,
        projects,
        isGlobalInbox,
        children,
    } = props;

    const [ lastConnected, setLastConnected ] = useState(0);
    const [ activeConversationId, setActiveConversationId ] = useState(initialActiveConversationId);
    const [ conversationLists, setConversationLists ] = useState(initialConversationLists);
    const [ conversationData, setConversationData ] = useState(initialConversationData);
    const [ buckets, setBuckets ] = useState([]);
    const [ agents ] = useState(initialAgents);
    const [ ais ] = useState(initialAis);
    const [ currentAgent ] = useState(initialCurrentAgent);
    const [ apiUrl ] = useState(initialApiUrl);
    const [ agentToken ] = useState(initialAgentToken);
    const [ wsUrl ] = useState(initialWsUrl);
    // Websocket state is kept per project: the global inbox holds one connection per
    // project, since connections (and their encryption keys) are project scoped.
    // conversation id -> project id, so callbacks can address the right connection
    const conversationProjects = useRef({});
    const [ isMainVisible, setIsMainVisible ] = useState(false);
    const [ unreadMessages, setUnreadMessages ] = useState([]);
    const isWindowFocused = useWindowFocus();
    const pluginsRef = useRef([]);
    const favicon = useRef(new Favcount("/img/icon.svg", "/img/icon.svg"));
    const provisionalReplies = useRef(new Map());
    const queuedReadMessageIds = useRef(new Set());

    /**
     * Per-project settings (agents, AIs, plugins, encryption key).
     */
    const getProject = projectIdToGet => (projectIdToGet && projects[projectIdToGet]) ? projects[projectIdToGet] : {};

    const agentsFor = projectIdToGet => getProject(projectIdToGet).agents || agents;
    const aisFor = projectIdToGet => getProject(projectIdToGet).ais || ais;
    const pluginsFor = projectIdToGet => getProject(projectIdToGet).plugins || initialPlugins || [];
    const publicKeyFor = projectIdToGet => getProject(projectIdToGet).publicKey || publicKey;

    const { inboxViewCounts, inboxDataVersion, refreshInboxData, fetchInboxViewCounts } = useInboxRefresh({
        isGlobalInbox, projectId, lastConnected, isWindowFocused,
    });

    /**
     * Remember which project a conversation belongs to.
     */
    const rememberConversationProject = conversation => {
        if (conversation && conversation.id && conversation.project_id) {
            conversationProjects.current[conversation.id] = conversation.project_id;
        }

        return conversation;
    }

    /**
     * Resolve the project a conversation belongs to.
     *
     * Outside of the global inbox there is only ever one project.
     */
    const projectIdFor = conversationId => {
        if (!isGlobalInbox) {
            return projectId;
        }

        return conversationId ? (conversationProjects.current[conversationId] || null) : null;
    }

    // Project of the conversation currently open. Known as soon as it appears in either
    // the list or the loaded conversation data.
    const activeProjectId = isGlobalInbox
        ? ((conversationData[activeConversationId] && conversationData[activeConversationId].project_id) || projectIdFor(activeConversationId))
        : projectId;

    // Kept in refs so websocket callbacks registered once at connect time stay current
    const activeConversationIdRef = useRef(null);
    const activeProjectIdRef = useRef(null);
    activeConversationIdRef.current = activeConversationId;
    activeProjectIdRef.current = activeProjectId;

    // Projects we hold a websocket connection for
    const connectedProjectIds = isGlobalInbox
        ? Object.keys(projects)
        : (projectId ? [ projectId ] : []);

    const plugins = isGlobalInbox ? pluginsFor(activeProjectId) : (initialPlugins || []);

    const sendPluginEvent = (type, payload, targetWindow = null) => {
        pluginsRef.current.forEach(frame => {
            if (!frame?.contentWindow || targetWindow && frame.contentWindow !== targetWindow) return;
            const origin = frame.dataset.h2hPluginOrigin;
            if (origin && new URL(frame.src).origin === origin) frame.contentWindow.postMessage({happytohelp: true, type, payload}, origin);
        });
    };

    const decrementUnreadMessagesCount = (conversationId, count) => {
        setConversationLists(lists => {
            const updatedLists = {};
            Object.keys(lists).forEach(listKey => {
                updatedLists[listKey] = lists[listKey].map(conversation => {
                    if (conversation.id === conversationId) {
                        return {
                            ...conversation,
                            unread_contact_messages_count: Math.max(0, conversation.unread_contact_messages_count - count),
                        };
                    }

                    return conversation;
                })
            });

            return updatedLists;
        });
    }

    const resolveConversation = (conversation, resolved) => {
        if (resolved === undefined) {
            resolved = true;
        }

        updateConversation(conversation.id, { resolved_at: resolved ? new Date() : null });

        return Api.update(`/projects/${ conversation.project_id }/conversations/${ conversation.id }`, { resolved })
            .then(data => {
                updateConversation(data.data.id, data.data);
                sendPluginEvent('resolveConversation', data.data);
            })
            .catch(error => {
                console.error(error);
            });
    }

    const updateConversation = (conversationId, updated, options = {}) => {
        if(!conversationId) {
            console.error("updateConversation called with no conversation id", updated);
            return;
        }

        rememberConversationProject({ id: conversationId, ...updated });
        const refreshListing = affectsInboxListing(updated);

        if (refreshListing) setConversationLists(lists => {
            const newLists = {};
            Object.keys(lists).forEach(listKey => {
                newLists[listKey] = lists[listKey].map(conversation => {
                    if (conversation.id === conversationId) {
                        return mergeConversationSuggestionMetadata(conversation, updated, options);
                    }

                    return conversation;
                })
            });

            return newLists;
        });

        setConversationData(_conversationData => {
            if (!_conversationData[conversationId]) {
                return _conversationData;
            }

            return {
                ..._conversationData,
                [conversationId]: mergeConversationSuggestionMetadata(_conversationData[conversationId], updated, options),
            };
        });

        if (refreshListing) refreshInboxData();
    }
    const updateBucket = (id, updated) => {
        setBuckets(buckets => {
            let found = false;
            let newBuckets = buckets.map(bucket => {
                if (bucket.id === id) {
                    found = true;
                    return { ...bucket, ...updated };
                }

                return bucket;
            });

            if (!found) {
                newBuckets.unshift(updated);
            }

            return newBuckets;
        });
    }

    const markUnreadMessagesAsRead = (messages, messagesProjectId) => {
        const unread = messages
            .filter(message => {
                if (!message.id || !message.contact_id || message.read_by_agents?.[currentAgent.id]) return false;
                const key = `${messagesProjectId || projectIdFor(message.conversation_id)}:${message.id}`;
                if (queuedReadMessageIds.current.has(key)) return false;
                queuedReadMessageIds.current.add(key);
                return true;
            })
            .map(message => {
                decrementUnreadMessagesCount(message.conversation_id, 1);

                return { id: message.id, projectId: messagesProjectId || projectIdFor(message.conversation_id) };
            });

        if (unread.length > 0) {
            // If any unread messages by contact received - mark them as read
            setUnreadMessages(oldUnreadMessages => [...oldUnreadMessages, ...unread]);
        }
    }

    const filterUniqueItems = data => {
        let ids = [];
        return data.filter(item => {
            if (ids.includes(item.id)) {
                return false;
            }

            ids.push(item.id);

            return true;
        });
    };

    const fetchBucket = (conversationId, bucket, params, bucketProjectId = null, options = {}) => {
        const bucketProject = bucketProjectId || projectIdFor(conversationId);

        return Api.get(`/projects/${ bucketProject }/conversations/${ conversationId }/buckets/${ bucket.id }`, params, options)
            .then(result => {
                if (options.signal?.aborted || activeConversationIdRef.current !== conversationId) return result;
                updateBucket(bucket.id, result.data);

                markUnreadMessagesAsRead(result.data.messages, bucketProject);

                return result;
            });
    }

    const fetchBucketList = (conversationId, params, bucketProjectId = null, options = {}) => {
        const bucketProject = bucketProjectId || projectIdFor(conversationId);

        return Api.get(`/projects/${ bucketProject }/conversations/${ conversationId }/buckets`, params, options)
            .then(result => {
                if (options.signal?.aborted || activeConversationIdRef.current !== conversationId) return result;
                const newBuckets = result.data;
                newBuckets.forEach(bucket => markUnreadMessagesAsRead(bucket.messages ?? [], bucketProject));
                setBuckets(buckets => filterUniqueItems([ ...newBuckets.reverse(), ...buckets ]));

                return result;
            });
    }

    const fetchConversationList = (params, options) => {
        const request = isGlobalInbox
            ? Api.get('/conversations', params, options)
            : Api.get(`/projects/${ projectId }/conversations`, params, options);

        return request.then(result => {
            (result.data || []).forEach(rememberConversationProject);

            return result;
        });
    }

    const fetchConversation = (conversationId, conversationProjectId = null, options) => {
        const conversationProject = conversationProjectId || projectIdFor(conversationId);

        // Deep links into the global inbox carry no project, so resolve it server side
        const request = conversationProject
            ? Api.get(`/projects/${ conversationProject }/conversations/${ conversationId }`, undefined, options)
            : Api.get(`/conversations/${ conversationId }`, undefined, options);

        return request.then(result => {
            rememberConversationProject(result.data);

            return result;
        });
    }

    const sendAction = async (action, data = {}, actionProjectId = null) => {
        const targetProjectId = actionProjectId || activeProjectIdRef.current || projectId;
        const conversationId = data.conversation_id || activeConversationIdRef.current;
        if (!targetProjectId) throw new Error('No project available for this action');
        const result = await sendCommand(targetProjectId, conversationId, action, data);
        if (action === 'sendMessage') {
            setLastConnected(Date.now());
            refreshInboxData();
        }
        return result;
    };

    const updateInboxMessagePreview = message => {
        setConversationLists(lists => {
            let changed = false;
            const updatedLists = Object.fromEntries(Object.entries(lists).map(([key, conversations]) => [key,
                conversations.map(conversation => {
                    if (!message.id || conversation.last_message?.id !== message.id) return conversation;
                    changed = true;
                    return { ...conversation, last_message: { ...conversation.last_message, ...message } };
                }),
            ]));
            return changed ? updatedLists : lists;
        });
    };

    const { handleMessageEvent, handleMessageUpdateEvent, transcriptError, retryTranscriptMessages } = useTranscriptEvents({
        buckets,
        setBuckets,
        activeConversationId,
        activeConversationIdRef,
        fetchBucket,
        updateBucket,
        queueUnreadMessages: markUnreadMessagesAsRead,
        refreshInboxData,
        updateInboxMessagePreview,
    });

    const handleConversationEvent = conversation => {
        rememberConversationProject(conversation);
        updateConversation(conversation.id, conversation);
    }

    const handleSettingsEvent = event => {
        updateConversation(event.conversation_id, event.payload);
    }

    const handleEventEvent = (event, eventProjectId) => {
        refreshInboxData();
        if (event.conversation_id !== activeConversationIdRef.current) return;
        fetchBucket(event.conversation_id, {id: event.bucket_id}, undefined, eventProjectId)
            .catch(error => console.error('Unable to load conversation activity', error));
    }

    const processMessage = (event, payload = {}, eventProjectId) => {

        switch (event) {
            case 'message':
                handleMessageEvent(payload, eventProjectId);
                break;
            case 'conversation':
                handleConversationEvent(payload);
                break;
            case 'messageUpdate':
                handleMessageUpdateEvent(payload);
                break;
            case 'settings':
                handleSettingsEvent(payload);
                break;
            case 'event':
                handleEventEvent(payload, eventProjectId);
                break;
        }
    }

    // Websocket listeners are registered once per connection, so they must not capture
    // a stale processMessage: dispatch through a ref that is refreshed on every render.
    const processMessageRef = useRef(processMessage);
    processMessageRef.current = processMessage;

    useEffect(() => {
        const close = connectedProjectIds.map(id => connectProject(id, () => refreshInboxData(),
            () => { refreshInboxData(); setLastConnected(Date.now()); },
            error => console.warn(error.message)));
        return () => close.forEach(dispose => dispose());
    }, [connectedProjectIds.join(',')]);

    useEffect(() => {
        if (!activeConversationId || !activeProjectId) return;
        return connectConversation(activeConversationId, frame => {
            if (frame.type === 'message') {
                // Re-read persisted enriched buckets: actor/media relationships belong to the server.
                setLastConnected(Date.now());
                refreshInboxData();
            } else if (frame.type === 'chunk') {
                const part = frame.payload;
                if (!part?.localId || typeof part.chunk !== 'string' || !Number.isInteger(part.index)) return;
                const chunks = provisionalReplies.current.get(part.localId) || new Map();
                chunks.set(part.index, part.chunk);
                provisionalReplies.current.set(part.localId, chunks);
                const content = [...chunks.entries()].sort(([a], [b]) => a - b).map(([, text]) => text).join('');
                setBuckets(current => current.map((bucket, index) => index !== current.length - 1 ? bucket : {
                    ...bucket,
                    messages: [...(bucket.messages || []).filter(message => message.local_id !== part.localId), {
                        local_id: part.localId, conversation_id: activeConversationId,
                        content, agent: part.agent, agent_id: part.agent?.id,
                    }],
                }));
            } else if (frame.type === 'reply_cancelled') {
                provisionalReplies.current.delete(frame.payload?.local_id);
                setBuckets(current => current.map(bucket => ({ ...bucket,
                    messages: (bucket.messages || []).filter(message => message.local_id !== frame.payload?.local_id),
                })));
            } else if (frame.event) {
                processMessageRef.current(frame.event, frame.payload, activeProjectId);
            } else if (frame.type === 'delta') {
                processMessageRef.current('messageUpdate', frame, activeProjectId);
            } else {
                setLastConnected(Date.now());
            }
        }, () => setLastConnected(Date.now()), error => console.warn(error.message));
    }, [activeConversationId, activeProjectId]);

    useEffect(() => {
        setBuckets([]);
        provisionalReplies.current.clear();
        if (activeConversationId && activeProjectId) {
            sendAction('setConversationId', { id: activeConversationId }, activeProjectId);
        }
    }, [ activeConversationId, activeProjectId ]);

    useEffect(() => {
        pluginsRef.current = pluginsRef.current.slice(0, plugins.length);
    }, [ plugins ]);

    useEffect(() => {
        if (isWindowFocused && unreadMessages.length > 0) {
            // markAsRead is handled by the connection holding the conversation, so group by project
            const idsByProject = {};
            unreadMessages.forEach(unread => {
                const unreadProjectId = unread.projectId || activeProjectIdRef.current;
                if (!unreadProjectId) {
                    return;
                }
                if (!idsByProject[unreadProjectId]) {
                    idsByProject[unreadProjectId] = [];
                }
                if (!idsByProject[unreadProjectId].includes(unread.id)) idsByProject[unreadProjectId].push(unread.id);
            });

            Object.keys(idsByProject).forEach(unreadProjectId => {
                const ids = idsByProject[unreadProjectId];
                sendAction('markAsRead', { ids }, unreadProjectId)
                    .catch(error => {
                        console.error('Unable to mark conversation messages as read', error);
                        refreshInboxData();
                    })
                    .finally(() => ids.forEach(id => queuedReadMessageIds.current.delete(`${unreadProjectId}:${id}`)));
            });

            setUnreadMessages([]);
            refreshInboxData();
        }
    }, [ isWindowFocused, unreadMessages, refreshInboxData ] );

    useEffect(() => {
        sendPluginEvent('setConversation', conversationData[activeConversationId]);
    }, [ conversationData[activeConversationId] ]);

    useEffect(() => {
        if (Number.isFinite(inboxViewCounts.open)) {
            favicon.current.set(inboxViewCounts.open);
        }
    }, [ inboxViewCounts ]);

    usePluginMessageEvent(
        event => sendPluginEvent('setConversation', conversationData[activeConversationId], event.source),
        'getConversation'
    );

    usePluginMessageEvent(event => {
        const conversation = conversationData[activeConversationId];
        if (!conversation || event.data.payload !== conversation.id) {
            sendPluginEvent('error', {command: 'resolveConversation', message: 'Plugin may resolve only the active conversation'}, event.source);
            return;
        }
        resolveConversation(conversation, true);
    }, 'resolveConversation');

    const chatContext = {
        activeConversationId,
        setActiveConversationId,
        conversationLists,
        setConversationLists,
        conversationData,
        setConversationData,
        decrementUnreadMessagesCount,
        updateConversation,
        resolveConversation,
        currentAgent,
        agents,
        ais,
        agentsFor,
        aisFor,
        pluginsFor,
        getProject,
        projects,
        isGlobalInbox,
        apiUrl,
        inboxViewCounts,
        inboxDataVersion,
        transcriptError,
        retryTranscriptMessages,
        refreshInboxData,
        fetchInboxViewCounts,
        isMainVisible,
        setIsMainVisible,
        buckets,
        setBuckets,
        fetchBucket,
        sendAction,
        fetchConversation,
        fetchBucketList,
        updateBucket,
        fetchConversationList,
        plugins,
        pluginsRef,
        sendPluginEvent,
        projectId,
        activeProjectId,
        projectIdFor,
        lastConnected,
    };

    return (
        <ChatContext.Provider value={ chatContext }>
            { children }
        </ChatContext.Provider>
    );
};

Provider.propTypes = {
    conversationLists: PropTypes.object,
    activeConversationId: PropTypes.string,
    conversationData: PropTypes.object,
    agents: PropTypes.array,
    ais: PropTypes.array,
    plugins: PropTypes.array,
    currentAgent: PropTypes.object,
    apiUrl: PropTypes.string,
    agentToken: PropTypes.string,
    publicKey: PropTypes.string,
    wsUrl: PropTypes.string,
    projectId: PropTypes.string,
    projects: PropTypes.object,
    isGlobalInbox: PropTypes.bool,
};

Provider.defaultProps = {
    conversationLists: {},
    activeConversationId: null,
    conversationData: {},
    agents: window.chatSettings.agents,
    ais: window.chatSettings.ais,
    plugins: window.chatSettings.plugins,
    currentAgent: window.chatSettings.currentAgent,
    apiUrl: window.chatSettings.apiUrl,
    agentToken: window.chatSettings.agentToken,
    publicKey: window.chatSettings.publicKey,
    wsUrl: window.chatSettings.wsUrl,
    projectId: window.chatSettings.project ? window.chatSettings.project.id : null,
    projects: window.chatSettings.projects || {},
    isGlobalInbox: !!window.chatSettings.isGlobalInbox,
};
