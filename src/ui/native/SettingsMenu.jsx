import './settings-menu.css';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { destinationActive, settingsDestinations, settingsMenuHeadCount } from './settings-destinations';

const phoneQuery = '(max-width: 767.98px)';
const subscribePhone = notify => { const query = window.matchMedia(phoneQuery); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify); };
const onPhone = () => window.matchMedia(phoneQuery).matches;

/** The Settings pages' own menu. A wide screen lists five destinations and folds the other seven into "More" (open while
 *  one of them is the page); a phone shows all twelve in one sideways-scrolling row. Links change the page in place. */
export default function SettingsMenu({ projectId }) {
    // The router's own location, as each link's active state uses, so exactly one entry is current at every moment.
    const pathname = useLocation({ select: location => location.pathname });
    const base = `/projects/${projectId}`;
    const phone = useSyncExternalStore(subscribePhone, onPhone, () => false);
    const menu = useRef(null);
    const head = settingsDestinations.slice(0, settingsMenuHeadCount), rest = settingsDestinations.slice(settingsMenuHeadCount);
    const restActive = rest.some(destination => destinationActive(pathname, base, destination));
    const [moreOpen, setMoreOpen] = useState(restActive);
    useEffect(() => { if (restActive) setMoreOpen(true); }, [restActive, pathname]);
    // On a phone the row scrolls sideways: keep the current destination in view.
    useEffect(() => { const row = menu.current?.querySelector('ul'), current = menu.current?.querySelector('[aria-current="page"]'); if (phone && row && current) row.scrollLeft = Math.max(0, current.offsetLeft - 16); }, [phone, pathname]);
    const entry = destination => {
        const current = destinationActive(pathname, base, destination);
        const props = { 'aria-current': current ? 'page' : undefined };
        return <li key={destination.label}>{destination.absolute
            ? <Link to={destination.absolute} search={{ account_id: projectId }} {...props}>{destination.label}</Link>
            : <Link to={`${base}/${destination.path}`} {...props}>{destination.label}</Link>}</li>;
    };
    return <nav ref={menu} className="settings-menu" data-testid="settings-menu" aria-label="Settings"><ul>
        {head.map(entry)}
        {phone
            ? rest.map(entry)
            : <li><details data-testid="settings-menu-more" open={moreOpen} onToggle={event => setMoreOpen(event.currentTarget.open)}><summary>More</summary><ul>{rest.map(entry)}</ul></details></li>}
    </ul></nav>;
}
