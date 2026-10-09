import {parseCssColor, contrastRatio} from './accessibility-contrast.mjs';

// Rectangles locate potential text; screenshot differences identify actual glyph
// pixels. Hit tests exclude covered pixels explicitly, never as passing contrast.
// Black/white surface probes measure transmission through shadows/overlays so
// the foreground and background are compared after the same compositing.
export function measureOccludedContrast({glyph, background, black, white, fragments, elementSize, visibility}) {
    for (const image of [glyph, black, white]) {
        if (image.width !== background.width || image.height !== background.height) throw new Error('Contrast probe geometry changed');
    }
    const sx = background.width / elementSize.width, sy = background.height / elementSize.height;
    const visible = new Map(visibility.map(point => [`${point.x},${point.y}`, point.visible]));
    const rgb = (image, x, y) => [...image.pixels.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)];
    let minimum = Infinity, sampledPixels = 0, coveredPixels = 0, unsupportedPixels = 0;
    const seen = new Set(), results = [];
    for (const fragment of fragments) {
        const foreground = parseCssColor(fragment.foreground);
        if (!foreground) throw new Error(`Unsupported foreground: ${fragment.foreground}`);
        let count = 0, fragmentMinimum = Infinity;
        for (const rect of fragment.glyphRects || fragment.rects) {
            for (let y = Math.max(0, Math.floor(rect.y * sy)); y < Math.min(background.height, Math.ceil((rect.y + rect.height) * sy)); y++) {
                for (let x = Math.max(0, Math.floor(rect.x * sx)); x < Math.min(background.width, Math.ceil((rect.x + rect.width) * sx)); x++) {
                    const key = `${x},${y}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    if (!visible.get(`${Math.floor(x / sx)},${Math.floor(y / sy)}`)) {coveredPixels++; continue;}
                    const bg = rgb(background, x, y), actual = rgb(glyph, x, y);
                    if (!actual.some((channel, i) => Math.abs(channel - bg[i]) > 1)) continue;
                    const low = rgb(black, x, y), high = rgb(white, x, y);
                    const transmission = high.map((channel, i) => (channel - low[i]) / 255);
                    // An opaque child background or non-linear effect cannot be
                    // reconstructed by these probes: retain an explicit limitation.
                    if (transmission.some(channel => channel <= 0 || channel > 1)) {unsupportedPixels++; continue;}
                    const alpha = foreground[3] * (fragment.opacity ?? 1);
                    const effective = foreground.slice(0, 3).map((channel, i) => (low[i] + transmission[i] * channel) * alpha + bg[i] * (1 - alpha));
                    const ratio = contrastRatio(`rgb(${effective.join(',')})`, `rgb(${bg.join(',')})`, null);
                    minimum = Math.min(minimum, ratio); fragmentMinimum = Math.min(fragmentMinimum, ratio);
                    sampledPixels++; count++;
                }
            }
        }
        if (count) results.push({text: fragment.text.slice(0, 100), sampledPixels: count, minimumContrastRatio: fragmentMinimum});
    }
    return {sampledPixels, minimumContrastRatio: Number.isFinite(minimum) ? minimum : null, fragments: results,
        occlusion: {coveredPixels, unsupportedPixels, status: 'LIMITED', reason: 'Covered pixels cannot establish hidden text contrast; visible glyph pixels are independently enforced.', visibleTextThresholdEnforced: sampledPixels > 0 && unsupportedPixels === 0}};
}
