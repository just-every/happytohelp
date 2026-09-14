import React from 'react';
import PropTypes from 'prop-types';
import Media from './Media';

export default function DelegationAttachments({ attachments }) {
    if (!Array.isArray(attachments) || !attachments.length) return null;
    return <div className="delegation-attachments" aria-label="Screenshots">
        { attachments.map(media => <div key={ media.id }><Media media={ media } /></div>) }
    </div>;
}

DelegationAttachments.propTypes = { attachments: PropTypes.array };
