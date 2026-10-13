import React from 'react';
import { Link } from '@tanstack/react-router';
import { useDashboardSettings } from '../../native/dashboard-state';
import { PenLine } from '../../native/drawings';
import DemoInboxInvitation from './DemoInboxInvitation';

/** The empty inbox of a workspace's owner: a greeting, the one next action, a way to Setup and the demo inbox. */
export default function InboxStart({ name, penLine = false }) {
    const { project } = useDashboardSettings();

    return <section className="inbox-start" data-testid="inbox-start" aria-label="Start a conversation">
        <h2 className="inbox-greeting" data-testid="inbox-greeting">{ `Hey, ${ name }!` }</h2>
        { penLine && <PenLine/> }
        <p className="inbox-start__lede">Your inbox is ready. Add the widget to your website and the first conversation will appear here.</p>
        <Link className="btn btn-primary inbox-start__action" data-testid="inbox-primary-action" to={ `/projects/${ project.id }/widget-settings` }>Install the widget</Link>
        <Link className="inbox-start__quiet" data-testid="inbox-setup-link" to={ `/projects/${ project.id }/activation` }>See everything in Setup</Link>
        <DemoInboxInvitation/>
    </section>;
}
