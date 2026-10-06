import React from 'react';
import {Link} from '@tanstack/react-router';

const names=['OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY','GEMINI_API_KEY','DEEPSEEK_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY','EMAIL_API_KEY','EMAIL_FROM','INBOUND_EMAIL_TOKEN'];
export default function ProviderSetupNotice({projectId,provider,secretName,kind='model',error,compact=false}) {
 const matched=names.find(name=>name===secretName||String(error?.message||error||'').includes(name));
 const email=kind==='email';
 return <aside className="provider-setup-notice" aria-label={email?'Email provider setup':'AI provider setup'}>
  <strong>{matched?`Add ${matched}`:email?'Connect your email provider':'Connect your AI provider'}</strong>
  <p>{matched?<>The installation needs <code>{matched}</code>. </>:null}{provider?`${provider} credentials are stored in the installation. `:''}In Cloudflare, open your Worker → Settings → Variables and Secrets → Add secret. For a local installation, add it to your private <code>.dev.vars</code> file and restart the app.</p>
  {!compact&&<p>{email?<>Set <code>EMAIL_PROVIDER</code> and the <code>EMAIL_API_KEY</code> and <code>EMAIL_FROM</code> secrets. Verify the sender domain with that provider. Receiving mail also requires <code>INBOUND_EMAIL_TOKEN</code> and the provider’s inbound gateway.</>:<>Use the secret for your selected model: <code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, <code>GOOGLE_API_KEY</code> (or <code>GEMINI_API_KEY</code>), <code>DEEPSEEK_API_KEY</code>, <code>XAI_API_KEY</code> or <code>OPENROUTER_API_KEY</code>. Then choose an enabled default visitor assistant.</>}</p>}
  <p className="mb-0">Keep key values out of messages and browser storage. {projectId&&<Link to={`/projects/${projectId}/${email?'email-settings':'ais'}`}>{email?'Email settings':'AI settings'}</Link>}</p>
 </aside>;
}
