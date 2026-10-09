import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Moment from '../../native/Moment';
import moment from 'moment';

export default function MessageTimestamp({ message, conversation, relatedMessages = [] }) {
    const tooltipId = `${ message.id || message.local_id || 'pending' }-read-at`;

    const renderTooltip = (props) => (
        <Tooltip id={ tooltipId } {...props}>
            { [message, ...relatedMessages].map((item, index) => {
                const timestampFormat = new Date().getFullYear().toString() === moment(item.created_at).format('YYYY')
                    ? 'D MMM (LT)' : 'D MMM, YYYY (LT)';
                return <div key={ item.id || item.local_id || index } className={ index ? 'mt-2' : undefined }>
                    { !item.contact_id && <p className="m-0"><i className="fe fe-check"></i> Sent on <Moment format={ timestampFormat } date={ item.created_at } className="text-nowrap" /></p> }
                    { item.contact_id && <p className="m-0"><i className="fe fe-check"></i> Received on <Moment format={ timestampFormat } date={ item.created_at } className="text-nowrap" />{ item.content_raw ? ' via email' : ' via chat' }</p> }
                    { item.agent_id && item.notified_at && item.notified_by && <p className="m-0"><i className="fe fe-mail"></i> Notified on <Moment format={ timestampFormat } date={ item.notified_at } className="text-nowrap" /></p> }
                    { item.read_by_contacts && conversation?.contact_id && item.read_by_contacts[conversation.contact_id] && <p className="m-0"><i className="fe fe-eye"></i> Read on <Moment format={ timestampFormat } date={ item.read_by_contacts[conversation.contact_id] } className="text-nowrap" /></p> }
                </div>;
            }) }
        </Tooltip>
    );

    return (
        <OverlayTrigger
            placement="top"
            trigger={[ 'hover', 'focus' ]}
            overlay={ renderTooltip }>
            <time className="transcript-message-time" dateTime={ message.created_at } tabIndex={ 0 }>
                <Moment format="LT" date={ message.created_at } />
            </time>
        </OverlayTrigger>
    );
}

MessageTimestamp.propTypes = {
    message: PropTypes.object.isRequired,
    conversation: PropTypes.object,
    relatedMessages: PropTypes.array,
};
