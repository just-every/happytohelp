import React from 'react';
import CopyCommand from '../setup-help/CopyCommand';
import SecretSteps from '../setup-help/SecretSteps';

/** Before Connect GitHub can work: the OAuth app to create, its exact addresses, and where its values go. */
export default function GitHubOAuthSteps({oauth,installation}) {
 const values=[{name:'GITHUB_CLIENT_ID',example:'your-client-id'},{name:'GITHUB_CLIENT_SECRET',example:'your-client-secret'},
  ...(oauth.missing.includes('INTEGRATION_ENCRYPTION_KEY')?[{name:'INTEGRATION_ENCRYPTION_KEY',example:'output-of-openssl-rand-base64-32'}]:[])];
 return <div className="sh-steps" data-guide="github-oauth">
  <p>Connect needs a GitHub OAuth app of your own first. It takes about two minutes:</p>
  <ol>
   <li>On GitHub, open your profile picture, <b>Settings</b>, <b>Developer settings</b>, <b>OAuth Apps</b>, <b>New OAuth App</b> (for an organization, start from the organization’s <b>Settings</b>). GitHub’s guide: <a href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app" target="_blank" rel="noreferrer">Creating an OAuth app</a>.</li>
   <li>Name it <b>HappyToHelp</b>. For <b>Homepage URL</b> use:<CopyCommand text={installation.origin}/>For <b>Authorization callback URL</b> use exactly:<CopyCommand text={oauth.callbackUrl}/></li>
   <li>Choose <b>Register application</b>, copy the <b>Client ID</b>, then choose <b>Generate a new client secret</b> and copy it.</li>
   {oauth.missing.includes('INTEGRATION_ENCRYPTION_KEY')&&<li>Make an encryption key for the stored connection, and keep it: changing it later disconnects GitHub.<CopyCommand text="openssl rand -base64 32"/></li>}
   <li>Add {values.length>2?'these values':'both values'} to this installation:</li>
  </ol>
  <SecretSteps installation={installation} values={values}/>
  <p className="sh-note">Then reload this page and choose Connect GitHub. Prefer a token instead of OAuth? See <a href="/docs/integrations#give-happytohelp-access">Give HappyToHelp access</a>.</p>
 </div>;
}
