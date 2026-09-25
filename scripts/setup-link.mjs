#!/usr/bin/env node
// Prepare a first-run browser handoff; never accept credentials in command arguments.
if (process.argv.includes('--help')) { console.log('Prepare an editable HappyToHelp setup link.\nUsage: node scripts/setup-link.mjs --url <installation> [--ownerName <name>] [--email <email>] [--name <workspace>] [--allowedOrigin <website>] [--primaryColor <#RRGGBB>]\nChecks setup availability. Never pass credentials.'); process.exit(0); }
const supported = new Set(['url', 'ownerName', 'email', 'name', 'allowedOrigin', 'primaryColor']);
const values = {};
for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '');
    if (!supported.has(key) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new Error('Use --url with optional --ownerName, --email, --name, --allowedOrigin, --primaryColor. Never pass credentials.');
    values[key] = process.argv[i + 1];
}
if (values.primaryColor && !/^#[0-9a-f]{6}$/i.test(values.primaryColor)) throw new Error('Brand colour must be #RRGGBB.');
if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new Error('Enter a valid owner email.');
for (const key of ['name', 'ownerName']) if (values[key] && (!values[key].trim() || values[key].length > 200)) throw new Error('Names must contain 1–200 characters.');
if (!values.url) throw new Error('--url is required; choose the intended installation explicitly.');
if (values.allowedOrigin) {
    const website = new URL(values.allowedOrigin);
    if (!['http:', 'https:'].includes(website.protocol) || website.username || website.password || website.search || website.hash) throw new Error('Widget website must be HTTP(S) without credentials, query or fragment.');
    values.allowedOrigin = website.origin;
}
const target = new URL(values.url);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) throw new Error('Supply an HTTP(S) installation URL without credentials, query or fragment.');
const response = await fetch(new URL('/api/identity/setup', target));
if (!response.ok) throw new Error(`Setup availability could not be checked (${response.status}).`);
const state = await response.json();
if (!state.available) throw new Error('This installation already has an owner. Sign in instead.');
const fragment = new URLSearchParams();
for (const [key, value] of Object.entries(values)) if (key !== 'url') fragment.set(key, value);
target.pathname = '/setup'; target.hash = fragment.toString();
console.log(JSON.stringify({ available: true, tokenRequired: Boolean(state.tokenRequired), setupUrl: target.href, note: 'Review these editable details in the browser. Enter passwords and any installation token there; they are not saved in the draft.' }, null, 2));
