import React from 'react';
import PropTypes from 'prop-types';
import ReplyIcon from '../reply-icons/ReplyIcon';

export default function ConversationDetailField({ children, className, icon, label, value }) {
    const fieldValue = value ?? children;

    return <div className={ `conversation-detail-field${ icon ? ' conversation-detail-field--with-icon' : '' }${ className ? ` ${ className }` : '' }` }>
        { icon && <span className="conversation-detail-field__icon" aria-hidden="true">
            <ReplyIcon name={ icon } />
        </span> }
        <div className="conversation-detail-field__body">
            { label && <span className="conversation-detail-field__label">{ label }</span> }
            { fieldValue !== null && fieldValue !== undefined && <span className="conversation-detail-field__value">{ fieldValue }</span> }
        </div>
    </div>;
}

ConversationDetailField.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    icon: PropTypes.string,
    label: PropTypes.node,
    value: PropTypes.node,
};
