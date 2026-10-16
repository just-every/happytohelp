import React, { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from '@tanstack/react-router';
import useInboxRoute from "../hooks/useInboxRoute";
import Api from "../api";
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
    const [ search, setSearch ] = useState('');
    const [ page, setPage ] = useState(1);
    const [ pagination, setPagination ] = useState(null);
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
        const timer = setTimeout(() => Api.get(`/projects/${ macrosProjectId }/macros`, {search, page, sort: 'title', direction: 'asc'}, { signal: controller.signal }).then(result => {
            if (controller.signal.aborted) return;
            setMacros(result.data);
            setPagination(result.pagination);
            setHasLoaded(true);
        }).catch(error => {
            if (!controller.signal.aborted) setLoadError(error);
        }), search ? 200 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [ macrosProjectId, search, page ]);
    useEffect(() => { setPage(1); setSearch(''); }, [macrosProjectId]);
    if (!macrosProjectId) return null;

    return (
        <div className="w-100 mt-2">
            <ul className="nav nav-tabs nav-tabs-sm border-0 gap-1">
                <li className="nav-item"><span className="nav-link active">Saved Replies</span></li>
                <li className="nav-item"><Link to={`/projects/${macrosProjectId}/macros`} className="nav-link">Edit
                    Replies <i className="fe fe-external-link" /></Link></li>
                <li className="nav-item"><Link to={`/projects/${macrosProjectId}/macros/create`} className="nav-link">Save a Reply <i className="fe fe-external-link" /></Link></li>
            </ul>
            <div className="mt-3 pt-1 d-flex flex-column">
                <input className="form-control" type="search" aria-label="Search saved replies" placeholder="Search saved replies" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
                {loadError && <p role="alert">Couldn’t load saved replies.</p>}
                {!hasLoaded && !loadError && <p role="status">Loading…</p>}
                <div className="row">
                    <div className="col">
                        {macros.map(macro => (
                            <a
                                href="#"
                                className="btn btn-sm btn-white me-2 mt-2"
                                onClick={ event => { event.preventDefault(); handleClick(macro); } }
                                key={ `macro-${macro.id}` }>{ macro.title }</a>
                        ))}
                        {hasLoaded && macros.length === 0 && <div className="text-muted">{search ? 'No matching replies' : 'No replies saved'}</div>}
                    </div>
                </div>
                {pagination && <nav aria-label="Saved reply picker pages" className="d-flex flex-wrap gap-2 align-items-center mt-3"><button type="button" className="btn btn-sm btn-white" disabled={!hasLoaded || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span role="status">Page {page}</span><button type="button" className="btn btn-sm btn-white" disabled={!hasLoaded || !pagination.hasMore} onClick={() => setPage(page + 1)}>Next</button></nav>}
            </div>
        </div>
    );
};
