import React, { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Section } from './forms';

export const PROACTIVE_HELP_ANCHOR = 'help-before-they-ask';

/** "Help before they ask": what it does, when it fires, what it needs, and its two switches. */
export default function ProactiveHelp({ field, projectId }) {
    useEffect(() => {
        if (window.location.hash === `#${PROACTIVE_HELP_ANCHOR}`) document.getElementById(PROACTIVE_HELP_ANCHOR)?.scrollIntoView({ block: 'start' });
    }, []);
    return <div id={PROACTIVE_HELP_ANCHOR} className="proactive-help-settings"><Section card title="Help before they ask" description="When a visitor seems stuck on your website, for example going back and forth between the same steps or meeting the same error, the chat widget offers a hand: a small card beside the chat button with a suggestion they can open as a chat or dismiss.">
        <ol className="settings-steps">
            <li>The widget first asks each visitor whether to share their page activity (<b>Allow proactive help</b>). Nothing is collected from a visitor who says no, and they can stop at any time.</li>
            <li>After a visitor’s first 6 page views, clicks or form steps, and then every 6 to 20 more, your AI assistant reads that recent activity and offers help only when it shows a concrete sign of being stuck. Most visits get no card. A visitor who dismisses one is not offered another for a day, then a week, a month and six months.</li>
            <li>It needs an AI key, because each of those checks is one request to your AI service: add one in <Link to={`/projects/${projectId}/activation`}>Setup, Connect an AI service</Link>. Until then nothing is offered, even with both switches on.</li>
        </ol>
        {field('is_contact_tracking_enabled', 'Track contact page views with widget', 'checkbox')}
        {field('proactive_help_enabled', 'Offer proactive help after visitor consent', 'checkbox')}
        <p className="settings-note">Turn both on, then choose Update. More: <a href="/docs/help-before-they-ask">Help before they ask guide</a>.</p>
    </Section></div>;
}
