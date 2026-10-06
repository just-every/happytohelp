import React from 'react';
import { Link } from '@tanstack/react-router';

/** Ways out of a delegation page that cannot continue: review connected applications or return to the inbox. */
export default function DelegationExits({ projectId, settings = true }) {
    return <div className="delegation-exits">
        {settings && <Link className="btn btn-primary" to="/delegation/settings" search={projectId ? { account_id: projectId } : {}}>Connected applications</Link>}
        <Link className="btn btn-white" to={projectId ? `/projects/${projectId}/conversations` : '/conversations'}>Back to the inbox</Link>
    </div>;
}
