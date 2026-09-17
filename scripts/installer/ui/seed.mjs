const email = value => typeof value === 'string' && value.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value || '');
const account = value => /^[a-f0-9]{32}$/i.test(value || '');
const name = value => typeof value === 'string' && Boolean(value.trim()) && value.length <= 200;
function origin(value, deployed = false) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && (!deployed || (url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.port)); } catch { return false; }
}
export const fields = {
  name: { label: 'Workspace name', help: 'The name your team sees in HappyToHelp.', valid: name },
  ownerName: { label: 'Your name', autocomplete: 'name', valid: name },
  email: { label: 'Your email', type: 'email', autocomplete: 'email', inputMode: 'email', valid: email },
  password: { label: 'Create an owner password', type: 'password', autocomplete: 'new-password', help: 'At least 12 characters. Used to create your owner account.', valid: value => typeof value === 'string' && value.length >= 12 && value.length <= 1024 },
  allowedOrigin: { label: 'Website where customers will use chat', type: 'url', autocomplete: 'url', inputMode: 'url', placeholder: 'https://example.com', help: 'The chat widget will be allowed on this website.', valid: value => origin(value) },
  primaryColor: { label: 'Brand colour', type: 'color', help: 'Choose your brand colour using the colour picker.', valid: value => /^#[a-f0-9]{6}$/i.test(value || '') },
  target: { label: 'Install to', options: [['local', 'Run locally'], ['remote', 'Publish online with Cloudflare']], valid: value => ['local', 'remote'].includes(value) },
  accountId: { label: 'Cloudflare account', valid: account },
  apiToken: { label: 'Cloudflare API token', type: 'password', help: 'Use a token instead of connecting your account.', valid: value => typeof value === 'string' && Boolean(value.trim()) && value.length <= 2048 },
  prefixMode: { valid: value => ['automatic', 'custom'].includes(value) },
  addressMode: { valid: value => ['automatic', 'custom'].includes(value) },
  prefix: { label: 'Resource name', help: '3–40 lowercase letters, numbers or hyphens; start with a letter.', valid: value => /^[a-z][a-z0-9-]{2,39}$/.test(value || '') },
  appOrigin: { label: 'Team workspace address', type: 'url', autocomplete: 'url', inputMode: 'url', help: 'The HTTPS address your team will open to use HappyToHelp.', valid: value => origin(value, true) },
  emailProvider: { label: 'Email service', options: [['cloudflare', 'Cloudflare Email Sending'], ['resend', 'Resend'], ['later', 'Set up email later']], valid: value => ['cloudflare', 'resend', 'later'].includes(value) },
  emailFrom: { label: 'Sender email address', type: 'email', autocomplete: 'email', inputMode: 'email', help: 'Use an address on your verified sending domain.', valid: email },
  emailAccountId: { label: 'Email Sending account', valid: account },
  emailApiKey: { label: 'Email sending token', type: 'password', help: 'Cloudflare requires Email Sending: Edit permission; Resend requires a sending API key.', valid: value => typeof value === 'string' && Boolean(value.trim()) },
};
export const safeKeys = ['target', 'ownerName', 'email', 'name', 'allowedOrigin', 'primaryColor', 'accountId', 'prefix', 'appOrigin', 'emailProvider', 'emailFrom', 'emailAccountId', 'prefixMode', 'addressMode'];

export const product = { name: 'HappyToHelp', slugPrefix: 'h2h' };
export const branding = { name: 'HappyToHelp' };
export const features = { hosting: true, email: true, artwork: true, github: true };
export const setupGroups = [
 { id: 'workspace', title: 'Workspace', keys: ['name', 'allowedOrigin', 'primaryColor'] },
 { id: 'owner', title: 'Your account', keys: ['ownerName', 'email', 'password'] },
 { id: 'hosting', title: 'Hosting & connections', keys: ['target', 'accountId', 'prefix', 'appOrigin', 'apiToken', 'emailProvider', 'emailFrom', 'emailAccountId', 'emailApiKey'], kind: 'hosting' },
];
export function requiredKeys() { return ['name', 'ownerName', 'email', 'password', 'allowedOrigin', 'primaryColor', 'target']; }
export function readySummary(draft) { return `${draft.name} is ready to be installed ${draft.target === 'remote' ? 'on Cloudflare' : 'on this computer'}. Your owner account will use ${draft.email}.`; }
