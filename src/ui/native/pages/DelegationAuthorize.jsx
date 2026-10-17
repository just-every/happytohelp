import React, { useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { useDashboardSettings } from '../dashboard-state';
import { Section } from './forms';
import DelegationExits from './DelegationExits';
import { confirmRecentStepUp, dateTime, scopeLabels } from './delegation-shared';

const problems = {
    INVALID_REQUEST: 'This connection request is incomplete or does not match a registered application. Return to the application and start the connection again.',
    SCOPE_DENIED: 'You cannot connect applications to this workspace. Only owners, admins and operators of the workspace can approve access.',
    UNAVAILABLE: 'Connecting applications is not set up on this installation yet. Ask the person who runs your installation to enable it.',
};

function Nothing({ projectId }) {
    return <div className="workspace-settings delegation-page"><Section title="Nothing to approve" description="This page opens when an application you registered asks for access, so it needs the details of that request.">
        <p>Start the connection from the application itself. To review or revoke access you have already granted, open Connected applications.</p>
        <DelegationExits projectId={projectId}/>
    </Section></div>;
}

/** Approve or cancel an application's request. The decision is a form post: approval ends in a redirect back to the application. */
export default function DelegationAuthorize({ projectId }) {
    const { delegationConsent } = useDashboardSettings();
    const confirmed = useRef(false);
    const decide = async event => {
        const button = event.nativeEvent.submitter;
        if (confirmed.current || button?.value !== 'approve') return;
        event.preventDefault();
        const form = event.currentTarget;
        if (!await confirmRecentStepUp()) return;
        confirmed.current = true;
        form.requestSubmit(button);
    };
    if (!delegationConsent) return <Nothing projectId={projectId}/>;
    if (delegationConsent.problem) return <div className="workspace-settings delegation-page"><div role="alert" className="alert alert-danger">{problems[delegationConsent.problem.code] || delegationConsent.problem.message}</div>
        <DelegationExits projectId={projectId}/></div>;
    const { request, principal, project, issued, csrf } = delegationConsent.request;
    return <div className="workspace-settings delegation-page delegation-consent">
        <Section title={request.origin} description={`Requests access as ${principal.name || principal.email || principal.id} in ${project.name}.`}>
            <p>Access lasts 30 days. You can revoke it at any time in <Link to="/delegation/settings" search={{ account_id: project.id }}>Connected applications</Link>.</p>
        </Section>
        <Section title="Selected records">
            <ul className="delegation-grant__list">{request.targets.map(target => <li key={target}><code>{target}</code></li>)}</ul>
        </Section>
        <Section title="Permissions">
            <ul className="delegation-grant__list">{request.scope.map(scope => <li key={scope}>{scopeLabels[scope] || scope}<code>{scope}</code></li>)}</ul>
            <p className="delegation-page__empty">No support replies, customer account changes or SSO activation are permitted.</p>
        </Section>
        <form method="post" action="/delegation/authorize" className="delegation-consent__actions" onSubmit={decide}>
            <input type="hidden" name="request" value={JSON.stringify(request)}/>
            <input type="hidden" name="issued" value={issued}/>
            <input type="hidden" name="csrf" value={csrf}/>
            <button type="submit" name="decision" value="approve" className="btn btn-primary">Allow selected access</button>
            <button type="submit" name="decision" value="deny" className="btn btn-white ms-2">Cancel</button>
        </form>
        <p className="delegation-page__empty">Valid until {dateTime(issued + 600000)}; after that, start the connection again.</p>
    </div>;
}
