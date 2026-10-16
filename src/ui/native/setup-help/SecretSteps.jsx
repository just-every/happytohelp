import React from 'react';
import CopyCommand from './CopyCommand';
import {secret} from '../pages/terminal-prompts';
import './setup-help.css';

/** Secrets `rer deploy --set-secret` can change; any other value is added to the Worker directly. */
const deploySecrets=new Set(['EMAIL_PROVIDER','EMAIL_FROM','EMAIL_API_KEY','INBOUND_EMAIL_TOKEN','INTEGRATION_ENCRYPTION_KEY']);

/** Wrangler's own version, run through npx: someone who installed only rer with npm has npx, not the checkout's pnpm. */
const WRANGLER='wrangler@4.129.1';

/** Exactly where an installation value goes and how the app picks it up, for this installation only.
 * `values` are `{name, example}`; the example is a placeholder, never a real value. */
export default function SecretSteps({values,installation}) {
 const lines=values.map(({name,example})=>`${name}=${example}`).join('\n');
 if(installation?.environment==='local')return <div className="sh-steps" data-steps="local">
  <ol>
   <li>Open the folder where you run <code>rer dev</code>: your HappyToHelp checkout.</li>
   <li>Open the file named <code>.dev.vars</code> in that folder (setup created it; it stays private and is never committed) and add {values.length>1?'these lines':'this line'}, with your own {values.length>1?'values':'value'} after the <code>=</code>:<CopyCommand text={lines}/></li>
   <li>Restart the app so it reads the file:<CopyCommand text="rer dev --stop && rer dev"/></li>
  </ol>
 </div>;
 const worker=installation?.worker;
 const viaDeploy=values.every(({name})=>deploySecrets.has(name));
 return <div className="sh-steps" data-steps="hosted">
  <p><b>In the Cloudflare dashboard:</b></p>
  <ol>
   <li>Open <b>Workers &amp; Pages</b> and choose {worker?<>the Worker <code>{worker}</code></>:<>the Worker that serves <code>{installation?.origin?new URL(installation.origin).host:'this app'}</code></>}.</li>
   <li>Go to <b>Settings</b>, <b>Variables and Secrets</b>, then <b>Add</b>.</li>
   <li>{values.length>1?'For each name below, choose':'Choose'} type <b>Secret</b>, enter the name {values.map(({name},index)=><React.Fragment key={name}>{index?', ':''}<code>{name}</code></React.Fragment>)} and paste your value, then <b>Deploy</b>.</li>
  </ol>
  <p><b>Or from your checkout</b> (the folder you deployed from), {viaDeploy?<>put the values in a private file and run <code>rer deploy</code> with the environment name you deployed with:</>:<>paste this into Terminal. It asks first for the Cloudflare API token you deployed with, then for each value; none of them is shown or lands in your shell history:</>}</p>
  {viaDeploy
   ?<CopyCommand text={`umask 077 && cat > private.env <<'EOF'\n${lines}\nEOF\n${values.map(({name})=>`rer deploy --environment YOUR-ENVIRONMENT --env-file private.env --set-secret ${name}`).join('\n')}`}/>
   :<CopyCommand text={`(\n${secret('CLOUDFLARE_API_TOKEN','Cloudflare API token')}\nexport CLOUDFLARE_API_TOKEN\n${values.map(({name})=>`npx --yes ${WRANGLER} secret put ${name} --name ${worker||'YOUR-WORKER-NAME'}`).join('\n')}\n)`}/>}
  <p className="sh-note">Cloudflare uses the new value as soon as the change is deployed; then reload this page.</p>
 </div>;
}
