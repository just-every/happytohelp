import React from 'react';
import PropTypes from 'prop-types';
import MessageItem from './MessageItem';
import EventItem from './EventItem';
import EventGroup from './EventGroup';

export default function TranscriptMessageRun({ entries, conversation, actorName, showActor }) {
    const hasVisits = entries.some(entry => Array.isArray(entry) || entry.type === 'PAGE_VIEW');
    const grouped = entries.length > 1 || hasVisits;
    const content = entries.map((entry, index) => {
        if (Array.isArray(entry)) {
            return <EventGroup key={ `visits-${entry[0].id || index}` }
                conversation={ conversation } events={ entry } />;
        }
        if (entry.type === 'PAGE_VIEW') {
            return <EventItem key={ `visit-${entry.id || index}` }
                conversation={ conversation } item={ entry } />;
        }
        return <MessageItem key={ `message-${entry.id || entry.local_id || index}` }
            message={ entry } conversation={ conversation } grouped={ grouped }
            showActor={ !hasVisits && showActor && index === 0 } />;
    });

    if (!grouped) return content[0];

    return <div className="message-row transcript-message-row">
        <div className={ `transcript-message-card transcript-message-run${hasVisits ? ' transcript-message-run-with-visits' : ''}` }>
            { hasVisits && showActor && actorName && <div className="transcript-message-byline transcript-run-byline">
                <span className="transcript-message-sender">{ actorName }</span>
            </div> }
            <div className="transcript-run-entries">{ content }</div>
        </div>
    </div>;
}

TranscriptMessageRun.propTypes = {
    entries: PropTypes.array.isRequired,
    conversation: PropTypes.object,
    actorName: PropTypes.string,
    showActor: PropTypes.bool,
};
