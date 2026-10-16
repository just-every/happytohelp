import React from 'react';
import {Link} from '@tanstack/react-router';
import './provider-setup-notice.css';

const names=['OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY','GEMINI_API_KEY','DEEPSEEK_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY'];
const WHERE='In Cloudflare, open your Worker → Settings → Variables and Secrets. For a local installation, add it to the private .dev.vars file in your HappyToHelp folder, then run rer dev --stop and rer dev.';
/** A plain note, ruled on its left, naming only the one AI secret that is needed: the model's secret when the server or
 *  the provider's error names it, and no secret at all when none is known. */
export default function ProviderSetupNotice({projectId,secretName,error}) {
 const matched=names.find(name=>name===secretName||String(error?.message||error||'').includes(name));
 return <aside className="provider-setup-notice" aria-label="AI provider setup">
  <strong>{matched?`Add ${matched}`:'Connect your AI provider'}</strong>
  <p>{matched?'Add it as an installation secret. ':'Choose an enabled default visitor assistant, then add the installation secret for its model. '}{WHERE} {projectId&&<Link to={`/projects/${projectId}/ais`}>AI settings</Link>}</p>
 </aside>;
}
