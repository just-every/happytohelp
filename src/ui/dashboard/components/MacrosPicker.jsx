import React, { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useParams } from "react-router-dom";
import Api from "../api";
import useOnclickOutside from "react-cool-onclickoutside";
import { ChatContext } from "../contexts/ChatContext";

MacrosPicker.propTypes = {
    onPicked: PropTypes.func,
    projectId: PropTypes.string,
};

export default function MacrosPicker({ onPicked, projectId }) {
    const { urlProjectId } = useParams();
    // The global inbox has no project in the URL - the conversation supplies it
    const macrosProjectId = projectId || urlProjectId;
    const [ macros, setMacros ] = useState([]);
    const [ hasLoaded, setHasLoaded ] = useState(false);
    const [ preview, setPreview ] = useState('');
    const {
        currentAgent,
        activeConversationId,
        conversationData,
    } = useContext(ChatContext);

    const conversation = conversationData[activeConversationId];

    const loadMacros = (projectId,  params) => {
        return Api.get(`/projects/${ projectId }/macros`, params);
    }

    const handleClick = (macro) => {
        const contactName = conversation.contact.provided_name ? conversation.contact.provided_name : conversation.contact.name;
        const agentName = currentAgent.name;

        const regexp = /{{(.+)}}/gmi;
        const map = {
            'agent.name': agentName,
            'contact.name': contactName,
        }
        console.log(map);
        let content = macro.content;
        [...macro.content.matchAll(regexp)].forEach(match => {
            const placeholder = match[0];
            const split = match[1].split('|');
            const fallback = (split[1] ? split[1] : '').trim();
            const key = split[0].trim();
            const value = (map.hasOwnProperty(key) && map[key])
                ? map[key]
                : fallback;

            content = content.replace(placeholder, value);
        });

        onPicked(content);
    }

    useEffect(() => {
        loadMacros(macrosProjectId, {}).then(result => {
            setMacros(result.data);
            setHasLoaded(true);
        });
    }, [ macrosProjectId ]);

    if(!hasLoaded) {
        return null;
    }

    return (
        <div className="w-100 mt-2">
            <ul className="nav nav-tabs nav-tabs-sm border-0 gap-1">
                <li className="nav-item"><span className="nav-link active">Saved Replies</span></li>
                {macros.length > 0 && <li className="nav-item"><a href={`/projects/${macrosProjectId}/macros`} className="nav-link">Edit
                    Replies <i className="fe fe-external-link" /></a></li> }
                <li className="nav-item"><a href={`/projects/${macrosProjectId}/macros/create`} className="nav-link">Save a Reply <i className="fe fe-external-link" /></a></li>
            </ul>
            <div className="mt-3 pt-1 d-flex flex-column">
                <div className="row">
                    <div className="col">
                        {macros.map(macro => (
                            <a
                                href="#"
                                className="btn btn-sm btn-white me-2 mt-2"
                                onMouseOver={ () => setPreview(macro.content) }
                                onClick={ () => handleClick(macro) }
                                key={ `macro-${macro.id}` }>{ macro.title }</a>
                        ))}
                        {macros.length === 0 && <div className="text-muted">No replies saved</div>}
                    </div>
                </div>

            </div>
        </div>
    );
};
