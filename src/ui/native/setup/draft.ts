import { companyDomain, deriveWorkspaceName, FALLBACK_WORKSPACE_NAME } from '../../../modules/identity/workspace-defaults';

/** What the owner has typed. `website` is null until they touch the field: until then it follows their email's company domain. */
export type SetupDraft = { email: string; password: string; setupToken: string; website: string | null };
export const emptyDraft: SetupDraft = { email: '', password: '', setupToken: '', website: null };

/** The website the field shows: what the owner typed, else the company domain of their email, else empty. Never this app's own address. */
export const shownWebsite = (draft: SetupDraft) => draft.website ?? (companyDomain(draft.email) ? `https://${companyDomain(draft.email)}` : '');
/** The website as it is sent: a bare "acme.com" is taken as https://acme.com. */
export const submittedWebsite = (draft: SetupDraft) => { const typed = shownWebsite(draft).trim(); return typed && !/^[a-z][a-z0-9+.-]*:/i.test(typed) ? `https://${typed}` : typed; };
/** The name the server will give the workspace, or null while neither the website nor the email says anything about the company. */
export function derivedName(draft: SetupDraft) {
    const name = deriveWorkspaceName(submittedWebsite(draft), draft.email);
    return name === FALLBACK_WORKSPACE_NAME ? null : name;
}
/** The one reason the form cannot be sent yet, or null. The server checks the same rules again. */
export function problem(draft: SetupDraft, tokenRequired: boolean) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Enter a valid email address.';
    if (draft.password.length < 12) return 'Use a password of at least 12 characters.';
    if (tokenRequired && !draft.setupToken) return 'Enter the setup token provided with your installation.';
    return /^https?:\/\/[^\s/]+/i.test(submittedWebsite(draft)) ? null : 'Enter your website, for example https://acme.com.';
}

/** The values a link may carry in its fragment (hosted and agent-driven setup). They are read once and removed from the address bar. */
export function readFragment(): SetupDraft {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const take = (key: string) => { const value = fragment.get(key); fragment.delete(key); return typeof value === 'string' && value.length <= 2048 ? value : ''; };
    const draft: SetupDraft = { ...emptyDraft, email: take('email'), setupToken: take('setupToken') };
    const website = take('allowedOrigin');
    if (website) draft.website = website;
    history.replaceState(history.state, '', location.pathname + location.search + (fragment.size ? '#' + fragment : ''));
    return draft;
}
