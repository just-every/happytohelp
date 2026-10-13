import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';

/** "More" in the project sidebar: the pages used less often (Local computers, Reports, Insights) behind one row. It is
 *  closed unless one of its pages is current. `links` are { label, to, current }. */
export default function NavigationMore({ links }) {
    const currentPage = links.some(link => link.current);
    const [open, setOpen] = useState(currentPage);
    useEffect(() => { if (currentPage) setOpen(true); }, [currentPage]);
    return <li className="nav-item"><details className="nav-more" data-testid="nav-more" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
        <summary><i className="fe fe-more-horizontal" aria-hidden="true"/><span className="navbar-link-label">More</span><i className="fe fe-chevron-down nav-more-chevron" aria-hidden="true"/></summary>
        <ul>{links.map(link => <li key={link.to}><Link className={`nav-link ${link.current ? 'active' : ''}`} aria-current={link.current ? 'page' : undefined} to={link.to}>{link.label}</Link></li>)}</ul>
    </details></li>;
}
