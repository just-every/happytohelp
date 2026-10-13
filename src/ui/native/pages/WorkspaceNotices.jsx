import React from 'react';
import { Link } from '@tanstack/react-router';
import { QuestionBubble } from '../drawings';
import { useDashboardSettings } from '../dashboard-state';

/** In-shell states for pages the signed-in user cannot open, centred under the question drawing. Each names the way out.
 *  WorkspacePages.jsx passes the header: the workspace's name and the page's title. */
function Notice({ header, children, action }) {
    return <section className="workspace-notice"><QuestionBubble/>{header}<p role="alert">{children}</p>{action}</section>;
}

/** The URL names a project the account does not belong to, or one that does not exist. On a phone the navigation's two
 *  ways back (the Global Inbox and a project's contacts) also sit as pills under the top bar. "Go to Projects" matches only
 *  /projects itself: the router would otherwise mark it current (the hover ink) under every /projects/… address. */
export function ProjectUnavailable({ header }) {
    const first = Object.values(useDashboardSettings().projects || {})[0];
    return <>
        <nav className="workspace-notice__shortcuts" aria-label="Shortcuts"><Link className="btn btn-sm btn-primary" to="/conversations">Inbox</Link>{first && <Link className="btn btn-sm btn-white" to={`/projects/${first.id}/contacts`}>Contacts</Link>}</nav>
        <Notice header={header} action={<Link className="btn btn-primary btn-lg" to="/projects" activeOptions={{ exact: true }}>Go to Projects</Link>}>
            This project was not found, or your account does not have access to it. Choose one of your projects to continue.
        </Notice>
    </>;
}

/** Platform administration is limited to platform administrators; project ownership does not grant it. */
export function AdminRequired({ header }) {
    return <Notice header={header} action={<Link className="btn btn-primary btn-lg" to="/conversations">Back to the inbox</Link>}>
        Administration is limited to platform administrators. Your account does not have this access.
    </Notice>;
}

/** A well-formed dashboard URL whose record does not exist for this account. */
export function PageNotFound({ header, action }) {
    return <Notice header={header} action={action ?? <Link className="btn btn-primary btn-lg" to="/conversations">Back to the inbox</Link>}>This page was not found.</Notice>;
}
