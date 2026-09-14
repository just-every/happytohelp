import { PROFILE_SYMBOL_ALIASES, PROFILE_SYMBOL_CATALOG } from './catalog';

export function getNicknameShape(nickname) {
    if (typeof nickname !== 'string') {
        return null;
    }

    const words = nickname.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? words[words.length - 1] : null;
}

export function stableProfileSymbolIndex(value, length = PROFILE_SYMBOL_CATALOG.length) {
    const text = String(value || 'contact');
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0) % length;
}

export default function resolveContactProfileSymbol(contact = {}) {
    const nicknameShape = getNicknameShape(contact.nickname);
    const isAnonymous = Boolean(contact.nickname && contact.display_name === contact.nickname);
    const aliasedSymbol = isAnonymous && nicknameShape && PROFILE_SYMBOL_ALIASES[nicknameShape];

    if (aliasedSymbol) {
        return aliasedSymbol;
    }

    // An anonymous nickname with a legacy shape that has no faithful library
    // equivalent keeps its existing Font Awesome symbol in ContactAvatar.
    if (isAnonymous) {
        return null;
    }

    return PROFILE_SYMBOL_CATALOG[stableProfileSymbolIndex(contact.id || contact.nickname || contact.display_name)].name;
}
