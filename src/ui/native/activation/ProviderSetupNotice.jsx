import React from 'react';
import {Link} from '@tanstack/react-router';
import './provider-setup-notice.css';

const names=['OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY','GEMINI_API_KEY','DEEPSEEK_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY'];
const WHERE='In Cloudflare, open your Worker → Settings → Variables and Secrets. For a local installation, add it to your private .dev.vars file and restart the app.';
/** A plain note, ruled on its left, naming only the one secret that is needed: the model's secret when the server or the
 *  provider's error names it, `EMAIL_API_KEY` for the email provider, and no secret at all when none is known. */
export default function ProviderSetupNotice({projectId,secretName,kind='model',error}) {
 const email=kind==='email';
 const matched=email?'EMAIL_API_KEY':names.find(name=>name===secretName||String(error?.message||error||'').includes(name));
 return <aside className="provider-setup-notice" aria-label={email?'Email provider setup':'AI provider setup'}>
  <strong>{matched?`Add ${matched}`:email?'Connect your email provider':'Connect your AI provider'}</strong>
  <p>{matched?`Add it as an installation secret${email?' and verify the sender domain with your email provider':''}. `:'Choose an enabled default visitor assistant, then add the installation secret for its model. '}{WHERE} {projectId&&<Link to={`/projects/${projectId}/${email?'email-settings':'ais'}`}>{email?'Email settings':'AI settings'}</Link>}</p>
 </aside>;
}
