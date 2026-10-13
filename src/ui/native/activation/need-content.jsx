import React from 'react';
import {buildAnonymousEmbedCode} from '../../dashboard/components/widget-settings/code/anonymousEmbedCode';
import {hostOf, modelKeyState} from './setup-model';

// The words and actions of each thing that needs the owner. Local and hosted copy is chosen here, never hidden by CSS.
const secretNames = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY'];
const where = local => local
 ? <>Add it to your private <code>.dev.vars</code> file and restart the app.</>
 : <>In Cloudflare, open your Worker, then Settings, Variables and Secrets, Add secret.</>;

function aiNeed({data, local}) {
 const name = data.facts?.ai?.secretName;
 // Workspaces made before the starter assistant existed have none: say only what is true of the assistant they do have.
 const starter = Boolean(data.facts?.starterAssistant), hasDefault = Boolean(data.facts?.ai?.assistantId);
 const whose = starter ? 'your starter assistant' : hasDefault ? 'your default assistant' : 'an assistant';
 // A provider that checks keys refused this one the read it needs (for example HTTP 403): the key is there, so ask
 // for the access, not for a key.
 if (modelKeyState(data) === 'blocked') return {
  title: 'Let us check your AI key',
  copy: <><code>{name}</code> is installed, but the provider refused our read-only check, so we can’t confirm {whose} can answer with it.</>,
  actions: [{kind: 'how'}],
  how: <p>In your AI provider’s dashboard, give this key permission to read models. Or make a key that has it and replace <code>{name}</code>: {where(local)} We’ll check again on our own.</p>,
 };
 return {
  title: 'Connect an AI service',
  copy: starter
   ? <>Your starter assistant will answer visitors from what you publish and from your website, within your daily limits. It needs a key from OpenAI, Anthropic, Google or a similar service.</>
   : <>Once a key is in, {hasDefault ? 'your default assistant' : 'an assistant'} can answer visitors from what you publish and from your website, within your daily limits. It needs a key from OpenAI, Anthropic, Google or a similar service.</>,
  actions: [{kind: 'how'}],
  how: <p>{name ? <>Add the key as <code>{name}</code>.</> : <>Add the key for your service as a secret, such as <code>{secretNames[0]}</code>, <code>{secretNames[1]}</code> or <code>{secretNames[2]}</code>.</>} {where(local)} We’ll notice as soon as it’s there.</p>,
 };
}

function widgetNeed({data}) {
 const host = data.facts?.website ? hostOf(data.facts.website) : '';
 const {key, scriptUrl, apiOrigin} = data.facts?.widget || {};
 const snippet = key ? buildAnonymousEmbedCode({widgetKey: key, scriptUrl, apiOrigin}) : '';
 return {
  title: 'Add the widget to your website',
  copy: <>Paste this before the closing body tag{host ? <> on <b>{host}</b></> : null}. We can’t edit your site, so this one is yours.</>,
  snippet,
  actions: snippet ? [{kind: 'copy', text: snippet}, {kind: 'mailto', text: snippet, host}] : [],
 };
}

function senderNeed({data, item, local}) {
 const records = data.facts?.senderRecords || [];
 return {
  title: 'Connect your email service',
  copy: <>So replies and invitations leave from your own address. Add a key from Resend, then the DNS records we list. We’ll watch for them.</>,
  actions: [{kind: 'how'}],
  how: <>
   {item.state === 'unavailable' && <p>Add <code>EMAIL_API_KEY</code>, <code>EMAIL_PROVIDER</code> and <code>EMAIL_FROM</code> as secrets. {where(local)}</p>}
   {item.state !== 'unavailable' && !records.length && <p>Add your sending domain in your email service. Its DNS records will be listed here as soon as it exists.</p>}
   {records.length > 0 && <><p>Add these DNS records at your domain registrar. We’ll watch for them.</p>
    <ul className="sl-records">{records.map((record, index) => <li key={`${record.type}-${record.name}-${index}`}><code>{record.type}</code> <code>{record.name}</code> <code>{record.value}</code> <span>{record.status}</span></li>)}</ul></>}
  </>,
 };
}

const builders = {model_key: aiNeed, widget_seen: widgetNeed, sender_dns: senderNeed};
export const needContent = args => builders[args.item.id]?.(args);
