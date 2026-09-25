import React, {useEffect, useRef, useState} from "react";
import {useFloating, useTransitionStyles, autoUpdate, arrow, offset, FloatingArrow} from '@floating-ui/react';

import '../styles/components/RobotMessage.scss';

export default function RobotMessage({ robotRef, messages }) {
    const arrowRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [openTime, setOpenTime] = useState(0);
    const [isOver, setIsOver] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [message, setMessage] = useState(messages[0]);
    const [messageIndex, setMessageIndex] = useState(0);
    const messageWaiting = messages.length > (messageIndex + 1);

    const {refs, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset(5),
            arrow({
                element: arrowRef,
            }),
        ],
        elements: {
            reference: robotRef,
        },
        placement: 'top-start',
        whileElementsMounted: autoUpdate,
    });
    const { isMounted, styles} = useTransitionStyles(context, {
        common: {
            transformOrigin: 'bottom',
        },
        duration: {
            open: 500,
            close: 250,
        },
        initial: {
            opacity: 0,
            transform: 'translateY(10px)',
        },
        open: {
            opacity: 1,
            transform: 'translateY(0px)',
        },
        close: {
            opacity: 0,
            transform: 'translateY(-10px)',
        },
    });

    const openRemainder = (target, min = 10) => {
        const timeLeft = target - (Date.now() - openTime);
        if(timeLeft < min) {
            return min;
        }
        return timeLeft;
    };

    useEffect(() => {
        let timeoutId;
        if(!isOpen && !hasOpened) {
            timeoutId = setTimeout(() => {
                setIsOpen(true);
                setHasOpened(true);
                setOpenTime(Date.now());
            }, messages.length > 1 ? 100 : 600);
        }
        if(isOpen && hasOpened) {
            if(!isOver) {
                timeoutId = setTimeout(() => {
                    setIsOpen(false);
                }, (messageWaiting ? openRemainder(1000) : openRemainder(2000 + (message.length * 60), 1000)));
            }
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [isOpen, hasOpened, isOver, messageWaiting]);

    useEffect(() => {
        let timeoutId;
        if(!isOpen && messageWaiting) {
            timeoutId = setTimeout(() => {
                const newIndex = messages.length - 1; // skip to end?
                if(messages[newIndex] === "") {
                    // If the next message is empty, skip it
                    setMessageIndex(newIndex);
                }
                else {
                    // Increment the message index and set the next message
                    setHasOpened(false);
                    setMessageIndex(newIndex);
                    setMessage(messages[newIndex]);
                }
            }, 260);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [isOpen, messageWaiting, messages]);

    return (
        <div id="robot-message">
            {isMounted && (
            <div className="robot-message" ref={refs.setFloating} style={floatingStyles}>
                <FloatingArrow ref={arrowRef} context={context} className="message-arrow" style={{...styles}} />
                <div className="message-content" style={{...styles}} onMouseOver={() => setIsOver(true)} onMouseOut={() => setIsOver(false)}>
                    <div className="message-close" onClick={() => setIsOpen(false)}><i className="fe fe-x"></i>
                    </div>
                    {message}
                </div>
            </div>)
            }
        </div>
    );
};
