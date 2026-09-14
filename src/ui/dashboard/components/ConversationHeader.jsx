import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import ContactAvatar from './ContactAvatar';
import TimeAgo from 'react-timeago';
import { ChatContext } from '../contexts/ChatContext';
import CountryName from './includes/CountryName';
import Moment from '../../native/Moment';

import '../styles/components/ConversationHeader.scss';

ConversationHeader.propTypes = {
    conversation: PropTypes.object,
    atTop: PropTypes.bool,
    isPanelVisible: PropTypes.bool,
    onLocalPanelOpen: PropTypes.func,
    onPanelToggle: PropTypes.func,
    localPanelToggleRef: PropTypes.object,
    panelToggleRef: PropTypes.object,
};

export default function ConversationHeader({
    conversation,
    atTop,
    isPanelVisible,
    onLocalPanelOpen,
    onPanelToggle,
    localPanelToggleRef,
    panelToggleRef,
}) {
    const { getProject, isGlobalInbox, resolveConversation, setIsMainVisible } = useContext(ChatContext);
    const projectName = isGlobalInbox ? getProject(conversation.project_id).name : null;
    const isAiAssigned = Boolean(conversation.ai_id);
    const statusLabel = conversation.resolved_at ? 'Closed' : 'Open';
    const contactEmail = conversation.contact.email && conversation.contact.email !== conversation.contact.display_name
        ? conversation.contact.email
        : conversation.contact.provided_email && conversation.contact.provided_email !== conversation.contact.display_name
            ? conversation.contact.provided_email
            : null;

    return (
        <div className={ `chat-header conversation-header${atTop ? '' : ' is-scrolled'}` }>
            <div className="conversation-header-panel">
                <div className="conversation-header-identity">
                    <button type="button" className="conversation-header-back nav-link d-xl-none" title="Show Conversations" aria-label="Show conversations" onClick={ () => setIsMainVisible(false) }>
                        <i className="icon-md fe fe-chevron-left" aria-hidden="true"></i>
                    </button>
                    <ContactAvatar contact={ conversation.contact } href={ `/projects/${conversation.project_id}/contacts/${conversation.contact_id}` } className="avatar avatar-sm" presentation="conversation-profile" />
                    <div className="conversation-header-identity-copy">
                        <div className="conversation-header-name-row">
                            <a className="chat-header-title" href={ `/projects/${conversation.project_id}/contacts/${conversation.contact_id}` }>{ conversation.contact.display_name }</a>
                            { conversation.contact.is_verified ? <span className="badge text-bg-primary">Verified</span> : <span className="badge text-bg-secondary-subtle">Unverified</span> }
                            { conversation.resolved_at
                                ? <OverlayTrigger placement="bottom" overlay={ <Tooltip id={ `${conversation.id}-resolved-at` }><TimeAgo date={ conversation.resolved_at } /></Tooltip> }><span className="conversation-header-status is-closed">{ statusLabel }</span></OverlayTrigger>
                                : <span className="conversation-header-status is-open">{ statusLabel }</span> }
                            { isAiAssigned && <span className="conversation-header-status is-ai">AI</span> }
                        </div>
                        <div className="conversation-header-meta">
                            { projectName && <a className="conversation-header-project conversation-header-meta-project" href={ `/projects/${conversation.project_id}/conversations/${conversation.id}` }>{ projectName }</a> }
                            { projectName && <span className="conversation-header-meta-separator" aria-hidden="true">•</span> }
                            { contactEmail && <span className="conversation-header-meta-email">{ contactEmail }</span> }
                            { contactEmail && <span className="conversation-header-meta-separator" aria-hidden="true">•</span> }
                            <span><Moment tz={ decodeURIComponent(conversation.contact.timezone) } format="LT">{ new Date() }</Moment></span>
                            { conversation.contact.country_code && <span><span aria-hidden="true">•</span> <CountryName code={ conversation.contact.country_code } prefix /></span> }
                        </div>
                    </div>
                </div>
                <div className="conversation-header-actions">
                    { !conversation.resolved_at && <button type="button" className="btn btn-white conversation-header-close" title="Close conversation" onClick={ () => resolveConversation(conversation) }><i className="fe fe-check-circle me-2" aria-hidden="true"></i>Close</button> }
                    <button
                        type="button"
                        className="btn btn-white conversation-local-agent-toggle"
                        ref={ localPanelToggleRef }
                        title="Delegate to a local agent"
                        aria-label="Delegate to a local agent"
                        aria-controls="conversation-assistant"
                        aria-expanded={ Boolean(isPanelVisible) }
                        onClick={ onLocalPanelOpen }>
                        <i className="fe fe-monitor" aria-hidden="true"></i>
                        <span>Local</span>
                    </button>
                    <button
                        type="button"
                        className="btn btn-white conversation-assistant-toggle"
                        ref={ panelToggleRef }
                        title={ isPanelVisible ? 'Hide conversation panel' : 'Show conversation panel' }
                        aria-label={ isPanelVisible ? 'Hide conversation panel' : 'Show conversation panel' }
                        aria-controls="conversation-assistant"
                        aria-expanded={ Boolean(isPanelVisible) }
                        onClick={ onPanelToggle }>
                        <i className="fe fe-star" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
