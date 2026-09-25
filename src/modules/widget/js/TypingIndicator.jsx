import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {normalizeTypingMessage} from './context/typingState';

function shuffle(array) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {

        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

let loadingMessagesIndex = 0;
const loadingMessages = shuffle([
    'Thinking',
    'Hmmm',
    'Let me think',
    'Give me a second',
    'I’m thinking',
    'Just thinking',
    'Processing',
    'Just a moment',
    'One moment',
    'Thoughts are brewing',
    'Words incoming',
    'I’m on it',
    'Words on the way',
    'Analyzing',
    'Hang tight, crafting the answer',
    'Formulating a response',
    'Phew, this one\'s tough',
    'Yeah, I think I got this',
    'Almost there',
    'Words incoming',
    'Brainstorming',
    'Thoughts incoming',
    'Witty comeback loading',
    'Genius in progress… don’t interrupt',
    'Loading… brain on a snack break',
    'Wait for it… genius takes time',
    'Still thinking… brain needs coffee',
    'Still loading… greatness can’t be rushed',
    'Thinking… don’t rush me',
    'Hold up… genius at work',
    'Almost ready… hold tight',
    'Working on it… won’t be long',
    'Hold on… good things take time',
    'Thinking… thanks for your patience',
    'Ideas formulating',
    'Don’t worry, still on it',
    'Calculating response',
    'Contemplating deeply',
    'The answer is near',
    'I’m almost there',
    'Hold on… synthesizing thoughts',
    'Patience… brilliance in progress',
    'Putting the pieces together',
    'Almost solved',
    'Eureka moment coming up',
    'Stay tuned',
    'Crafting perfection',
    'Just a few more seconds',
    'Polishing the answer',
    'Let me think a little more',
    'Crafting some magic',
    'Making sure it’s just right',
    'Fine-tuning the response',
    'Almost ready to roll',
    'Getting there',
    'This might take a second',
    'Gathering my thoughts'
]);

export default function TypingIndicator({ agentTyping }) {
    const { message: rawMessage, immediate } = agentTyping || {};
    const message = normalizeTypingMessage(rawMessage);
    const messageRef = useRef(null);
    const dotsRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [currentMessage, setCurrentMessage] = useState(message);
    const [showMessage, setShowMessage] = useState(false);
    const [visibleMessage, setVisibleMessage] = useState('');

    useEffect(() => {
        if(message !== currentMessage) {
            setCurrentMessage(message);
        }
    }, [message, currentMessage]);

    useEffect(() => {
        let timeoutId;
        if(immediate && currentMessage) {
            setShowMessage(true);
        }
        else if(currentMessage && !showMessage) {
            // Only show the message after a set time
            timeoutId = setTimeout(() => {
                setShowMessage(true);
            }, 5000);
        }
        else if(!currentMessage && showMessage) {
            setShowMessage(false);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [currentMessage, showMessage, immediate]);

    useEffect(() => {
        let timeoutId;
        if((currentMessage && showMessage) || (!currentMessage && !showMessage)) {
            timeoutId = setTimeout(() => {
                setCurrentMessage(loadingMessages[loadingMessagesIndex]);
                setShowMessage(true);
                ++loadingMessagesIndex;
                if(loadingMessagesIndex >= loadingMessages.length) {
                    loadingMessagesIndex = 0;
                }
            }, (!currentMessage && !showMessage) ? 5000 : Math.floor((Math.random() * 2000) + 4000));
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [currentMessage, showMessage]);

    useEffect(() => {
        let timeoutId;
        if(visibleMessage !== currentMessage) {
            timeoutId = setTimeout(() => {
                setVisibleMessage(currentMessage);
            }, 300);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [visibleMessage, currentMessage]);

    useLayoutEffect(() => {
        if(!showMessage) {
            if(dotsRef.current) {
                setContainerWidth(dotsRef.current.offsetWidth);
            }
        }
        else if(visibleMessage && messageRef.current) {
            setContainerWidth(messageRef.current.offsetWidth);
        }
    }, [showMessage, visibleMessage]);

    return (
        <div className={"happytohelp-typing-message"+(showMessage ? " happytohelp-typing-message-has-message" : "")} style={ {width: containerWidth+"px"} }>
            {showMessage &&
                <span ref={messageRef} className={"happytohelp-animated-text" + (visibleMessage !== currentMessage ? " happytohelp-animated-text-transition" : "")}>
                    {normalizeTypingMessage(visibleMessage).replace(/[.!?…]+$/, '')}…
                </span>}
            {!showMessage &&
                <div ref={dotsRef} key="happytohelp-typing-indicator" className="happytohelp-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>}
        </div>
    );
}
