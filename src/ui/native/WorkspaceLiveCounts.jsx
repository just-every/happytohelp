import { useEffect, useRef, useState } from 'react';
import useWindowFocus from 'use-window-focus';
import { connectProject } from './transport';
import useInboxRefresh from '../dashboard/hooks/useInboxRefresh';
import Favcount from '../dashboard/favcount';

const PROJECT_SOCKET_SETTLE_MS = 50;
const ICON = '/homepage/media/brands/happytohelp-favicon.svg';

/** Outside the inbox, hold the same project connections the inbox holds so the
 * tab's open-conversation count follows committed activity. Renders nothing. */
export default function WorkspaceLiveCounts({ settings }) {
    const { isGlobalInbox, projects } = settings;
    const projectId = settings.project?.id;
    const connectedProjectIds = isGlobalInbox ? Object.keys(projects || {}) : (projectId ? [ projectId ] : []);
    const [ lastConnected, setLastConnected ] = useState(0);
    const isWindowFocused = useWindowFocus();
    const { inboxViewCounts, refreshInboxData } = useInboxRefresh({
        isGlobalInbox, projectId, lastConnected, isWindowFocused, initialCounts: settings.inboxViewCounts,
    });
    const favicon = useRef(null);

    useEffect(() => {
        if (!Number.isFinite(inboxViewCounts.open)) return;
        favicon.current ??= new Favcount(ICON, ICON);
        favicon.current.set(inboxViewCounts.open);
    }, [ inboxViewCounts.open ]);

    useEffect(() => {
        // As in the inbox: let the mount settle, since closing a socket mid-handshake logs a browser warning.
        let close = [];
        const timer = setTimeout(() => {
            close = connectedProjectIds.map(id => connectProject(id,
                () => refreshInboxData(),
                () => { refreshInboxData(); setLastConnected(Date.now()); },
                error => console.warn(error.message)));
        }, PROJECT_SOCKET_SETTLE_MS);
        return () => { clearTimeout(timer); close.forEach(dispose => dispose()); };
    }, [ connectedProjectIds.join(',') ]);

    return null;
}
