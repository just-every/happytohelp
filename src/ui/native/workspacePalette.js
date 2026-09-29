// Ported from the original HappyToHelp workspace theme.
const DEFAULT_PRIMARY = '#713ee0';

const DEFAULT_PALETTE = {
    '--bs-primary-rgb': '113, 62, 224',
    '--bs-action-rgb': '91, 45, 194',
    '--workspace-primary-soft': '#f5f2fd',
    '--workspace-primary-hover': '#faf9fd',
    '--workspace-primary-border': '#ded1fb',
    '--workspace-primary-border-strong': '#c8b7f0',
    '--conversation-nav-ink': '#faf8ff',
    '--conversation-nav-muted': '#e0d8f4',
    '--conversation-nav-quiet': '#bfb3dc',
    '--conversation-nav-hover': '#332563',
    '--conversation-nav-active': '#5b33b8',
    '--conversation-nav-parent-active': '#2f215e',
    '--conversation-nav-badge': '#392c65',
    '--conversation-nav-active-badge': '#8350d9',
    '--conversation-nav-line': '#392969',
    '--conversation-nav-focus': '#cda0fd',
    '--workspace-nav-bg': '#1f144e',
};

function normalizeWorkspaceColor(color) {
    if (typeof color !== 'string') return null;

    const value = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(value)) return value;
    if (/^#[0-9a-f]{3}$/.test(value)) return `#${value.slice(1).split('').map(part => part + part).join('')}`;
    return null;
}

function hexToRgb(hex) {
    return [ 1, 3, 5 ].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
}

function rgbToHex(rgb) {
    return `#${rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(rgb) {
    const [ red, green, blue ] = rgb.map(value => value / 255);
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const lightness = (maximum + minimum) / 2;
    const delta = maximum - minimum;

    if (!delta) return { hue: 0, saturation: 0, lightness };

    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue;
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    return { hue: (hue * 60 + 360) % 360, saturation, lightness };
}

function hslToHex(hue, saturation, lightness) {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const segment = hue / 60;
    const offset = chroma * (1 - Math.abs(segment % 2 - 1));
    const match = lightness - chroma / 2;
    const channels = segment < 1 ? [ chroma, offset, 0 ]
        : segment < 2 ? [ offset, chroma, 0 ]
            : segment < 3 ? [ 0, chroma, offset ]
                : segment < 4 ? [ 0, offset, chroma ]
                    : segment < 5 ? [ offset, 0, chroma ] : [ chroma, 0, offset ];
    return rgbToHex(channels.map(channel => (channel + match) * 255));
}

function luminance(hex) {
    return hexToRgb(hex).map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, channel, index) => total + channel * [ 0.2126, 0.7152, 0.0722 ][index], 0);
}

function contrast(first, second) {
    const [ light, dark ] = [ luminance(first), luminance(second) ].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
}

function readableColor(hue, saturation, lightness, backgrounds) {
    let candidate = hslToHex(hue, saturation, Math.min(lightness, 0.5));
    for (let current = Math.min(lightness, 0.5); current >= 0.12; current -= 0.005) {
        candidate = hslToHex(hue, saturation, current);
        if (backgrounds.every(background => contrast(candidate, background) >= 4.5)) return candidate;
    }
    return candidate;
}

function createWorkspacePalette(color) {
    const normalized = normalizeWorkspaceColor(color) || DEFAULT_PRIMARY;
    if (normalized === DEFAULT_PRIMARY) return { ...DEFAULT_PALETTE };

    let { hue, saturation, lightness } = rgbToHsl(hexToRgb(normalized));
    if (saturation < 0.12) {
        hue = 0;
        saturation = 0;
        lightness = Math.max(0.32, Math.min(0.42, lightness || 0.38));
    }

    const soft = hslToHex(hue, saturation * 0.35, 0.97);
    const primary = readableColor(hue, saturation, lightness, [ '#ffffff', soft ]);
    const action = hslToHex(hue, saturation, Math.max(0.12, rgbToHsl(hexToRgb(primary)).lightness - 0.1));
    const navSaturation = saturation * 0.72;
    const navInk = hslToHex(hue, saturation * 0.14, 0.985);
    const navActive = readableColor(hue, navSaturation, 0.42, [ '#ffffff', navInk ]);
    const navActiveBadge = readableColor(hue, saturation * 0.62, 0.64, [ '#ffffff' ]);

    return {
        '--bs-primary-rgb': hexToRgb(primary).join(', '),
        '--bs-action-rgb': hexToRgb(action).join(', '),
        '--workspace-primary-soft': soft,
        '--workspace-primary-hover': hslToHex(hue, saturation * 0.18, 0.985),
        '--workspace-primary-border': hslToHex(hue, saturation * 0.34, 0.9),
        '--workspace-primary-border-strong': hslToHex(hue, saturation * 0.5, 0.82),
        '--conversation-nav-ink': navInk,
        '--conversation-nav-muted': hslToHex(hue, saturation * 0.25, 0.89),
        '--conversation-nav-quiet': hslToHex(hue, saturation * 0.32, 0.75),
        '--conversation-nav-hover': hslToHex(hue, navSaturation, 0.27),
        '--conversation-nav-active': navActive,
        '--conversation-nav-parent-active': hslToHex(hue, navSaturation, 0.25),
        '--conversation-nav-badge': hslToHex(hue, navSaturation, 0.29),
        '--conversation-nav-active-badge': navActiveBadge,
        '--conversation-nav-line': hslToHex(hue, navSaturation, 0.31),
        '--conversation-nav-focus': hslToHex(hue, saturation * 0.5, 0.8),
        '--workspace-nav-bg': hslToHex(hue, navSaturation, 0.19),
    };
}

export { DEFAULT_PRIMARY, createWorkspacePalette, normalizeWorkspaceColor, hexToRgb, rgbToHex, rgbToHsl, hslToHex, contrast };
