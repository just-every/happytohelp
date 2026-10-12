export type SetupDraft = { ownerName: string; email: string; password: string; name: string; allowedOrigin: string; primaryColor: string; setupToken: string };
export const emptyDraft: SetupDraft = { ownerName: '', email: '', password: '', name: '', allowedOrigin: '', primaryColor: '#7c3aed', setupToken: '' };
/** The colour the picker and the drawing show: the draft's while it is a full #rrggbb hex, the default while one is being typed. */
export const shownColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : emptyDraft.primaryColor;
const keys = ['ownerName', 'email', 'name', 'allowedOrigin', 'primaryColor'] as const;
const storageKey = 'h2h-setup-draft-v1';
export function loadDraft(): SetupDraft {
    let saved: Partial<SetupDraft> = {};
    try { const parsed = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed; } catch { /* Storage may be unavailable. */ }
    const fragment = new URLSearchParams(location.hash.slice(1));
    const draft = { ...emptyDraft, allowedOrigin: location.origin };
    for (const key of keys) {
        const value = fragment.get(key) ?? saved[key];
        if (typeof value === 'string' && value.length <= 2048) draft[key] = value;
        fragment.delete(key);
    }
    draft.setupToken = fragment.get('setupToken') || '';
    fragment.delete('setupToken');
    history.replaceState(history.state, '', location.pathname + location.search + (fragment.size ? '#' + fragment : ''));
    return draft;
}
export function saveDraft(draft: SetupDraft) {
    const safe = Object.fromEntries(keys.map(key => [key, draft[key]]));
    try { sessionStorage.setItem(storageKey, JSON.stringify(safe)); } catch { /* The form remains usable without browser storage. */ }
}
export function clearDraft() { try { sessionStorage.removeItem(storageKey); } catch { /* No stored draft. */ } }
