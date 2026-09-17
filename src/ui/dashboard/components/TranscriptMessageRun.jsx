import React from 'react';
import PropTypes from 'prop-types';
import MessageItem from './MessageItem';
import MessageTimestamp from './MessageTimestamp';
import LocalAgentBadge from './LocalAgentBadge';

export default function TranscriptMessageRun({ entries, conversation, actorName, showActor, showHeader = true }) {
    const grouped = entries.length > 1;
    const content = entries.map((entry, index) => <MessageItem
        key={ `message-${entry.id || entry.local_id || index}` }
        message={ entry } conversation={ conversation } grouped={ grouped }
        showActor={ showActor && index === 0 } showHeader={ showHeader } />);

    if (!grouped) return content[0];

    return <div className="message-row transcript-message-row">
        { showHeader && <div className="transcript-message-header">
            <div className="transcript-message-byline">
                { showActor && actorName && <span className="transcript-message-sender">{ actorName }</span> }
                { showActor && <LocalAgentBadge agent={ entries[0]?.local_agent } /> }
                { entries.length > 0 && <MessageTimestamp message={ entries[0] }
                    relatedMessages={ entries.slice(1) } conversation={ conversation } /> }
            </div>
        </div> }
        <div className="transcript-message-card transcript-message-run">
            <div className="transcript-run-entries">{ content }</div>
        </div>
    </div>;
}

TranscriptMessageRun.propTypes = {
    entries: PropTypes.array.isRequired,
    conversation: PropTypes.object,
    actorName: PropTypes.string,
    showActor: PropTypes.bool,
    showHeader: PropTypes.bool,
};
