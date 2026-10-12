import React from 'react';
import {Link} from '@tanstack/react-router';
import {useDashboardSettings} from '../../native/dashboard-state';
import DemoInboxInvitation from './DemoInboxInvitation';

export default function InboxNextSteps(){
 const {project}=useDashboardSettings();
 return <section className="inbox-next-steps" aria-label="Start a conversation">
  <h3>Start your first conversation</h3>
  <p><Link to={`/projects/${project.id}/widget-settings`}>Install the widget</Link> on your website.</p>
  <p><a href={project.allowed_origin} target="_blank" rel="noopener noreferrer">Send yourself a test message</a> by opening the chat widget on your website. It will appear in this inbox.</p>
  <DemoInboxInvitation/>
 </section>;
}
