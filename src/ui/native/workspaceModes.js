// Ported from the original HappyToHelp workspace theme.
import {
    DEFAULT_PRIMARY, createWorkspacePalette, normalizeWorkspaceColor,
    hexToRgb, rgbToHex, rgbToHsl, hslToHex, contrast,
} from './workspacePalette.js';

const MODES = ['balanced', 'light', 'dark'];
const DEFAULT_GLOBAL_INBOX_BACKGROUND = '#ffffff';
const LIGHT_SURFACES = {
    '--workspace-surface': '#ffffff',
    '--workspace-surface-raised': '#ffffff',
    '--workspace-field-bg': '#ffffff',
    '--workspace-surface-subtle': '#f9fbfd',
    '--workspace-ink': '#19153d',
    '--workspace-muted': '#536080',
    '--workspace-quiet': '#747f9b',
    '--workspace-line': '#e7eaf1',
};

function normalizeWorkspaceMode(mode) {
    return MODES.includes(mode) ? mode : 'balanced';
}

function tint(base, color, amount) {
    const selected = hexToRgb(color);
    return rgbToHex(hexToRgb(base).map((channel, index) => channel * (1 - amount) + selected[index] * amount));
}

function readableInk(background) {
    const candidates = ['#19153d', '#f0f1f7', '#000000', '#ffffff'];

    return candidates.find(candidate => contrast(candidate, background) >= 4.5) || '#000000';
}

function readableTone(background, ink, minimumContrast) {
    for (let amount = 0.62; amount <= 1; amount += 0.02) {
        const candidate = tint(background, ink, amount);
        if (contrast(candidate, background) >= minimumContrast) return candidate;
    }

    return ink;
}

function readableSelectedSurface(background, accent, ink, amount) {
    for (let currentAmount = amount; currentAmount >= 0; currentAmount -= 0.01) {
        const candidate = tint(background, accent, currentAmount);
        if (contrast(candidate, ink) >= 4.5) return candidate;
    }

    return background;
}

/**
 * Keep the user's global inbox background on the same token surface used by
 * the conversation app. Project workspaces do not call this branch.
 */
function createGlobalInboxSurfaceTheme(background, accent) {
    const normalizedBackground = normalizeWorkspaceColor(background) || DEFAULT_GLOBAL_INBOX_BACKGROUND;
    const normalizedAccent = normalizeWorkspaceColor(accent) || DEFAULT_PRIMARY;

    // The default delegates to the established mode palettes, including Dark.
    if (normalizedBackground === DEFAULT_GLOBAL_INBOX_BACKGROUND) return {};

    const ink = readableInk(normalizedBackground);
    const muted = readableTone(normalizedBackground, ink, 4.5);
    const quiet = readableTone(normalizedBackground, ink, 3);
    const primarySoft = readableSelectedSurface(normalizedBackground, normalizedAccent, ink, 0.18);
    const primaryHover = readableSelectedSurface(normalizedBackground, normalizedAccent, ink, 0.09);
    const surfaceRaised = readableSelectedSurface(normalizedBackground, ink, ink, 0.018);
    const fieldBackground = readableSelectedSurface(normalizedBackground, ink, ink, 0.028);
    const surfaceSubtle = readableSelectedSurface(normalizedBackground, ink, ink, 0.045);

    return {
        '--workspace-surface': normalizedBackground,
        '--workspace-surface-raised': surfaceRaised,
        '--workspace-field-bg': fieldBackground,
        '--workspace-surface-subtle': surfaceSubtle,
        '--workspace-line': tint(normalizedBackground, ink, 0.14),
        '--workspace-primary-soft': primarySoft,
        '--workspace-primary-hover': primaryHover,
        '--workspace-primary-border': tint(normalizedBackground, normalizedAccent, 0.32),
        '--workspace-primary-border-strong': tint(normalizedBackground, normalizedAccent, 0.52),
        '--workspace-ink': ink,
        '--workspace-muted': muted,
        '--workspace-quiet': quiet,
        '--conversation-ink': ink,
        '--conversation-muted': muted,
        '--conversation-quiet': quiet,
        '--conversation-line': tint(normalizedBackground, ink, 0.14),
    };
}

function lightNavigation(color, palette) {
    const primary = rgbToHex(palette['--bs-primary-rgb'].split(',').map(Number));
    const isDefault = color === DEFAULT_PRIMARY;
    return {
        '--workspace-nav-bg': isDefault ? '#f8f7fe' : tint('#ffffff', color, 0.035),
        '--conversation-nav-ink': LIGHT_SURFACES['--workspace-ink'],
        '--conversation-nav-muted': LIGHT_SURFACES['--workspace-muted'],
        '--conversation-nav-quiet': LIGHT_SURFACES['--workspace-quiet'],
        '--conversation-nav-hover': isDefault ? '#eee9fa' : tint('#ffffff', color, 0.08),
        '--conversation-nav-active': palette['--workspace-primary-soft'],
        '--conversation-nav-active-ink': primary,
        '--conversation-nav-parent-active': palette['--workspace-primary-hover'],
        '--conversation-nav-badge': isDefault ? '#ebe8f4' : tint('#ffffff', color, 0.07),
        '--conversation-nav-active-badge': primary,
        '--conversation-nav-line': palette['--workspace-primary-border'],
        '--conversation-nav-focus': primary,
    };
}

function darkPalette(color, palette) {
    const { hue, saturation } = rgbToHsl(hexToRgb(color));
    const chroma = saturation < 0.12 ? 0 : Math.min(0.8, Math.max(0.45, saturation));
    // The selected 12UI direction uses charcoal, with only a hint of the workspace hue.
    const surface = color === DEFAULT_PRIMARY ? '#121723' : tint('#111722', color, 0.025);
    const raised = color === DEFAULT_PRIMARY ? '#1b202d' : tint('#1a202a', color, 0.035);
    const field = color === DEFAULT_PRIMARY ? '#161b27' : tint('#151b25', color, 0.03);
    const soft = color === DEFAULT_PRIMARY ? '#25203d' : tint(surface, color, 0.14);
    let accent;
    for (let lightness = 0.74; lightness <= 0.96; lightness += 0.01) {
        accent = hslToHex(hue, chroma, lightness);
        if ([surface, raised, field, soft].every(background => contrast(accent, background) >= 4.5)) break;
    }

    return {
        '--workspace-surface': surface,
        '--workspace-surface-raised': raised,
        '--workspace-field-bg': field,
        '--workspace-surface-subtle': tint(surface, '#ffffff', 0.025),
        '--workspace-ink': '#f0f1f7',
        '--workspace-muted': '#b9c0d2',
        '--workspace-quiet': '#9aa4bb',
        '--workspace-line': tint(surface, '#ffffff', 0.12),
        '--workspace-primary-soft': soft,
        '--workspace-primary-hover': tint(surface, color, 0.055),
        '--workspace-primary-border': tint(surface, accent, 0.22),
        '--workspace-primary-border-strong': tint(surface, accent, 0.42),
        '--bs-primary-rgb': hexToRgb(accent).join(', '),
        '--bs-action-rgb': hexToRgb(hslToHex(hue, chroma, 0.86)).join(', '),
        '--workspace-nav-bg': color === DEFAULT_PRIMARY ? '#121624' : tint(surface, color, 0.025),
        '--conversation-nav-ink': '#f0f1f7',
        '--conversation-nav-muted': '#b9c0d2',
        '--conversation-nav-quiet': '#9aa4bb',
        '--conversation-nav-hover': tint(surface, '#ffffff', 0.055),
        '--conversation-nav-active': color === DEFAULT_PRIMARY ? '#392b63' : tint(surface, color, 0.25),
        '--conversation-nav-active-ink': '#f0f1f7',
        '--conversation-nav-parent-active': tint(surface, '#ffffff', 0.04),
        '--conversation-nav-badge': tint(surface, '#ffffff', 0.07),
        '--conversation-nav-active-badge': palette['--workspace-button-bg'],
        '--conversation-nav-line': tint(surface, '#ffffff', 0.1),
        '--conversation-nav-focus': accent,
    };
}

function createWorkspaceTheme(color, mode = 'balanced') {
    const normalizedColor = normalizeWorkspaceColor(color) || DEFAULT_PRIMARY;
    const normalizedMode = normalizeWorkspaceMode(mode);
    const palette = createWorkspacePalette(normalizedColor);
    const theme = {
        ...palette,
        '--workspace-surface': LIGHT_SURFACES['--workspace-surface'],
        '--workspace-surface-raised': LIGHT_SURFACES['--workspace-surface-raised'],
        '--workspace-field-bg': LIGHT_SURFACES['--workspace-field-bg'],
        '--workspace-button-bg': rgbToHex(palette['--bs-primary-rgb'].split(',').map(Number)),
        '--workspace-button-hover-bg': rgbToHex(palette['--bs-action-rgb'].split(',').map(Number)),
        '--conversation-nav-active-ink': palette['--conversation-nav-ink'],
    };
    if (normalizedMode === 'light') Object.assign(theme, lightNavigation(normalizedColor, palette));
    if (normalizedMode === 'dark') Object.assign(theme, darkPalette(normalizedColor, theme));
    return theme;
}

export {
    MODES,
    createGlobalInboxSurfaceTheme,
    createWorkspaceTheme,
    normalizeWorkspaceMode,
};
