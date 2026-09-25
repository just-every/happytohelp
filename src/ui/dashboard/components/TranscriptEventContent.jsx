import React from 'react';
import PropTypes from 'prop-types';

function TranscriptEventContent({ actorName = null, children, showActor = false, time }) {
    const hasActor = showActor && Boolean(actorName);

    return <div className={ `transcript-event-content${hasActor ? ' transcript-event-has-actor' : ''}` }>
        { hasActor && <div className="transcript-event-actor-row">
            <span className="transcript-event-actor">{ actorName }</span>
        </div> }
        <div className="transcript-event-detail">
            <span className="transcript-event-copy">{ children }</span>
            { time }
        </div>
    </div>;
}

TranscriptEventContent.propTypes = {
    actorName: PropTypes.string,
    children: PropTypes.node,
    showActor: PropTypes.bool,
    time: PropTypes.node,
};

export default TranscriptEventContent;
