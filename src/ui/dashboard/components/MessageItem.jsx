import React from 'react';
import PropTypes from 'prop-types';
import Media from "./Media";
import ReactMarkdown from "react-markdown";
import gfm from 'remark-gfm';
import externalLinks from 'remark-external-links';

import '../styles/components/MessageItem.scss';
import LocalAgentBadge from './LocalAgentBadge';
import MessageTimestamp from './MessageTimestamp';

function MessageItem({ message, conversation, showActor = true, grouped = false, showHeader = true }) {
    const isCustomer = Boolean(message.contact_id);
    const contact = isCustomer
        ? (message.contact || (conversation?.contact && message.contact_id === conversation.contact.id ? conversation.contact : null))
        : null;
    const agent = !isCustomer ? message.agent : null;
    const sender = isCustomer ? contact?.display_name : (message.local_agent?.name || agent?.name);
    const content = (
        <div className={"message-content transcript-message-content"+( message.content ? " has-content" : "")+( !message.content && message.media && message.media.length ? " image-only" : "")}>
            { message.content && <ReactMarkdown remarkPlugins={[gfm, externalLinks]} className="mb-1">{ message.content }</ReactMarkdown> }
            { message.media && message.media.map(media => (
                <Media key={ media.id } media={ media }/>
            )) }
        </div>
    );

    if (grouped) {
        return <div className="transcript-message-section">{ content }</div>;
    }

    return (
        <div className={"message-row transcript-message-row"+(isCustomer ? " transcript-message-customer" : " transcript-message-agent")}>
            { showHeader && <div className="transcript-message-header">
                <div className="transcript-message-byline">
                    { showActor && sender && <span className="transcript-message-sender">{ sender }</span> }
                    { showActor && !isCustomer && <LocalAgentBadge agent={ message.local_agent } /> }
                    <MessageTimestamp message={ message } conversation={ conversation } />
                </div>
            </div> }
            <div className="transcript-message-card">
                <div className="transcript-message-main">{ content }</div>
            </div>
        </div>
    );

}

MessageItem.propTypes = {
    message: PropTypes.object,
    conversation: PropTypes.object,
    showActor: PropTypes.bool,
    grouped: PropTypes.bool,
    showHeader: PropTypes.bool,
};

export default MessageItem;
