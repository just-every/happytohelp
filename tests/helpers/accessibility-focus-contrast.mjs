import {contrastRatio, decodePng, parseCssColor} from './accessibility-contrast.mjs';

export const compositeColor = (front, back) => front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3]));

export async function measureFocusIndicator(page, {shadow = false, samplePixels = false} = {}) {
    const detail = await page.evaluate(shadow => {
        const active = shadow ? document.querySelector('#happytohelp > div')?.shadowRoot?.activeElement : document.activeElement;
        const style = getComputedStyle(active);
        const layers = [];
        for (let node = active.parentElement || active.getRootNode().host; node; node = node.parentElement || node.getRootNode().host) {
            const layer = getComputedStyle(node);
            layers.unshift({color: layer.backgroundColor, image: layer.backgroundImage, opacity: layer.opacity});
        }
        const rect = active.getBoundingClientRect();
        return {outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset, outlineColor: style.outlineColor, opacity: style.opacity, boxShadow: style.boxShadow, layers, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}};
    }, shadow);
    let surface = [255, 255, 255];
    for (const layer of detail.layers) surface = compositeColor(parseCssColor(layer.color), surface);
    const shadowColor = detail.boxShadow.match(/rgba?\([^)]*\)|#[\da-f]{3,8}/i)?.[0];
    const halo = shadowColor ? compositeColor(parseCssColor(shadowColor), surface) : surface;
    const ring = parseCssColor(detail.outlineColor);
    ring[3] *= Number(detail.opacity);
    const effectiveRing = compositeColor(ring, halo);
    const css = channels => `rgb(${channels.join(', ')})`;
    const result = {...detail, surroundingSurface: halo, compositedOutline: effectiveRing,
        ringContrastAgainstHalo: detail.outlineStyle === 'none' ? null : contrastRatio(css(effectiveRing), css(halo))};
    if (samplePixels) {
        const image = decodePng(await page.screenshot());
        const scale = image.width / (await page.evaluate(() => innerWidth));
        const {rect} = detail;
        const offset = Number.parseFloat(detail.outlineOffset);
        const width = Number.parseFloat(detail.outlineWidth);
        const x = Math.floor((rect.x + rect.width / 2) * scale);
        const read = y => {
            const pixelY = Math.floor(y * scale);
            if (x < 0 || x >= image.width || pixelY < 0 || pixelY >= image.height) throw new Error('Focus sample is outside viewport');
            const start = (pixelY * image.width + x) * 4;
            return [...image.pixels.slice(start, start + 3)];
        };
        const foreground = read(rect.y - offset - width / 2);
        const background = read(rect.y - offset + 1);
        result.pixelSample = {foreground, background, contrastRatio: contrastRatio(css(foreground), css(background))};
    }
    return result;
}
