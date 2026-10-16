import React, { useContext, useState } from 'react';
import PropTypes from 'prop-types';
import AddParticipantModal from '../AddParticipantModal';
import ReplyIcon from '../reply-icons/ReplyIcon';
import Api from '../../api';
import { ChatContext } from '../../contexts/ChatContext';

ConversationParticipantsControl.propTypes = {
    conversation: PropTypes.object.isRequired,
};

export default function ConversationParticipantsControl({ conversation }) {
    const [isAddParticipantModalVisible, setIsAddParticipantModalVisible] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [error, setError] = useState(null);
    const { updateConversation } = useContext(ChatContext);
    const participants = conversation.participants || [];

    const removeParticipant = participantId => {
        setRemoving(participantId);
        setError(null);
        Api.remove(`/projects/${conversation.project_id}/conversations/${conversation.id}/participants/${participantId}`)
            .then(() => updateConversation(conversation.id, {
                participants: participants.filter(participant => participant.pivot.id !== participantId),
            }))
            .catch(error => setError(error.message || 'The recipient could not be removed.'))
            .finally(() => setRemoving(null));
    };

    return (
        <section className="conversation-details-section conversation-details-participants">
            <div className="conversation-details-section-heading">
                <h3>Recipients</h3>
                <button type="button" className="btn btn-link" onClick={ () => setIsAddParticipantModalVisible(true) }><ReplyIcon name="plus" />Add recipient</button>
            </div>
            { error && <p role="alert" className="text-danger">{ error }</p> }
            { participants.length > 0
                ? <ul className="conversation-details-participant-list">
                    { participants.map(participant => {
                        const email = participant.provided_email || participant.email;
                        return <li key={ `participant-${participant.id}` }>
                            <ReplyIcon name="mail" />
                            <span>{ email }</span>
                            <button type="button" className="btn btn-link" disabled={ removing !== null } aria-label={ `Remove ${email}` } onClick={ () => removeParticipant(participant.pivot.id) }>
                                <ReplyIcon name="x" />
                            </button>
                        </li>;
                    }) }
                </ul>
                : <p className="conversation-details-empty">No additional recipients.</p> }
            { isAddParticipantModalVisible && <AddParticipantModal conversation={ conversation } onHide={ () => setIsAddParticipantModalVisible(false) } /> }
        </section>
    );
}
