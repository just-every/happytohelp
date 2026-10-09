import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatContext } from '../contexts/ChatContext';
import * as replySuggestionSelection from './replySuggestionSelection';
import * as replySuggestionLifecycle from './replySuggestionLifecycle';

const {
    nextReplySuggestionSelection,
    shouldClearReplySuggestionForResponses,
    shouldClearReplySuggestionSelection,
} = replySuggestionSelection;
const {
    optimisticSuggestionState,
    shouldApplyToolSuggestion,
    suggestionDeadlineDelay,
} = replySuggestionLifecycle;

const toolLabels = {
    improve: 'Improving…',
    extend: 'Extending…',
    shorten: 'Shortening…',
};

const normaliseSuggestions = rawSuggestions => {
    const suggestions = !rawSuggestions || Array.isArray(rawSuggestions)
        ? {}
        : rawSuggestions;

    return {
        ...suggestions,
        loading: Boolean(suggestions.loading),
        loading_message: suggestions.loading_message || '',
        error: suggestions.error || '',
        tool_response: suggestions.tool_response || '',
        responses: Array.isArray(suggestions.responses)
            ? suggestions.responses.map((suggestion, index) => ({
                ...suggestion,
                button: suggestion?.button || `Suggestion ${index + 1}`,
            }))
            : [],
    };
};

export default function useConversationSuggestions({
    conversationId,
    message,
    onMessageChange,
    onLoadingMessageChange,
    disabled,
}) {
    const {
        aisFor,
        getProject,
        conversationData,
        sendAction,
        updateConversation,
    } = useContext(ChatContext);
    const [ activeTool, setActiveTool ] = useState(null);
    const [ selectedSuggestion, setSelectedSuggestion ] = useState(null);
    const [ undoStack, setUndoStack ] = useState([]);
    const [ redoStack, setRedoStack ] = useState([]);
    const [ instructions, setInstructions ] = useState('');
    const previousToolResponse = useRef('');
    const assistRequest = useRef(0);
    const activeToolRequest = useRef(null);
    const replySelection = useRef(null);
    const replySelectionId = useRef(0);
    const previousMessage = useRef(message);

    const conversation = conversationData[conversationId];
    const projectId = conversation?.project_id;
    const project = projectId ? getProject(projectId) : null;
    const ais = projectId ? (aisFor(projectId) || []) : [];
    const suggestions = useMemo(
        () => normaliseSuggestions(conversation?.metadata?.suggestions),
        [ conversation?.metadata?.suggestions ],
    );
    const canGenerateSuggestions = Boolean(conversation?.last_message_id);

    let aiId = null;
    if (conversation?.ai_id) {
        aiId = conversation.ai_id;
    } else if (conversation?.contact?.is_verified && project?.default_verified_user_ai_id) {
        aiId = project.default_verified_user_ai_id;
    } else if (project?.default_visitor_ai_id) {
        aiId = project.default_visitor_ai_id;
    } else if (ais.length > 0) {
        aiId = ais[0].id;
    }
    const currentAI = aiId ? ais.find(ai => ai.id === aiId) : null;

    const persistSuggestions = useCallback(nextSuggestions => {
        if (!conversationId) return;

        updateConversation(conversationId, {
            metadata: {
                ...(conversationData[conversationId]?.metadata || {}),
                suggestions: nextSuggestions,
            },
        }, { localSuggestions: true });
    }, [ conversationData, conversationId, updateConversation ]);

    const rememberDraft = useCallback((action, details = {}) => {
        setUndoStack(stack => {
            const last = stack[stack.length - 1];
            if (last?.message === message) return stack;
            return [ ...stack, { action, message, ...details } ];
        });
        setRedoStack([]);
    }, [ message ]);

    const clearReplySuggestionSelection = useCallback(() => {
        replySelection.current = null;
        setSelectedSuggestion(null);
    }, []);

    const applyDraft = useCallback((draft, action) => {
        rememberDraft(action);
        clearReplySuggestionSelection();
        onMessageChange(draft);
    }, [ clearReplySuggestionSelection, onMessageChange, rememberDraft ]);

    const requestAssist = useCallback((options = {}) => {
        if (disabled || suggestions.loading || !conversationId || !projectId || (!options.tool && !canGenerateSuggestions)) return;

        const requestId = ++assistRequest.current;
        const clientRequestId = uuidv4();
        if (options.tool) {
            activeToolRequest.current = {
                conversationId,
                clientRequestId,
                draft: message,
                requestVersion: requestId,
            };
        }

        const nextSuggestions = optimisticSuggestionState(suggestions, {
            clientRequestId,
            displayRequestVersion: requestId,
            loadingMessage: options.loading_message || '',
            clearToolResponse: Boolean(options.tool),
        });
        persistSuggestions(nextSuggestions);
        sendAction('agentAssist', {
            conversation_id: conversationId,
            options: {
                ...options,
                message,
                client_request_id: clientRequestId,
                display_request_version: requestId,
            },
        }, projectId)?.catch(error => {
            if (requestId !== assistRequest.current) return;

            console.error('Unable to request conversation assistance', error);
            persistSuggestions({
                ...nextSuggestions,
                loading: false,
                loading_message: '',
                status: 'error',
                error: /^(?:CONFIGURATION_REQUIRED|PROVIDER_NOT_SELECTED):/.test(error?.message || '')
                    ? error.message
                    : 'Chat service unavailable.',
            });
            if (options.tool) {
                activeToolRequest.current = null;
                setActiveTool(null);
                previousToolResponse.current = '';
                onLoadingMessageChange('');
            }
        });
    }, [ canGenerateSuggestions, conversationId, disabled, message, onLoadingMessageChange, persistSuggestions, projectId, sendAction, suggestions ]);

    // Recover locally if the connection drops or a worker exits before broadcasting
    // a terminal state. The server's acknowledged deadline replaces the local one.
    useEffect(() => {
        const delay = suggestionDeadlineDelay(suggestions);
        if (delay === null) return undefined;
        const timer = setTimeout(() => {
            persistSuggestions({
                ...suggestions,
                loading: false,
                loading_message: '',
                status: 'error',
                error: 'Suggestion generation timed out. Try again.',
                tool_response: '',
                client_timeout: true,
            });
            activeToolRequest.current = null;
            setActiveTool(null);
            onLoadingMessageChange('');
        }, delay);
        return () => clearTimeout(timer);
    }, [ onLoadingMessageChange, persistSuggestions, suggestions ]);

    const regenerate = useCallback(() => {
        if (!canGenerateSuggestions) return;
        clearReplySuggestionSelection();
        requestAssist({ instructions: instructions.trim() });
    }, [ canGenerateSuggestions, clearReplySuggestionSelection, instructions, requestAssist ]);

    const selectSuggestion = useCallback((suggestion, index) => {
        if (disabled || suggestions.loading || !suggestion?.response) return;

        const currentSelection = replySelection.current;
        const nextSelection = nextReplySuggestionSelection({
            selection: currentSelection,
            conversationId,
            message,
            suggestionIndex: index,
            suggestionResponse: suggestion.response,
        });
        const selectionId = nextSelection.action === 'switch' || nextSelection.action === 'deselect'
            ? currentSelection.selectionId
            : ++replySelectionId.current;

        if (nextSelection.rememberDraft) {
            rememberDraft('reply suggestion', { selectionId });
        }

        replySelection.current = nextSelection.selection
            ? { ...nextSelection.selection, selectionId }
            : null;
        setSelectedSuggestion(nextSelection.selection ? index : null);
        onMessageChange(nextSelection.message);

        if (nextSelection.action === 'deselect') {
            setUndoStack(stack => {
                const last = stack[stack.length - 1];
                if (last?.selectionId !== currentSelection?.selectionId) {
                    return stack;
                }
                return stack.slice(0, -1);
            });
        }
    }, [ conversationId, disabled, message, onMessageChange, rememberDraft, suggestions.loading ]);

    const runTool = useCallback(tool => {
        if (disabled || suggestions.loading || !message?.trim()) return;

        clearReplySuggestionSelection();
        rememberDraft(tool);
        setActiveTool(tool);
        previousToolResponse.current = '';
        onLoadingMessageChange('-loading-');
        requestAssist({ tool, instructions: instructions.trim(), loading_message: toolLabels[tool] });
    }, [ clearReplySuggestionSelection, disabled, instructions, message, onLoadingMessageChange, rememberDraft, requestAssist, suggestions.loading ]);

    const undo = useCallback(() => {
        setUndoStack(stack => {
            if (!stack.length) return stack;

            const previous = stack[stack.length - 1];
            setRedoStack(redo => [ ...redo, { action: previous.action, message } ]);
            onMessageChange(previous.message);
            clearReplySuggestionSelection();
            return stack.slice(0, -1);
        });
    }, [ clearReplySuggestionSelection, message, onMessageChange ]);

    const redo = useCallback(() => {
        setRedoStack(stack => {
            if (!stack.length) return stack;

            const next = stack[stack.length - 1];
            setUndoStack(undoHistory => [ ...undoHistory, { action: next.action, message } ]);
            onMessageChange(next.message);
            clearReplySuggestionSelection();
            return stack.slice(0, -1);
        });
    }, [ clearReplySuggestionSelection, message, onMessageChange ]);

    useEffect(() => {
        if (!activeTool || !suggestions.tool_response) return;

        if (suggestions.loading) {
            if (previousToolResponse.current !== suggestions.tool_response) {
                previousToolResponse.current = suggestions.tool_response;
                onLoadingMessageChange(suggestions.tool_response);
            }
            return;
        }

        if (shouldApplyToolSuggestion({
            request: activeToolRequest.current,
            suggestions,
            conversationId,
            draft: message,
        })) {
            applyDraft(suggestions.tool_response, activeTool);
        }
        previousToolResponse.current = '';
        activeToolRequest.current = null;
        setActiveTool(null);
        onLoadingMessageChange('');
    }, [ activeTool, applyDraft, conversationId, message, onLoadingMessageChange, suggestions ]);

    useEffect(() => {
        if (!suggestions.loading && activeTool && !suggestions.tool_response) {
            setActiveTool(null);
            onLoadingMessageChange('');
        }
    }, [ activeTool, onLoadingMessageChange, suggestions.loading, suggestions.tool_response ]);

    useEffect(() => {
        if (shouldClearReplySuggestionSelection({
            selection: replySelection.current,
            conversationId,
            previousMessage: previousMessage.current,
            message,
        })) {
            clearReplySuggestionSelection();
        }
        previousMessage.current = message;
    }, [ clearReplySuggestionSelection, conversationId, message ]);

    useEffect(() => {
        if (shouldClearReplySuggestionForResponses(replySelection.current, suggestions.responses)) {
            clearReplySuggestionSelection();
        }
    }, [ clearReplySuggestionSelection, suggestions.responses ]);

    useEffect(() => {
        replySelection.current = null;
        previousMessage.current = message;
        setSelectedSuggestion(null);

        return () => {
            assistRequest.current += 1;
            activeToolRequest.current = null;
        };
    }, [ conversationId ]);

    return {
        activeTool,
        canGenerateSuggestions,
        disabled,
        projectId,
        canRunTools: !disabled && !suggestions.loading && Boolean(message?.trim()),
        canRedo: redoStack.length > 0,
        canUndo: undoStack.length > 0,
        currentAI,
        instructions,
        regenerate,
        redo,
        runTool,
        selectSuggestion,
        selectedSuggestion,
        setInstructions,
        suggestions,
        undo,
    };
}
