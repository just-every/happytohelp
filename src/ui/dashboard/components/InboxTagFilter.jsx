import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../../native/transport';

/** The tag filter exists only once the workspace has a tag to filter by. */
export default function InboxTagFilter({ projectId, value, onChange }) {
    const [ tags, setTags ] = useState([]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        setTags([]);

        if (projectId) {
            nativeRequest(`/api/dashboard/projects/${ projectId }/tags`, {signal: controller.signal})
                .then(result => { if (active) setTags(result.data); })
                .catch(() => { if (active) setTags([]); });
        }

        return () => { active = false; controller.abort(); };
    }, [ projectId ]);

    if (!projectId || tags.length === 0) return null;

    return <select className="form-select inbox-tag-filter" aria-label="Filter conversations by tag" value={ value } onChange={ event => onChange(event.target.value) }>
        <option value="">All tags</option>
        { tags.map(tag => <option key={ tag.id } value={ tag.id }>{ tag.name }</option>) }
    </select>;
}
