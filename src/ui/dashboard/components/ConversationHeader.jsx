import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import ContactAvatar from './ContactAvatar';
import TimeAgo from 'react-timeago';
import { ChatContext } from '../contexts/ChatContext';
import CountryName from './includes/CountryName';
import Moment from '../../native/Moment';
import { contactTimezone } from '../utils/contactTimezone';

import '../styles/components/ConversationHeader.scss';

ConversationHeader.propTypes = {
    conversation: PropTypes.object,
    atTop: PropTypes.bool,
    isPanelVisible: PropTypes.bool,
    onPanelToggle: PropTypes.func,
    panelToggleRef: PropTypes.object,
};

export default function ConversationHeader({
    conversation,
    atTop,
    isPanelVisible,
    onPanelToggle,
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

    const timezone = contactTimezone(conversation.contact);
    const projectHref = `/projects/${conversation.project_id}/conversations/${conversation.id}`;
    // The contact's clock is shown only when a timezone is recorded; the viewer's own clock is never substituted.
    const metaItems = [
        projectName && { key: 'project', node: <a className="conversation-header-project conversation-header-meta-project" href={ projectHref } title={ projectName }>{ projectName }</a> },
        contactEmail && { key: 'email', node: <span className="conversation-header-meta-email" title={ contactEmail }>{ contactEmail }</span> },
        timezone && { key: 'time', node: <span className="conversation-header-meta-fixed"><Moment tz={ timezone } format="LT">{ new Date() }</Moment></span> },
        conversation.contact.country_code && { key: 'country', node: <span className="conversation-header-meta-fixed"><CountryName code={ conversation.contact.country_code } prefix /></span> },
    ].filter(Boolean);
    const contactName = conversation.contact.display_name;

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
                            <a className="chat-header-title" href={ `/projects/${conversation.project_id}/contacts/${conversation.contact_id}` } title={ contactName }>{ contactName }</a>
                            { conversation.contact.is_verified ? <span className="badge text-bg-primary">Verified</span> : <span className="badge text-bg-secondary-subtle">Unverified</span> }
                            { conversation.resolved_at
                                ? <OverlayTrigger placement="bottom" overlay={ <Tooltip id={ `${conversation.id}-resolved-at` }><TimeAgo date={ conversation.resolved_at } /></Tooltip> }><span className="conversation-header-status is-closed">{ statusLabel }</span></OverlayTrigger>
                                : <span className="conversation-header-status is-open">{ statusLabel }</span> }
                            { isAiAssigned && <span className="conversation-header-status is-ai">AI</span> }
                        </div>
                        <div className="conversation-header-meta">
                            { metaItems.map((item, index) => <React.Fragment key={ item.key }>
                                { index > 0 && <span className="conversation-header-meta-separator" aria-hidden="true">•</span> }
                                { item.node }
                            </React.Fragment>) }
                        </div>
                    </div>
                </div>
                <div className="conversation-header-actions">
                    { conversation.resolved_at
                        ? <button type="button" className="btn btn-white conversation-header-reopen" title="Reopen conversation" onClick={ () => resolveConversation(conversation, false) }><i className="fe fe-rotate-ccw me-2" aria-hidden="true"></i>Reopen</button>
                        : <button type="button" className="btn btn-white conversation-header-close" title="Close conversation" onClick={ () => resolveConversation(conversation) }><i className="fe fe-check-circle me-2" aria-hidden="true"></i>Close</button> }
                    <button
                        type="button"
                        className="btn btn-white conversation-assistant-toggle"
                        ref={ panelToggleRef }
                        title={ isPanelVisible ? 'Hide AI and details' : 'Show AI and details' }
                        aria-label={ isPanelVisible ? 'Hide conversation panel' : 'Show conversation panel' }
                        aria-description="Opens AI replies, Local delegation, and conversation details."
                        aria-controls="conversation-assistant"
                        aria-expanded={ Boolean(isPanelVisible) }
                        onClick={ onPanelToggle }>
                        <i className="fe fe-message-square" aria-hidden="true"></i>
                        <span>AI &amp; details</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
