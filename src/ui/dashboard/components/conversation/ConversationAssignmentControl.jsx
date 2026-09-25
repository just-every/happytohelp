import React, { useContext, useState } from 'react';
import PropTypes from 'prop-types';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import useOnclickOutside from 'react-cool-onclickoutside';
import AgentAvatar from '../AgentAvatar';
import ReplyIcon from '../reply-icons/ReplyIcon';
import Api from '../../api';
import { ChatContext } from '../../contexts/ChatContext';

ConversationAssignmentControl.propTypes = {
    conversation: PropTypes.object.isRequired,
};

export default function ConversationAssignmentControl({ conversation }) {
    const [isOpen, setIsOpen] = useState(false);
    const { agentsFor, aisFor, sendAction, updateConversation } = useContext(ChatContext);
    const agents = agentsFor(conversation.project_id) || [];
    const ais = aisFor(conversation.project_id) || [];
    const isAiAssigned = Boolean(conversation.ai_id);
    const assignmentName = (isAiAssigned ? conversation.ai?.name : conversation.agent?.name) || 'Unassigned';
    const dropdownRef = useOnclickOutside(() => setIsOpen(false));

    const assignAgent = agentId => {
        setIsOpen(false);
        Api.update(`/projects/${conversation.project_id}/conversations/${conversation.id}`, { ai_id: null, agent_id: agentId })
            .then(data => updateConversation(data.data.id, data.data))
            .catch(error => console.log(error));
    };

    const assignAi = aiId => {
        setIsOpen(false);
        sendAction('assignAi', { ai_id: aiId }, conversation.project_id);
        const ai = ais.find(item => item.id === aiId);
        updateConversation(conversation.id, { ai, ai_id: aiId, agent_id: aiId });
    };

    const handleMenuKeyDown = event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
        }
    };

    return (
        <section className="conversation-details-section conversation-details-assignment">
            <div className="conversation-details-section-heading">
                <h3>Assignment</h3>
            </div>
            <div className={ `dropdown${isOpen ? ' show' : ''}` }>
                <OverlayTrigger placement="bottom" overlay={ <Tooltip id={ `${conversation.id}-assignment` }>Change assignment</Tooltip> }>
                    <button
                        type="button"
                        className="btn btn-white dropdown-toggle"
                        aria-haspopup="menu"
                        aria-expanded={ isOpen }
                        aria-label={ `Assign conversation. Current assignment: ${assignmentName}` }
                        onClick={ () => setIsOpen(current => !current) }>
                        <ReplyIcon name="user-round-check" />
                        <span>{ assignmentName }</span>
                        <ReplyIcon name="chevron-down" className="conversation-details-assignment__chevron" />
                    </button>
                </OverlayTrigger>
                { isOpen && <div className="dropdown-menu p-1 show" ref={ dropdownRef } role="menu" onKeyDown={ handleMenuKeyDown }>
                    <button type="button" className="btn btn-link d-flex align-items-center" role="menuitem" onClick={ () => assignAgent(null) }>
                        Unassign
                    </button>
                    { agents.map(agent => agent.id === conversation.agent_id
                        ? <span className="btn is-selected d-flex align-items-center mt-1" key={ `agent-${agent.id}` }><AgentAvatar agent={ agent } className="avatar-xs" />{ agent.name }</span>
                        : <button type="button" className="btn btn-link d-flex align-items-center mt-1" role="menuitem" key={ `agent-${agent.id}` } onClick={ () => assignAgent(agent.id) }><AgentAvatar agent={ agent } className="avatar-xs" />{ agent.name }</button>
                    ) }
                    { ais.map(ai => ai.id === conversation.ai_id
                        ? <span className="btn is-selected d-flex align-items-center mt-1" key={ `ai-${ai.id}` }><AgentAvatar agent={ ai } className="avatar-xs" />{ ai.name }</span>
                        : <button type="button" className="btn btn-link d-flex align-items-center mt-1" role="menuitem" key={ `ai-${ai.id}` } onClick={ () => assignAi(ai.id) }><AgentAvatar agent={ ai } className="avatar-xs" />{ ai.name }</button>
                    ) }
                </div> }
            </div>
        </section>
    );
}
