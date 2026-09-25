import React, {useEffect} from 'react';
import PropTypes from "prop-types";
import { useAtTop } from 'react-scroll-to-bottom';
import BucketGroup from "./BucketGroup";

function ConversationBody({ conversation, buckets, setAtTop }) {
    const [ atTop ] = useAtTop();

    // Pass atTop hook state changes back up to the Conversation
    useEffect(() => {
        setAtTop(atTop);
    }, [ atTop ] );

    return (
        <div className="chat-body conversation-transcript">
            <BucketGroup conversation={ conversation } buckets={ buckets } topLevel={ true } />
        </div>
    );
}

ConversationBody.propTypes = {
    conversation: PropTypes.object,
    buckets: PropTypes.array,
    setAtTop: PropTypes.func,
};

export default ConversationBody;
