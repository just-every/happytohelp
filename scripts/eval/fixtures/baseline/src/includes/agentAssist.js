const { getAssistContext } = require("./getContext");
const { agentSuggestions } = require("../llm/prompt/request");
const log = require('../config/log');
const { runRequest, getSuggestionsObject } = require("../llm/run");
const {sendToAgents} = require("./sendTo");
const {agentTool} = require("./agentTool");
const {isEqual} = require("lodash");

/**
 * Handle the partial or full JSON response from the LLM
 */
const handleSuggestionsResponse = (promises, workingContext, assistContext, responseJson, complete, suggestions, metadata) => {

    if(responseJson.tool_calls?.length > 0) {
        // Running a tool call - handled separately
        return [promises, workingContext];
    }

    let initialSuggestions = { ...suggestions };

    if (complete) {
        suggestions.user_goal = responseJson.user_goal || '';
        suggestions.responses = Array.isArray(responseJson.responses) ? responseJson.responses : [];
        suggestions.loading = false;
        suggestions.loading_message = '';
        metadata.suggestions = suggestions;
        promises.push(assistContext.conversation.save('metadata', metadata));
    }

    if((complete || !isEqual(initialSuggestions, suggestions)) && assistContext.options.streaming) {
        promises.push(sendToAgents(assistContext.connection, 'settings', {conversation_id: assistContext.conversation.get('id'), payload: { metadata: { suggestions } }}));
    }

    return [promises, workingContext];
};

/**
 * Add information to assist the agent in replying
 *
 * @param {bookshelf.Conversation} conversation
 * @param {bookshelf.Connection} currentConnection
 * @param {Object} options
 * @returns Promise
 */
export const agentAssist = async (conversation, currentConnection, options = {}) => {

    let metadata;
    let suggestions;
    try {
        let agent_id = conversation.get('agent_id');
        if(options.agent_id) {
            agent_id = options.agent_id;
        }
        if(agent_id === conversation.get('ai_id')) {
            agent_id = null;
        }

        options.streaming = !!currentConnection.get('agent_id');
        options.global_tools = true;

        if(options.agent_tool) {
            return agentTool(options.agent_tool, conversation, currentConnection, options, agent_id);
        }

        log.debug("agentAssist", conversation.get('id'), options);

        metadata = conversation.get('metadata');
        if(!metadata) metadata = {};
        suggestions = getSuggestionsObject(metadata.suggestions, options);
        suggestions.loading = true;
        suggestions.loading_message = '';
        suggestions.responses = [];
        options.suggestions = suggestions;

        await Promise.all(
            [
                !options.streaming ? null : sendToAgents(currentConnection, 'settings', {conversation_id: conversation.get('id'), payload: { metadata: { suggestions } }}),
                runRequest(
                    agentSuggestions,
                    async() => getAssistContext(conversation, currentConnection, options, agent_id),
                    (promises, workingContext, context, responseJson, complete) => handleSuggestionsResponse(promises, workingContext, context, responseJson, complete, suggestions, metadata),
                )
            ]
        );
    }
    finally {

        // Ok all done - set the loading to false
        if(suggestions && suggestions.loading) {
            metadata = metadata || {};
            suggestions.loading = false;
            suggestions.loading_message = '';
            metadata.suggestions = suggestions;

            await Promise.all(
                [
                    conversation.save('metadata', metadata),
                    !options.streaming ? null : sendToAgents(currentConnection, 'settings', {conversation_id: conversation.get('id'), payload: { metadata: { suggestions } }})
                ]
            );
        }
    }

};
