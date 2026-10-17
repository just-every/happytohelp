import React, { useContext } from 'react';
import { Link } from '@tanstack/react-router';
import useLiveInboxLocation from '../hooks/useLiveInboxLocation';
import { useMobileNavigation } from '../../native/MobileNavigation';
import { ChatContext } from '../contexts/ChatContext';
import formatCompactCount from '../utils/formatCompactCount';
import { INBOX_VIEWS, normalizeInboxView } from './inboxViewDefinitions';

/** The five views as one quiet row of text above the conversation list. A disc appears only where a count above zero asks for attention. */
export default function InboxViews() {
    // The row follows the router's live location, so which link is current and what each link carries never trail a loading page.
    const location = useLiveInboxLocation();
    const { setOpen } = useMobileNavigation();
    const searchParams = location.search;
    const { inboxViewCounts, setIsMainVisible } = useContext(ChatContext);
    const selectedView = normalizeInboxView(searchParams.view, inboxViewCounts);

    const onSelect = () => {
        if (window.matchMedia('(max-width: 1199.98px)').matches) {
            setIsMainVisible(false);
            setOpen(false);
        }
    };

    return <nav className="inbox-views" data-testid="inbox-views" aria-label="Inbox views">
        { INBOX_VIEWS.map(view => {
            const count = inboxViewCounts[view.id];
            const current = selectedView === view.id;

            return <Link
                key={ view.id }
                to={ location.pathname }
                search={{ ...searchParams, saved_view: undefined, filters: undefined, sort: undefined, view: view.id, assigned_to: view.id === 'mine' || view.id === 'unassigned' ? undefined : searchParams.assigned_to }}
                onClick={ onSelect }
                className={ `inbox-view-link${ current ? ' is-active' : '' }` }
                aria-current={ current ? 'page' : undefined }>
                <span className="inbox-view-label">{ view.label }</span>
                { view.disc && count > 0 && <span
                    className="inbox-view-count"
                    data-testid="count-disc"
                    title={ String(count) }>{ formatCompactCount(count) }</span> }
            </Link>;
        }) }
    </nav>;
}
