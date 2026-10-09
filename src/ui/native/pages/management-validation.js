// Client-side checks for the management create/edit forms. The server enforces the same rules (and more);
// these exist so a person sees a specific message next to the field instead of a rejected request.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blank = value => !String(value ?? '').trim();

export function pluginUrlError(value) {
    if (blank(value)) return 'URL is required.';
    let parsed;
    try { parsed = new URL(String(value).trim()); } catch { return 'Enter a full web address, for example https://example.com/app.'; }
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return null;
    return 'Enter an https:// address. Plain http:// is only accepted for localhost.';
}

/** Field-level problems of a management draft keyed by field name, or null when it can be saved. */
export function validateManagementDraft(section, draft) {
    const errors = {};
    if (section === 'plugins') {
        if (blank(draft.name)) errors.name = 'Name is required.';
        const url = pluginUrlError(draft.url);
        if (url) errors.url = url;
    }
    if (section === 'contacts') {
        if (!draft.id && ['name', 'email', 'external_id'].every(key => blank(draft[key]))) errors.name = 'Enter a name, an email or an external ID. A contact needs at least one.';
        for (const key of ['email', 'provided_email']) if (!blank(draft[key]) && !EMAIL.test(String(draft[key]).trim())) errors[key] = 'Enter a valid email address.';
    }
    return Object.keys(errors).length ? errors : null;
}
