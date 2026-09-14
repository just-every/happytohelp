import React from 'react';
import PropTypes from 'prop-types';
import ContactAvatar from "./ContactAvatar";
import AgentAvatar from "./AgentAvatar";
import LocalAgentAvatar from './LocalAgentAvatar';
import { resolveTranscriptActorTile } from './transcriptActorPalette';

import '../styles/components/MessageItem.scss';

function ItemGroup({ actor, content, continuesFromPrevious, continuesToNext, conversation }) {
    const contact = actor?.kind === 'contact'
        ? (actor.entity || (conversation?.contact?.id != null && String(conversation.contact.id) === String(actor.id) ? conversation.contact : null))
        : null;
    const agent = actor?.kind === 'agent' ? actor.entity : null;
    const canRenderContactAvatar = contact && (typeof contact.display_name === 'string' || typeof contact.initials === 'string');
    const canRenderAgentAvatar = agent && (typeof agent.name === 'string' || typeof agent.initials === 'string');
    const position = actor?.position || 'right';
    const actorTile = resolveTranscriptActorTile(actor, contact);
    const actorStyle = actorTile ? {
        '--transcript-actor-tile': actorTile,
        '--transcript-actor-tint': actor?.kind === 'local_agent'
            ? (actor.entity?.provider === 'claude' ? '65%' : '8%')
            : undefined,
    } : undefined;

    return <div className={ `message message-${position}` }>
        <div className={ `message-body transcript-group-body transcript-actor-group${continuesFromPrevious ? ' transcript-actor-group-continues' : ''}${continuesToNext ? ' transcript-actor-group-continues-to-next' : ''}` } style={ actorStyle }>
            <div className="transcript-group-rail">
                { !continuesFromPrevious && canRenderContactAvatar && <ContactAvatar className="transcript-message-avatar avatar-sm" contact={ contact } presentation="conversation-profile" /> }
                { !continuesFromPrevious && canRenderAgentAvatar && <AgentAvatar className="transcript-message-avatar avatar-sm" agent={ agent } /> }
                { !continuesFromPrevious && actor?.kind === 'local_agent' && <LocalAgentAvatar className="transcript-message-avatar avatar-sm" agent={ actor.entity } /> }
            </div>
            <div className="transcript-group-main">
                { content }
            </div>
        </div>
    </div>;
}

ItemGroup.propTypes = {
    actor: PropTypes.object,
    content: PropTypes.array,
    continuesFromPrevious: PropTypes.bool,
    continuesToNext: PropTypes.bool,
    conversation: PropTypes.object,
};

export default ItemGroup;
