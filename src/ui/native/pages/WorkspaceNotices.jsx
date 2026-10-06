import React from 'react';
import { Link } from '@tanstack/react-router';

/** In-shell states for pages the signed-in user cannot open. Each names the way out. */
function Notice({ children, action }) {
    return <div className="workspace-settings workspace-notice"><p className="mb-4" role="alert">{children}</p>{action}</div>;
}

/** The URL names a project the account does not belong to, or one that does not exist. */
export function ProjectUnavailable() {
    return <Notice action={<Link className="btn btn-primary" to="/projects">Go to Projects</Link>}>
        This project was not found, or your account does not have access to it. Choose one of your projects to continue.
    </Notice>;
}

/** Platform administration is limited to platform administrators; project ownership does not grant it. */
export function AdminRequired() {
    return <Notice action={<Link className="btn btn-primary" to="/conversations">Back to the inbox</Link>}>
        Administration is limited to platform administrators. Your account does not have this access.
    </Notice>;
}

/** A well-formed dashboard URL whose record does not exist for this account. */
export function PageNotFound({ action }) {
    return <Notice action={action ?? <Link className="btn btn-primary" to="/conversations">Back to the inbox</Link>}>This page was not found.</Notice>;
}
