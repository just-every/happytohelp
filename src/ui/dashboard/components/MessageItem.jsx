import React from 'react';
import PropTypes from 'prop-types';
import Media from "./Media";
import ReactMarkdown from "react-markdown";
import gfm from 'remark-gfm';
import externalLinks from 'remark-external-links';

import '../styles/components/MessageItem.scss';
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Moment from '../../native/Moment';
import moment from "moment";
import LocalAgentBadge from './LocalAgentBadge';

function MessageItem({ message, conversation, showActor = true, grouped = false }) {
    const isCustomer = Boolean(message.contact_id);
    const contact = isCustomer
        ? (message.contact || (conversation?.contact && message.contact_id === conversation.contact.id ? conversation.contact : null))
        : null;
    const agent = !isCustomer ? message.agent : null;
    const sender = isCustomer ? contact?.display_name : (message.local_agent?.name || agent?.name);
    const tooltipId = `${ message.id || message.local_id || 'pending' }-read-at`;

    const timestampFormat = (new Date().getFullYear().toString()) === moment(message.created_at).format('YYYY')
        ? 'D MMM (LT)'
        : 'D MMM, YYYY (LT)';
    const renderTooltip = (props) => (
        <Tooltip id={ tooltipId } {...props}>
            { !message.contact_id && <p className="m-0"><i className="fe fe-check"></i> Sent on <Moment format={ timestampFormat } date={ message.created_at } className="text-nowrap" /></p> }
            { message.contact_id && <p className="m-0"><i className="fe fe-check"></i> Received on <Moment format={ timestampFormat } date={ message.created_at } className="text-nowrap" />{ message.content_raw ? ' via email' : ' via chat'  }</p> }
            { message.agent_id && message.notified_at && message.notified_by && <p className="m-0"><i className="fe fe-mail"></i> Notified on <Moment format={ timestampFormat } date={ message.notified_at } className="text-nowrap" /></p> }
            { message.read_by_contacts && conversation?.contact_id && message.read_by_contacts[conversation.contact_id] && <p className="m-0"><i className="fe fe-eye"></i> Read on <Moment format={ timestampFormat } date={ message.read_by_contacts[conversation.contact_id] } className="text-nowrap" /></p> }
        </Tooltip>
    );

    const timestamp = (
        <OverlayTrigger
            placement="top"
            trigger={[ 'hover', 'focus' ]}
            overlay={ renderTooltip }>
            <time className="transcript-message-time" dateTime={ message.created_at } tabIndex={ 0 } aria-label="View message details">
                <Moment format="LT" date={ message.created_at } />
            </time>
        </OverlayTrigger>
    );
    const content = (
        <div className={"message-content transcript-message-content"+( message.content ? " has-content" : "")+( !message.content && message.media && message.media.length ? " image-only" : "")}>
            { message.content && <ReactMarkdown remarkPlugins={[gfm, externalLinks]} className="mb-1">{ message.content }</ReactMarkdown> }
            { message.media && message.media.map(media => (
                <Media key={ media.id } media={ media }/>
            )) }
        </div>
    );

    if (grouped) {
        return (
            <div className="transcript-message-section">
                { showActor && sender && <div className="transcript-message-byline transcript-run-byline">
                    <span className="transcript-message-sender">{ sender }</span>
                    { !isCustomer && <LocalAgentBadge agent={ message.local_agent } /> }
                </div> }
                <div className="transcript-message-section-body">
                    { content }
                    { timestamp }
                </div>
            </div>
        );
    }

    return (
        <div className={"message-row transcript-message-row"+(isCustomer ? " transcript-message-customer" : " transcript-message-agent")}>
            <div className="transcript-message-card">
                <div className="transcript-message-main">
                    <div className="transcript-message-header">
                        <div className="transcript-message-byline">
                            { showActor && sender && <span className="transcript-message-sender">{ sender }</span> }
                            { showActor && !isCustomer && <LocalAgentBadge agent={ message.local_agent } /> }
                            { timestamp }
                        </div>
                    </div>
                    { content }
                </div>
            </div>
        </div>
    );

}

MessageItem.propTypes = {
    message: PropTypes.object,
    conversation: PropTypes.object,
    showActor: PropTypes.bool,
    grouped: PropTypes.bool,
};

export default MessageItem;
