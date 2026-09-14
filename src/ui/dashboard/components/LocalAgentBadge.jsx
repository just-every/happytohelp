import React from 'react';
import PropTypes from 'prop-types';

export default function LocalAgentBadge({ agent }) {
    if (!agent) return null;
    const detail = [agent.connection_name, agent.operator_name && `Requested by ${agent.operator_name}`].filter(Boolean).join(' · ');
    return <span className="transcript-local-agent-label" title={ detail }>Local agent</span>;
}

LocalAgentBadge.propTypes = { agent: PropTypes.object };
