import React from 'react';
import MessageCitations from '../../native/MessageCitations';
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
    // Inbound mail classified automatic (out-of-office, bounce, list) earned no AI reply
    // and no notification; say so rather than let the silence look like a dropped reply.
    const origin = message.origin?.automatic
        ? <span className="transcript-message-origin transcript-event-time"
            title={ `Automatic email: no AI reply or notification was sent${ message.origin.reasons?.length ? ` (${ message.origin.reasons.join(', ') })` : '' }` }>automatic</span>
        : null;
    const content = (
        <div className={"message-content transcript-message-content"+( message.content ? " has-content" : "")+( !message.content && message.media && message.media.length ? " image-only" : "")}>
            { message.erased_at && <p className="mb-1 transcript-message-erased"><em>Message erased</em></p> }
            { message.content && <ReactMarkdown remarkPlugins={[gfm, externalLinks]} className="mb-1">{ message.content }</ReactMarkdown> }
            <MessageCitations message={message} />
            { message.media && message.media.map(media => (
                <Media key={ media.id } media={ media }/>
            )) }
        </div>
    );

    if (grouped) {
        return <div className="transcript-message-section">{ content }{ origin }</div>;
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
                <div className="transcript-message-main">{ content }{ origin }</div>
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
