import React, {useContext, useEffect, useState, useMemo, useLayoutEffect} from 'react';

import {formatRelative, parseISO} from "date-fns";
import AppContext from "./context/AppContext";

export default function ChatStatus({ isLast, message, agentTyping }) {
    const showInitial = !message.sending || message.failed_send || (message.uploading_media && message.uploading_media.length > 0);
    const context = useContext(AppContext);
    const [show, setShow] = useState(showInitial);
    const [animate, setAnimate] = useState(false);
    const [lastStatus, setLastStatus] = useState('');

    let classes = ["happytohelp-chat-box-status", "happytohelp-text-muted"];
    if (animate) {
        classes.push("happytohelp-chat-box-status-animate");
    }
    if (message.contact_id) {
        classes.push("happytohelp-chat-box-status-local");
    } else {
        classes.push("happytohelp-chat-box-status-agent");
    }
    if(!agentTyping.typing && message.sending && message.failed_send) {
        classes.push("happytohelp-chat-box-status-failed");
    }

    const status = useMemo(() => {
        let result = [];
        if(!agentTyping.typing) {
            if(message.sending) {
                let text = 'sending';
                if(message.failed_send) {
                    text = 'failed';
                }
                else if(message.uploading_media && message.uploading_media.length > 0) {
                    let suffix = message.uploading_media.length > 1 ? 's' : '';
                    if(message.uploading_media.every(media => media.isImage)) {
                        text = `sending_image${suffix}`;
                    }
                    else {
                        text = `sending_file${suffix}`;
                    }
                }
                result.push(context.text.chat[text]);
            }
            else if(isLast && message.created_at && (!message.chunked || message.chunked_complete)) {
                result.push(message.contact_id ? context.text.chat.sent : context.text.chat.received);
                result.push(formatRelative(parseISO(message.created_at), new Date()));
            }
        }
        return result;
    }, [message, agentTyping.typing, isLast, context.text.chat]);

    useEffect(() => {
        if(show && !showInitial) {
            if(lastStatus && lastStatus !== status.join(" ")) {
                setShow(false);
                setAnimate(false);
            }
            setLastStatus(status.join(" "));
        }
    }, [show, lastStatus, status, showInitial]);

    useEffect(() => {
        let timeoutId;
        // This will set the animation state after the component mounts
        if(!show) {
            timeoutId = setTimeout(() => {
                setShow(true);
            }, 2000);
        }
        return () => timeoutId && clearTimeout(timeoutId);
    }, [show]);

    useLayoutEffect(() => {
        let timeoutId;
        // This will set the animation state after the component mounts
        if(show) {
            timeoutId = setTimeout(() => {
                setAnimate(true);
            }, showInitial ? 500 : 10);
        }
        return () => timeoutId && clearTimeout(timeoutId);
    }, [show, showInitial]);

    return show && status.length > 0 ? <div
        className={classes.join(" ")}>
        { status.join(" ") }
        { (message.sending && !message.failed_send && message.uploading_media && message.uploading_media.length > 0) && <div className={"happytohelp-chat-box-status-progress"}><div /></div> }
    </div> : null;
}
