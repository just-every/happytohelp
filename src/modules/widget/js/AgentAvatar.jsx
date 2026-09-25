import React, {useContext} from 'react';

import AIAvatar from "./AIAvatar";
import AppContext from "./context/AppContext";

export default function AgentAvatar({ agent, canAnimate = false }) {
    const context = useContext(AppContext);

    if(agent.is_ai) {
        return <AIAvatar ai={agent.ai} canAnimate={ canAnimate } />;
    }

    let classes = ["happytohelp-agent-avatar"];
    if(agent.avatar_url) {
        classes.push("happytohelp-agent-avatar-image");
    }
    else {
        classes.push("happytohelp-agent-avatar-initials");
    }

    return (
        <span className="happytohelp-ai-avatar-container">
            <div className={classes.join(" ")} style={context.theme.avatar}>
            {agent.avatar_url && <img className="happytohelp-avatar-static" alt="avatar"
                                      src={agent.avatar_url}/>}
                {!agent.avatar_url && <span>{agent.initials}</span>}
            </div>
        </span>
    );
}
