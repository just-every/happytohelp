import React from 'react';
import {Link} from '@tanstack/react-router';
import CopyCommand from '../../setup-help/CopyCommand';
import '../../setup-help/setup-help.css';

const apiGuide='https://github.com/just-every/run-happytohelp/blob/main/docs/api.md';
const terminal=<>It asks for the token without showing or saving it.</>;

const apiExample=origin=>`read -rsp 'HappyToHelp API token: ' H2H_TOKEN; echo
curl --silent --show-error --config - "${origin}/api/v1/conversations?status=open&limit=5" <<EOF_CURL
header = "Authorization: Bearer $H2H_TOKEN"
EOF_CURL`;

/** How to call the workspace API with a token from this page. */
export function ApiHelp({origin}){
 return <div className="sh-steps mb-4"><p><b>Use the API</b></p><ol>
  <li>Create a token below with only the scopes your script needs: <code>:read</code> scopes look things up, <code>:write</code> scopes change them, and <code>messages:write</code> sends replies to customers. Copy the token when it appears; it is shown once.</li>
  <li>Send requests to this address, with the token in an <code>Authorization: Bearer</code> header:<CopyCommand text={`${origin}/api/v1`}/></li>
  <li>Try it in Terminal. This lists your five newest open conversations. {terminal}<CopyCommand text={apiExample(origin)}/></li>
 </ol><p className="sh-note">Every endpoint, with an example for each: <a href={apiGuide} target="_blank" rel="noreferrer">Workspace API guide</a>. Each token can make 120 requests a minute.</p></div>;
}

const verifier=`import {createHmac, timingSafeEqual} from 'node:crypto';
// secret: the signing secret shown once when you saved the connection.
// headers: the request's headers; body: the request body exactly as received, as text.
export function fromHappyToHelp(secret, headers, body) {
  const signed = JSON.stringify(['integrations.webhook.v1', headers['webhook-tenant'], headers['webhook-destination'],
    headers['webhook-event'], headers['webhook-id'], headers['webhook-timestamp'], body]);
  const expected = Buffer.from('v1=' + createHmac('sha256', Buffer.from(secret, 'hex')).update(signed).digest('hex'));
  const given = Buffer.from(String(headers['webhook-signature'] || ''));
  const fresh = Math.abs(Date.now() / 1000 - Number(headers['webhook-timestamp'])) < 300;
  return fresh && given.length === expected.length && timingSafeEqual(given, expected);
}`;

/** Where a webhook goes and how its receiver checks it. */
export function WebhookHelp({projectId}){
 return <div className="sh-steps mb-4"><p><b>Set up a webhook</b></p><ol>
  <li>You need a server on the public internet that accepts <code>POST</code> requests over HTTPS. Paste its address below, for example <code>https://example.com/happytohelp</code>. Addresses on your own computer, such as <code>localhost</code>, can’t be reached.</li>
  <li>Choose the events to send and save. Copy the signing secret that appears; it is shown once.</li>
  <li>On your server, check each request before acting on it. Each one is JSON, with <code>webhook-id</code>, <code>webhook-timestamp</code> (Unix seconds) and <code>webhook-signature</code> headers. This Node.js function returns true only for a recent request signed with your secret:<CopyCommand text={verifier}/></li>
  <li>Answer with any 2xx status. A delivery can be resent, so skip a <code>webhook-id</code> you have already handled.</li>
  <li>Choose <b>Send test</b> on the saved connection, then open the <Link to={`/projects/${projectId}/delivery-log`}>Delivery log</Link> to see your server’s answer.</li>
 </ol><p className="sh-note">Events carry IDs and values, never message text or email addresses. Event contents and limits: <a href={apiGuide} target="_blank" rel="noreferrer">Workspace API guide</a>.</p></div>;
}

/** Where to get the Slack value each connection type asks for. */
export function SlackHelp({mode}){
 return <div className="sh-steps mb-4"><p><b>Get the value from Slack</b></p>{mode==='bot'?<ol>
  <li>Open <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer">api.slack.com/apps</a>, choose <b>Create New App</b>, <b>From scratch</b>, and pick your Slack workspace.</li>
  <li>Open <b>OAuth &amp; Permissions</b>. Under <b>Bot Token Scopes</b>, add <code>chat:write</code>. Choose <b>Install to Workspace</b>, then copy the <b>Bot User OAuth Token</b> (it starts with <code>xoxb-</code>) into <b>Bot token</b> below.</li>
  <li>In Slack, open the channel, type <code>/invite</code> and add the app. Then open the channel’s name at the top; the <b>Channel ID</b> (it starts with <code>C</code>) is at the bottom of the About tab. Paste it into <b>Channel ID</b> below.</li>
 </ol>:<ol>
  <li>Open <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer">api.slack.com/apps</a>, choose <b>Create New App</b>, <b>From scratch</b>, and pick your Slack workspace.</li>
  <li>Open <b>Incoming Webhooks</b>, switch it on, choose <b>Add New Webhook</b> and pick the channel.</li>
  <li>Copy the <b>Webhook URL</b> (it starts with <code>https://hooks.slack.com/services/</code>) into <b>Slack incoming webhook URL</b> below.</li>
 </ol>}<p className="sh-note">Save, then choose <b>Send test</b> on the saved connection. A test message should appear in the channel.</p></div>;
}
