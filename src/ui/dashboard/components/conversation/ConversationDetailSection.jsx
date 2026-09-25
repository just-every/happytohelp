import React from 'react';
import PropTypes from 'prop-types';

export default function ConversationDetailSection({ children, className, title }) {
    return <section className={ `conversation-details-section${ className ? ` ${ className }` : '' }` }>
        { title && <div className="conversation-details-section-heading">
            <h3 className="conversation-details-section-title">{ title }</h3>
        </div> }
        <div className="conversation-details-fields">
            { children }
        </div>
    </section>;
}

ConversationDetailSection.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    title: PropTypes.string,
};
