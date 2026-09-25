import React, {useContext, useLayoutEffect, useRef, useState} from 'react';


import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faAngleDown, faAngleUp} from "@fortawesome/free-solid-svg-icons";
import AgentAvatar from "./AgentAvatar";
import {ConnectContext} from "./context/ConnectContext";
import AppContext from "./context/AppContext";
import {faTimes as falTimes} from "@fortawesome/free-solid-svg-icons";
export default function ChatHeader({ setOpen, headerExpanded, setHeaderExpanded}) {
    const context = useContext(AppContext);
    const {
        thinking,
        conversationSettings,
        setConversationSettings,
        sendMessage,
        getCurrentAgent,
    } = useContext(ConnectContext);

    const contentEl = useRef(null);
    const [lastHeight, setLastHeight] = useState(0);

    const currentAgent = getCurrentAgent();
    const canExpand = conversationSettings && (conversationSettings.ais.length + (conversationSettings.is_human_response_enabled ? 1 : 0)) > 1;
    if(!canExpand && headerExpanded) {
        headerExpanded = false;
    }

    const handleAgentChange = (event, agent) => {
        event.preventDefault();
        setHeaderExpanded(false);
        const aiId = agent.is_ai ? agent.id : null;
        if(aiId !==  conversationSettings.ai_id) {
            setConversationSettings({ ...conversationSettings, ai_id: aiId });
            sendMessage('assignAi', { ai_id: aiId });
        }
    }

    useLayoutEffect(() => {
        if(contentEl.current) {
            setLastHeight(contentEl.current.scrollHeight);
        }
    }, [headerExpanded]);

    let content;
    if(headerExpanded) {
        let agents = [];
        conversationSettings.ais.forEach((aiAgent) => {
            let agent = structuredClone(aiAgent);
            agent.ai = aiAgent;
            agent.is_ai = true;
            agents.push(agent);
        });
        if(conversationSettings.is_human_response_enabled) {
            agents.push(conversationSettings.human);
        }

        let agentRows = [];
        agents.forEach((agent, index) => {
            agentRows.push(<div key={index} className={"happytohelp-chat-header-agent"+(currentAgent.id === agent.id ? " happytohelp-chat-header-agent-active" : "")} onClick={(event) => handleAgentChange(event, agent)}>
                <AgentAvatar agent={ agent } />
                <div className="happytohelp-insight-agent">
                    <div>
                        <span className="happytohelp-insight-agent-name">{agent.first_name ?? agent.name}</span>
                        <span className="happytohelp-insight-agent-seperator">•</span>
                        <span className="happytohelp-insight-agent-role">{agent.role ?? (agent.is_ai ? context.text.ai.ai : context.text.ai.human)}</span>
                    </div>
                    <div className="happytohelp-insight-agent-info">{agent.is_ai ? context.text.ai.ai_response : context.text.ai.human_response}</div>
                </div>
            </div>);
        });

        content = (
            <div className="happytohelp-chat-header-title-agents" style={ context.theme.window }>
                <div className="happytohelp-chat-header-desc" onClick={() => setHeaderExpanded(false)}>
                    <div className="happytohelp-chat-header-desc-title">
                        {context.text.ai.selection}
                        <span className="happytohelp-chat-header-edit-inline">
                            <FontAwesomeIcon icon={faAngleUp}/>
                        </span>
                    </div>
                    <div className="happytohelp-chat-header-edit">
                        <FontAwesomeIcon icon={faAngleUp}/>
                    </div>
                </div>
                {agentRows}
            </div>
        );
    }
    else if(currentAgent) {
        content = (
            <div className={"happytohelp-chat-header"+(canExpand ? "" : " happytohelp-chat-no-action")} onClick={() => canExpand && setHeaderExpanded(true)} style={ context.theme.window }>
                <AgentAvatar agent={currentAgent} canAnimate={thinking}/>
                <div className="happytohelp-insight-agent">
                    <span className="happytohelp-insight-agent-name">
                        {currentAgent.first_name ?? currentAgent.name}
                        {canExpand && <span className="happytohelp-chat-header-edit-inline-tiny">
                            <FontAwesomeIcon icon={faAngleDown}/>
                        </span>}
                    </span>
                    <span className="happytohelp-insight-agent-seperator">•</span>
                    <span className="happytohelp-insight-agent-role">
                        {currentAgent.role ?? (currentAgent.is_ai ? context.text.ai.ai : context.text.ai.human)}
                        {canExpand && <span className="happytohelp-chat-header-edit-inline">
                            <FontAwesomeIcon icon={faAngleDown}/>
                        </span>}
                        {!currentAgent.is_ai && <div className="happytohelp-insight-agent-info"><span className="happytohelp-insight-agent-seperator-tiny">•</span>{context.text.ai.human_response}
                        </div>}
                    </span>
                </div>
                {canExpand && <div className="happytohelp-chat-header-edit">
                    <FontAwesomeIcon icon={faAngleDown}/>
                </div>}
            </div>
        );
    }

    let style = {};
    if(lastHeight) {
        style = {height: lastHeight};
    }

    return <div className={"happytohelp-chat-header-container " + (headerExpanded ? "happytohelp-chat-header-container-expanded" : "happytohelp-chat-header-container-collapsed")} style={style}>
        <div className={"happytohelp-close"} onClick={() => { setOpen(false) }}>
            <FontAwesomeIcon icon={falTimes}/>
        </div>
        <div ref={contentEl}>
            {content}
        </div>
    </div>;
};
