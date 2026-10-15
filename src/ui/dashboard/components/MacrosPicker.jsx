import React, { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from '@tanstack/react-router';
import useInboxRoute from "../hooks/useInboxRoute";
import Api from "../api";
import useOnclickOutside from "react-cool-onclickoutside";
import { ChatContext } from "../contexts/ChatContext";

MacrosPicker.propTypes = {
    onPicked: PropTypes.func,
    projectId: PropTypes.string,
};

export default function MacrosPicker({ onPicked, projectId }) {
    const { urlProjectId } = useInboxRoute();
    // The global inbox has no project in the URL - the conversation supplies it
    const macrosProjectId = projectId || urlProjectId;
    const [ macros, setMacros ] = useState([]);
    const [ hasLoaded, setHasLoaded ] = useState(false);
    const [ loadError, setLoadError ] = useState(null);
    const [ preview, setPreview ] = useState('');
    const {
        currentAgent,
        activeConversationId,
        conversationData,
    } = useContext(ChatContext);

    const conversation = conversationData[activeConversationId];

    const handleClick = (macro) => {
        const contactName = conversation.contact.provided_name?.trim() || conversation.contact.name?.trim();
        const agentName = currentAgent.name;

        const regexp = /{{([^{}]+)}}/g;
        const map = {
            'agent.name': agentName,
            'contact.name': contactName,
        }
        const content = macro.content.replace(regexp, (_, expression) => {
            const split = expression.split('|');
            const fallback = (split[1] ? split[1] : '').trim();
            const key = split[0].trim();
            return (Object.hasOwn(map, key) && map[key])
                ? map[key]
                : fallback || (key === 'contact.name' ? 'there' : '');
        });

        onPicked(content);
    }

    useEffect(() => {
        const controller = new AbortController();
        setMacros([]);
        setHasLoaded(false);
        setLoadError(null);
        if (!macrosProjectId) return;
        Api.get(`/projects/${ macrosProjectId }/macros`, {}, { signal: controller.signal }).then(result => {
            if (controller.signal.aborted) return;
            setMacros(result.data);
            setHasLoaded(true);
        }).catch(error => {
            if (!controller.signal.aborted) setLoadError(error);
        });
        return () => controller.abort();
    }, [ macrosProjectId ]);

    if (loadError) return <p role="alert">Couldn’t load saved replies.</p>;

    if(!hasLoaded) {
        return null;
    }

    return (
        <div className="w-100 mt-2">
            <ul className="nav nav-tabs nav-tabs-sm border-0 gap-1">
                <li className="nav-item"><span className="nav-link active">Saved Replies</span></li>
                {macros.length > 0 && <li className="nav-item"><Link to={`/projects/${macrosProjectId}/macros`} className="nav-link">Edit
                    Replies <i className="fe fe-external-link" /></Link></li> }
                <li className="nav-item"><Link to={`/projects/${macrosProjectId}/macros/create`} className="nav-link">Save a Reply <i className="fe fe-external-link" /></Link></li>
            </ul>
            <div className="mt-3 pt-1 d-flex flex-column">
                <div className="row">
                    <div className="col">
                        {macros.map(macro => (
                            <a
                                href="#"
                                className="btn btn-sm btn-white me-2 mt-2"
                                onMouseOver={ () => setPreview(macro.content) }
                                onClick={ event => { event.preventDefault(); handleClick(macro); } }
                                key={ `macro-${macro.id}` }>{ macro.title }</a>
                        ))}
                        {macros.length === 0 && <div className="text-muted">No replies saved</div>}
                    </div>
                </div>

            </div>
        </div>
    );
};
