import React from 'react';
import PropTypes from 'prop-types';
import LocalAgentGlyph from './LocalAgentGlyph';

export default function LocalAgentAvatar({ agent, className = '' }) {
    const provider = agent.provider === 'claude' ? 'claude' : 'codex';
    const name = provider === 'claude' ? 'Claude' : 'Codex';

    return <div className={ `avatar local-agent-avatar local-agent-avatar--${provider} ${className}` } role="img" aria-label={ `${name} local agent` } title={ agent.connection_name || name }>
        <LocalAgentGlyph provider={ provider } />
    </div>;
}

LocalAgentAvatar.propTypes = {
    agent: PropTypes.object.isRequired,
    className: PropTypes.string,
};
