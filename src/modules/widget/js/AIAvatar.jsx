import React, {useState, useEffect, useContext} from 'react';

import AppContext from "./context/AppContext";

export default function AIAvatar({ ai, canAnimate = false}) {
    const context = useContext(AppContext);
    const [animating, setAnimated] = useState(false);

    if(canAnimate && !ai.is_animated) {
        canAnimate = false;
    }

    useEffect(() => {
        let timeoutId;
        if(canAnimate) {
            timeoutId = setTimeout(() => {
                setAnimated(!animating);
            }, (Math.random() * (animating ? 6000 : 8000)) + (animating ? 1000 : 2000));
        }
        else if(animating) {
            setAnimated(false);
        }
        // Cleanup function to clear the timeout if the component unmounts
        return () => timeoutId && clearTimeout(timeoutId);
    }, [canAnimate, animating]);

    if(!ai) return null;

    let classes = ["happytohelp-ai-avatar"];
    if(animating) classes.push("happytohelp-ai-avatar-animating");

    const avatarUrl = ai.avatar_url ?? ai.avatar;
    const avatarUrlMove = ai.animated_avatar_url || avatarUrl;
    if (!avatarUrl) {
        const initials = (ai.name || 'AI').trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2);
        return <span className="happytohelp-ai-avatar-container"><div className="happytohelp-agent-avatar happytohelp-agent-avatar-initials" style={context.theme.avatar}><span>{initials}</span></div></span>;
    }

    return (
        <span className="happytohelp-ai-avatar-container">
            <div className={classes.join(" ")} style={ context.theme.avatar }>
                <img className="happytohelp-avatar-static" alt="avatar"
                     src={ avatarUrl }/>
                <img className="happytohelp-avatar-move" alt="avatar movement"
                     src={ avatarUrlMove }/>
            </div>
        </span>
    );
}
