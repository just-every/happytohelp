import React from 'react';
import PropTypes from 'prop-types';
import Moment from '../../native/Moment';
import ConversationDetailField from './conversation/ConversationDetailField';

function MetadataItem({ name, value }) {
    let label = name.replace(/[_-]+/g, ' ');
    let renderedValue = String(value);

    if (isValidHttpUrl(renderedValue)) {
        renderedValue = <a href={ renderedValue } target="_blank" rel="noreferrer">{ label }</a>;
        label = null;
    } else if (name.endsWith('_at')) {
        renderedValue = <Moment unix>{ value }</Moment>;
    }

    return <ConversationDetailField className="conversation-detail-field--metadata" icon="braces" label={ label } value={ renderedValue } />;
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

MetadataItem.propTypes = {
    name: PropTypes.string.isRequired,
    value: PropTypes.any,
};

export default MetadataItem;
