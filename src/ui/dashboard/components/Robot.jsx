import React, {useEffect, useRef, useState} from "react";

import '../styles/components/Robot.css';
import RobotMessage from "./RobotMessage";

function shuffle(array) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

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
    'Thinking…',
    'Hmmm…',
    'Let me think…',
    'Give me a second…',
    'I’m thinking…',
    'Just thinking…',
    'Processing…',
    'Just a moment…',
    'One moment…',
    'Thoughts are brewing…',
    'Words incoming…',
    'I’m on it…',
    'Words on the way…',
    'Analyzing…',
    'Hang tight, crafting the answer…',
    'Formulating a response…',
    'Phew, this one\'s tough…',
    'Yeah, I think I got this…',
    'Almost there…',
    'Words incoming…',
    'Brainstorming…',
    'Thoughts incoming…',
    'Witty comeback loading…',
    'Genius in progress… don’t interrupt!',
    'Loading… brain on a snack break!',
    'Wait for it… genius takes time!',
    'Still thinking… brain needs coffee!',
    'Still loading… greatness can’t be rushed!',
    'Thinking… don’t rush me!',
    'Hold up… genius at work!',
    'Almost ready… hold tight!',
    'Working on it… won’t be long!',
    'Hold on… good things take time!',
    'Thinking… thanks for your patience!',
    'Ideas formulating…',
    'Don’t worry, still on it…',
    'Calculating response…',
    'Contemplating deeply…',
    'The answer is near…',
    'I’m almost there…',
    'Hold on… synthesizing thoughts…',
    'Patience… brilliance in progress…',
    'Putting the pieces together…',
    'Almost solved…',
    'Eureka moment coming up…',
    'Stay tuned…',
    'Crafting perfection…',
    'Just a few more seconds…',
    'Polishing the answer…',
    'Let me think a little more…',
    'Crafting some magic…',
    'Making sure it’s just right…',
    'Fine-tuning the response…',
    'Almost ready to roll…',
    'Getting there…',
    'This might take a second…',
    'Gathering my thoughts…'
]);

let successMessagesIndex = 0;
const successMessages = shuffle([
    'Done!',
    'How\'s this?',
    'Like this one?',
    'Got it!',
    'Here you go!',
    'All set!',
    'Finished!',
    'Task complete!',
    'Here’s the result!',
    'Voilà!',
    'Ready!',
    'Done and dusted!',
    'Mission accomplished!',
    'Here’s what I found!',
    'This should do it!',
    'All done!',
    'Here’s the final touch!',
    'Wrapped up!',
    'That’s it!',
    'Complete!',
    'All done!',
    'Here it is!',
    'Ready for you!',
    'Check this out!',
    'Complete!',
    'That’s sorted!',
    'Delivered!',
    'Finished up!',
    'This is what I came up with!',
    'Take a look!',
    'Here’s the final result!',
    'Done and ready!',
    'All wrapped up!',
    'See what you think!',
    'Job done!',
    'Here’s what I’ve got!',
    'Task finished!',
    'Here’s the outcome!',
    'Done, what do you think?',
    'This is it!',
    'Here’s the answer!',
    'Ready when you are!',
    'This should be good!',
    'Finalized!',
    'All set to go!',
    'Done, take a look!',
    'Here’s what I made!',
    'That’s completed!',
    'Hope this works!',
    'Completed and ready!',
    'Finished and done!',
    'This is what I found!',
    'Wrapped and ready!',
    'Task done!',
    'Here you have it!',
    'Delivered and done!',
    'Done, what’s next?',
    'That’s wrapped up!',
    'Completed, check it out!',
    'Final result, here it is!',
]);

export default function Robot({ isLoading, addMessage, robotMessages, onClick }) {
    const [ rotateCircle, setRotateCircle ] = useState(false);
    const [ isThinking, setIsThinking ] = useState(false);
    const [ isLoadingLong, setIsLoadingLong ] = useState(0);
    const [ blink, setBlink ] = useState(false);
    const [robotRef, setRobotRef] = useState(null);

    useEffect(() => {
        let timeoutId;
        if(!isLoading) {
            timeoutId = setTimeout(() => {
                setRotateCircle(false);
            }, 1400);
        }
        else {
            if(rotateCircle) {
                timeoutId = setTimeout(() => {
                    setRotateCircle(false);
                }, 1400);
            }
            else {
                timeoutId = setTimeout(() => {
                    setRotateCircle(true);
                }, 100);
            }
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [isLoading, rotateCircle]);

    useEffect(() => {
        let timeoutId;
        if(isLoading && !isThinking) {
            timeoutId = setTimeout(() => {
                setIsThinking(true);
            }, 1500);
        }
        if(!isLoading && isThinking) {
            setIsThinking(false);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [isLoading, isThinking]);

    useEffect(() => {
        let timeoutId;
        if(isLoading) {
            timeoutId = setTimeout(() => {
                setIsLoadingLong(isLoadingLong + 1);
                addMessage(loadingMessages[loadingMessagesIndex]);
                ++loadingMessagesIndex;
                if(loadingMessagesIndex >= loadingMessages.length) {
                    loadingMessagesIndex = 0;
                }
            }, isLoadingLong > 0 ? Math.floor((Math.random() * 3000) + 3000) : Math.floor((Math.random() * 1000) + 1500));
        }
        if(!isLoading && isLoadingLong > 0) {
            if(isLoadingLong > 1) {
                addMessage(successMessages[successMessagesIndex]);
                ++successMessagesIndex;
                if(successMessagesIndex >= successMessages.length) {
                    successMessagesIndex = 0;
                }
            }
            else {
                addMessage("");
            }
            setIsLoadingLong(0);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [isLoading, isLoadingLong]);

    useEffect(() => {
        let timeoutId;
        if(isThinking && !blink) {
            timeoutId = setTimeout(() => {
                setBlink(true);
            }, Math.floor(Math.random() * (3000 - 800) + 800));
        }
        if(isThinking && blink) {
            timeoutId = setTimeout(() => {
                setBlink(false);
            }, 500);
        }
        if(!isThinking && blink) {
            setBlink(false);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [isThinking, blink]);

    return (
        <div ref={setRobotRef}>
            { robotMessages.length > 0 && <RobotMessage robotRef={robotRef} messages={robotMessages} /> }
            <svg
                onClick={ onClick }
                className={"robot" + (isLoading ? ' loading' : '') + (rotateCircle ? ' rotateCircle' : '') + (isThinking ? ' thinking' : '')}
                version="1.1" xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 104 115">
                <g className="background">
                    <g className="circle">
                        <path className="circle-top"
                              d="M94.61,0L83.18,11.43L72.82,21.79l-0.13,0.13l-0.27-0.4c-14.49-9.83-34.29-8.24-47.04,4.52 C12.49,38.94,11.02,59,20.99,73.49L10.76,83.85c-15.68-20.2-14.22-49.43,4.39-68.04c15.28-15.28,37.87-19,56.74-11.03 C71.89,4.78,83.85,9.44,94.61,0L94.61,0z"/>
                        <path className="circle-bottom"
                              d="M8.76,104.72l11.43-11.43l10.23-10.36l0.13-0.13l0.27,0.4c14.49,9.83,34.29,8.24,47.18-4.52 c12.89-12.89,14.35-32.96,4.25-47.44l10.37-10.37c15.55,20.2,14.09,49.44-4.52,68.04c-15.28,15.28-37.87,19-56.74,11.03 C31.35,99.93,19.39,95.28,8.76,104.72L8.76,104.72z"/>
                    </g>
                </g>
                <g className="foreground">
                    <g className="smile">
                        <path
                            d="M 51.69 74.55 C 56.675 74.55 61.26 72.855 64.931 70.014 C 68.603 67.173 71.749 62.041 72.69 58.6 C 73.149 56.92 65.959 56.82 65.25 58.6 C 64.422 60.68 62.163 63.383 59.82 64.927 C 57.478 66.473 54.685 67.37 51.69 67.37 C 48.635 67.37 45.813 66.473 43.471 64.927 C 41.13 63.382 38.886 60.527 38.14 58.6 C 37.403 56.696 30.022 56.777 30.57 58.6 C 31.448 61.518 34.65 67.173 38.336 70.014 C 42.023 72.855 46.64 74.55 51.69 74.55 Z"/>
                    </g>
                    <g className={"eyes" + (blink ? " blink" : "")} style={{fill: 'rgba(97, 86, 210, 0.9)'}}>
                        <rect className="eyes-left" x="32" y="36" width="12" height="10" rx="3" ry="3"></rect>
                        <rect className="eyes-right" x="60" y="36" width="12" height="10" rx="3" ry="3"></rect>
                    </g>
                </g>
            </svg>
        </div>

    );
};
