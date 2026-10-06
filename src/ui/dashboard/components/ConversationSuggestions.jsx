import React from 'react';
import AgentAvatar from './AgentAvatar';
import ConversationSuggestionCard from './ConversationSuggestionCard';
import { useReplySuggestions } from '../contexts/ConversationSuggestionsContext';
import ConversationAIInstructions from './ConversationAIInstructions';
import { ProviderSetupNotice } from '../../native/activation';

const providerBySecret = {
    OPENAI_API_KEY: 'OpenAI',
    ANTHROPIC_API_KEY: 'Anthropic',
    GOOGLE_API_KEY: 'Google',
    GEMINI_API_KEY: 'Google',
    DEEPSEEK_API_KEY: 'DeepSeek',
    XAI_API_KEY: 'xAI',
    OPENROUTER_API_KEY: 'OpenRouter',
};
const providerById = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    deepseek: 'DeepSeek',
    xai: 'xAI',
    openrouter: 'OpenRouter',
};

export default function ConversationSuggestions({ hasHiddenAbove, hasHiddenBelow, scrollRef }) {
    const {
        currentAI, disabled, projectId, selectSuggestion, selectedSuggestion, suggestions,
    } = useReplySuggestions();
    const isProviderConfigurationError = /^(?:CONFIGURATION_REQUIRED|PROVIDER_NOT_SELECTED):/.test(suggestions.error);
    const missingSecretName = suggestions.error.match(/^CONFIGURATION_REQUIRED:\s*([A-Z][A-Z0-9_]+)/)?.[1];
    const unselectedProviderId = suggestions.error.match(/^PROVIDER_NOT_SELECTED:\s*([a-z][a-z0-9_-]*)$/i)?.[1]?.toLowerCase();
    const provider = providerBySecret[missingSecretName] || providerById[unselectedProviderId];

    return (
        <div className="conversation-suggestions">
            { currentAI && <div className="conversation-suggestions__agent">
                <AgentAvatar agent={ currentAI } className="avatar-sm" />
                <span>{ currentAI.name }’s Suggestions</span>
            </div> }

            <div className={ `conversation-suggestions__scroll-region${ hasHiddenAbove ? ' has-hidden-above' : '' }${ hasHiddenBelow ? ' has-hidden-below' : '' }` }>
                <div className="conversation-suggestions__options" ref={ scrollRef } aria-live="polite">
                    { suggestions.error && <div className="conversation-suggestions__error" role="alert">
                        { isProviderConfigurationError
                            ? <ProviderSetupNotice
                                projectId={ projectId }
                                provider={ provider }
                                secretName={ missingSecretName }
                                kind="model"
                                error={ suggestions.error }
                            />
                            : <span>{ suggestions.error }</span> }
                    </div> }
                    { suggestions.loading && <div className="conversation-suggestions__loading" role="status">
                        <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                        <span>{ suggestions.loading_message || 'Generating reply suggestions…' }</span>
                    </div> }

                    { suggestions.responses.map((suggestion, index) => {
                        if (!suggestion?.response) return null;

                        return <ConversationSuggestionCard
                            key={ `${ suggestion.button }-${ index }` }
                            label={ suggestion.button }
                            icon={ suggestion.icon }
                            response={ suggestion.response }
                            useWhen={ suggestion.use_when }
                            selected={ selectedSuggestion === index }
                            disabled={ disabled || suggestions.loading }
                            onSelect={ () => selectSuggestion(suggestion, index) }
                        />;
                    }) }
                </div>
            </div>

            <ConversationAIInstructions />

        </div>
    );
}
