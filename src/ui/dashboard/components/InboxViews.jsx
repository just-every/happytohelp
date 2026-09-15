import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { useDashboardLocation } from '../../native/dashboard-state';
import { ChatContext } from '../contexts/ChatContext';
import formatCompactCount from '../utils/formatCompactCount';
import { INBOX_VIEWS, normalizeInboxView } from './inboxViewDefinitions';

function closeMobileNavigation(element) {
    const collapse = element.currentTarget.closest('.navbar-collapse');
    if (!collapse || !collapse.classList.contains('show')) {
        return;
    }

    // The shared layout loads Bootstrap before the inbox bundle. Reuse that
    // instance so a second data API cannot toggle navigation controls twice.
    window.Collapse.getOrCreateInstance(collapse).hide();
}

export default function InboxViews() {
    const target = document.getElementById('navigation-inbox-views');
    const location = useDashboardLocation();
    const searchParams = location.search;
    const { inboxViewCounts, setIsMainVisible } = useContext(ChatContext);
    const selectedView = normalizeInboxView(searchParams.view);
    if (!target) {
        return null;
    }

    const onSelect = event => {
        const isCompactWorkspace = window.matchMedia('(max-width: 1199.98px)').matches;

        if (isCompactWorkspace) {
            setIsMainVisible(false);
        }
        closeMobileNavigation(event);
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
