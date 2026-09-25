import React, { useState } from 'react';
import PropTypes from 'prop-types';
import EventItem from "./EventItem";
import Moment from '../../native/Moment';
import TranscriptEventContent from './TranscriptEventContent';

function EventGroup({ conversation, events, showActor = false, actorName = null }) {
    const [ isExpanded, setIsExpanded ] = useState(false);
    const firstEvent = events[0];
    const visitCount = events.reduce((total, event) => total + (event.count || 1), 0);

    const handleToggle = () => {
        setIsExpanded(previous => !previous);
    }

    return (<div className={ `message-row message-row-close transcript-event transcript-event-page-view-group small text-gray-600${isExpanded ? ' is-expanded' : ''}` }>
            <TranscriptEventContent
                actorName={ actorName }
                showActor={ showActor }
                time={ !isExpanded && <time className="transcript-event-time" dateTime={ firstEvent.created_at }>
                    <Moment format="LT" date={ firstEvent.created_at } />
                </time> }>
                { isExpanded ? 'Page visits ' : <>Visited <a href={ firstEvent.payload } target="_blank" rel="noopener noreferrer" className="text-gray-800 pageview">{ firstEvent.payload }</a>{' '}</> }
                <button type="button" className="transcript-event-group-toggle" onClick={ handleToggle } aria-expanded={ isExpanded }>
                    ({ isExpanded ? 'Hide' : visitCount } { isExpanded ? 'visits' : visitCount === 1 ? 'visit' : 'visits' })
                </button>
            </TranscriptEventContent>
            { isExpanded && <div className="transcript-event-page-view-list">
                { events.map((event, index) => <EventItem
                    conversation={ conversation }
                    item={ event }
                    key={ event.id || index }
                    showActor={ false }
                    actorName={ actorName }
                    inEventGroup />) }
            </div> }
        </div>);
}

EventGroup.propTypes = {
    events: PropTypes.array,
    showActor: PropTypes.bool,
    actorName: PropTypes.string,
};

export default EventGroup;
