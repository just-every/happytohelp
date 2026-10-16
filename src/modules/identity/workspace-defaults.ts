import { DEFAULT_WORKSPACE_COLOUR } from '../management/workspace-colour'

// Pure derivation of what first-run setup does not ask for: the workspace name, the owner's name and the colour. The browser
// imports this file too, so it stays free of anything the Worker alone provides.

/** The name a workspace gets when neither its website nor the owner's email says anything about the company. */
export const FALLBACK_WORKSPACE_NAME = 'My workspace'
export { DEFAULT_WORKSPACE_COLOUR }

// Mailbox providers whose domain names a person's provider, not their company: exact domains, and the providers that run one
// domain per country.
const freeMail = new Set(['gmail.com', 'googlemail.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'mail.com', 'zoho.com', 'fastmail.com', 'fastmail.fm', 'hey.com', 'qq.com', '163.com', '126.com', 'sina.com', 'naver.com', 'daum.net', 'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'yandex.com', 'yandex.ru', 'web.de', 't-online.de', 'laposte.net', 'wanadoo.fr', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net', 'btinternet.com', 'hushmail.com', 'tutanota.com', 'tuta.com', 'rediffmail.com', 'seznam.cz', 'wp.pl', 'o2.pl', 'onet.pl', 'libero.it', 'virgilio.it', 'rocketmail.com', 'ymail.com']);
const freeMailByCountry = /^(yahoo|outlook|hotmail|live|gmx|orange|free)\.[a-z]{2,3}(\.[a-z]{2})?$/;
// Top-level names that never belong to a public website.
const reservedTld = new Set(['localhost', 'local', 'internal', 'test', 'invalid', 'example', 'lan', 'home', 'corp', 'intranet', 'localdomain', 'arpa']);
const secondLevel = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne', 'go']);

const domainOf = (email: string) => {
    const address = email.trim().toLowerCase();
    return address.slice(address.lastIndexOf('@') + 1);
};
/** The company domain of an email address, or null for a free-mail provider, a reserved name such as the local trial's
 * `owner@<checkout folder>.test`, or a malformed address. */
export function companyDomain(email: string): string | null {
    const domain = domainOf(email);
    return email.includes('@') && domain.includes('.') && !freeMail.has(domain) && !freeMailByCountry.test(domain) && !reservedTld.has(domain.split('.').pop()!) ? domain : null;
}
/** The host of a website the public internet can reach: a named host, not an address, `localhost` or an internal name. */
export function publicHost(website: string): string | null {
    let host: string;
    try {
        const url = new URL(website);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        host = url.hostname.toLowerCase().replace(/\.$/, '');
    } catch { return null; }
    if (!host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host) || reservedTld.has(host.split('.').pop()!)) return null;
    return host;
}
const words = (text: string, separator: RegExp) => text.split(separator).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
const deploymentHost = (host: string) => host === 'workers.dev' || host.endsWith('.workers.dev');
/** "support.acme-widgets.co.uk" becomes "Acme Widgets": its registrable label, as words. */
function nameFromHost(host: string): string | null {
    // A deployment address names the hosting platform, not the owner's business.
    if (deploymentHost(host)) return null;
    const labels = host.split('.').filter(Boolean);
    if (labels[0] === 'www') labels.shift();
    labels.pop();
    if (labels.length > 1 && secondLevel.has(labels[labels.length - 1])) labels.pop();
    const label = labels.pop();
    return label && /[a-z0-9]/i.test(label) ? words(label, /[-_]+/) : null;
}
/** The workspace name for a website and owner email: the public website's, else the company email domain's, else the fallback. */
export function deriveWorkspaceName(website: string, email: string): string {
    const host = publicHost(website), domain = companyDomain(email);
    if (host && deploymentHost(host)) return FALLBACK_WORKSPACE_NAME;
    return ((host && nameFromHost(host)) || (domain && nameFromHost(domain)) || FALLBACK_WORKSPACE_NAME).slice(0, 200);
}
/** The owner's name from the part of their address before the @: "ada.lovelace+work" is "Ada Lovelace". */
export function deriveOwnerName(email: string): string {
    const local = email.trim().split('@')[0].split('+')[0];
    return (words(local, /[._-]+/) || email.trim()).slice(0, 200);
}
