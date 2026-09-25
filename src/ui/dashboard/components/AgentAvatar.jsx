import React from 'react';
import PropTypes from 'prop-types';
import Avatar from "./Avatar";

function AgentAvatar({ agent, className, projectId }) {
    const fallbackText = String(agent.initials || agent.name || '').trim();
    const fallbackInitial = fallbackText ? Array.from(fallbackText)[0].toUpperCase() : undefined;

    return <Avatar name={ agent.name } initials={ fallbackInitial } className={ className } url={ agent.avatar_url } projectId={ projectId } variant="agent" />;
}

AgentAvatar.propTypes = {
    agent: PropTypes.object.isRequired,
    className: PropTypes.string,
    projectId: PropTypes.string,
};

export default AgentAvatar;
