import cssColorNames from 'css-color-names';

// The seven pastel fills behind a contact's ink glyph (brand-tokens.css), each with the hue the nickname's colour is
// matched against. The id hash picks one when the contact has no nickname colour.
const PROFILE_TILES = Object.freeze([
    { name: 'aqua', hue: 187, tile: 'var(--avatar-aqua)' },
    { name: 'sky', hue: 211, tile: 'var(--avatar-sky)' },
    { name: 'lilac', hue: 257, tile: 'var(--avatar-lilac)' },
    { name: 'pink', hue: 340, tile: 'var(--avatar-pink)' },
    { name: 'coral', hue: 14, tile: 'var(--avatar-coral)' },
    { name: 'apricot', hue: 37, tile: 'var(--avatar-apricot)' },
    { name: 'mint', hue: 142, tile: 'var(--avatar-mint)' },
]);

const PROFILE_SYMBOL_INK = 'var(--ink)';

function stableIndex(value, length) {
    const text = String(value || 'contact');
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0) % length;
}

function hexToRgb(color) {
    const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color || '');
    return match ? match.slice(1).map(value => parseInt(value, 16)) : null;
}

function hueAndSaturation(color) {
    const rgb = hexToRgb(color);
    if (!rgb) {
        return null;
    }

    const [red, green, blue] = rgb.map(value => value / 255);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    if (delta === 0) {
        return { hue: 0, saturation: 0 };
    }

    let hue;
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;

    return { hue: Math.round(((hue * 60) + 360) % 360), saturation: delta / (1 - Math.abs(max + min - 1)) };
}

function hueDistance(first, second) {
    const distance = Math.abs(first - second);
    return Math.min(distance, 360 - distance);
}

export function resolveContactProfilePalette(identityColor, stableContactId) {
    const identity = hueAndSaturation(identityColor);
    const tile = identity && identity.saturation >= 0.18
        ? PROFILE_TILES.reduce((closest, candidate) => (
            hueDistance(identity.hue, candidate.hue) < hueDistance(identity.hue, closest.hue) ? candidate : closest
        ))
        : PROFILE_TILES[stableIndex(stableContactId, PROFILE_TILES.length)];

    return { ...tile, ink: PROFILE_SYMBOL_INK };
}

// Keep nickname parsing with the profile palette so every avatar surface uses
// the same color name and stable contact identity as ContactAvatar.
export function resolveContactNicknameColor(nickname) {
    if (typeof nickname !== 'string') {
        return { name: null, color: null, shape: null };
    }

    const nicknameWords = nickname.toLowerCase().split(' ');
    const shape = nicknameWords.pop();
    const name = nicknameWords.join('');

    return { name, color: cssColorNames[name] || null, shape };
}

export function contactIdentityColor(nickname) {
    if (typeof nickname !== 'string') {
        return null;
    }

    const nicknameWords = nickname.toLowerCase().trim().split(/\s+/).filter(Boolean);
    nicknameWords.pop();
    return cssColorNames[nicknameWords.join('')] || null;
}

export function resolveContactProfilePaletteForContact(contact = {}, identityColor = resolveContactNicknameColor(contact.nickname).color) {
    return resolveContactProfilePalette(
        identityColor,
        contact.id || contact.nickname || contact.display_name,
    );
}

export { PROFILE_TILES, PROFILE_SYMBOL_INK };
