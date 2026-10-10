import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { useDashboardLocation } from '../../native/dashboard-state';
import { useMobileNavigation } from '../../native/MobileNavigation';
import { ChatContext } from '../contexts/ChatContext';
import formatCompactCount from '../utils/formatCompactCount';
import { INBOX_VIEWS, normalizeInboxView } from './inboxViewDefinitions';

export default function InboxViews() {
    const target = document.getElementById('navigation-inbox-views');
    const location = useDashboardLocation();
    const {setOpen} = useMobileNavigation();
    const searchParams = location.search;
    const { inboxViewCounts, setIsMainVisible } = useContext(ChatContext);
    const selectedView = normalizeInboxView(searchParams.view, inboxViewCounts);
    if (!target) {
        return null;
    }

    const onSelect = () => {
        const isCompactWorkspace = window.matchMedia('(max-width: 1199.98px)').matches;

        if (isCompactWorkspace) {
            setIsMainVisible(false);
            setOpen(false);
        }
    };

    return createPortal(
        <nav className="inbox-views" aria-label="Inbox views">
            { INBOX_VIEWS.map(view => {
                const count = inboxViewCounts[view.id];

                return <Link
                    key={ view.id }
                    to={location.pathname}
                    search={{ view: view.id, ...(searchParams.q ? { q: searchParams.q } : {}) }}
                    onClick={onSelect}
                    className={ `inbox-view-link${ selectedView === view.id ? ' is-active' : '' }` }
                    aria-current={ selectedView === view.id ? 'page' : undefined }>
                    <span className="inbox-view-label">{ view.label }</span>
                    { Number.isFinite(count) && <span
                        className="inbox-view-count"
                        title={ String(count) }
                        aria-label={ `Count: ${ count }` }>{ formatCompactCount(count) }</span> }
                </Link>;
            }) }
        </nav>,
        target
    );
}
