import cssColorNames from 'css-color-names';

const BRIGHT_PROFILE_TILES = Object.freeze([
    { name: 'cyan', hue: 182, tile: '#a0eeee' },
    { name: 'pink', hue: 330, tile: '#fdb0d9' },
    { name: 'green', hue: 135, tile: '#a5efbb' },
    { name: 'blue', hue: 213, tile: '#b2d6fd' },
    { name: 'purple', hue: 270, tile: '#cda0fd' },
    { name: 'orange', hue: 20, tile: '#feae84' },
    { name: 'yellow', hue: 44, tile: '#fede79' },
]);

const PROFILE_SYMBOL_INK = '#182955';

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
        ? BRIGHT_PROFILE_TILES.reduce((closest, candidate) => (
            hueDistance(identity.hue, candidate.hue) < hueDistance(identity.hue, closest.hue) ? candidate : closest
        ))
        : BRIGHT_PROFILE_TILES[stableIndex(stableContactId, BRIGHT_PROFILE_TILES.length)];

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

export { BRIGHT_PROFILE_TILES, PROFILE_SYMBOL_INK };
