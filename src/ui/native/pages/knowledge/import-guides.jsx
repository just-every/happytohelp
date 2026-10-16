import React from 'react';

const link = (href, text) => <a href={href} target="_blank" rel="noreferrer">{text}</a>;

/** What each help-center import needs, in the provider's own words for where to find it. */
export const importGuides = {
 zendesk: {
  intro: 'Copies your Zendesk Guide categories, sections and articles. Published articles stay published and drafts stay drafts.',
  subdomain: 'The first part of your Zendesk address: acme for acme.zendesk.com.',
  secrets: [
   {name: 'ZENDESK_EMAIL', example: 'you@example.com', what: 'the email address of the Zendesk admin who creates the token below.', how: null},
   {name: 'ZENDESK_TOKEN', example: 'your-zendesk-api-token', what: 'a Zendesk API token.', how: <>In Zendesk Admin Center, open <b>Apps and integrations</b>, <b>APIs</b>, <b>API tokens</b>, then <b>Add API token</b> and copy it: it is shown only once. Zendesk deletes tokens unused for 30 days, so make one just before you import ({link('https://support.zendesk.com/hc/en-us/articles/4408889192858', 'Zendesk’s guide')}).</>},
  ],
 },
 intercom: {
  intro: 'Copies your Intercom Help Center collections, sections and articles. Published articles stay published and drafts stay drafts.',
  subdomain: null,
  secrets: [
   {name: 'INTERCOM_TOKEN', example: 'your-intercom-access-token', what: 'an Intercom access token that can read articles.', how: <>In Intercom, open {link('https://app.intercom.com/a/apps/_/developer-hub', 'Developer Hub')}, create an app (or open yours), then <b>Authentication</b>, and copy the <b>Access token</b>.</>},
  ],
 },
 freshdesk: {
  intro: 'Copies your Freshdesk Solutions categories, folders and articles. Published articles stay published and drafts stay drafts.',
  subdomain: 'The first part of your Freshdesk address: acme for acme.freshdesk.com.',
  secrets: [
   {name: 'FRESHDESK_TOKEN', example: 'your-freshdesk-api-key', what: 'your Freshdesk API key.', how: <>In Freshdesk, choose your profile picture, then <b>Profile settings</b>, and choose <b>View API key</b> ({link('https://support.freshdesk.com/support/solutions/articles/215517', 'Freshdesk’s guide')}).</>},
  ],
 },
};
