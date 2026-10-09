import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {measureFocusIndicator} from './accessibility-focus-contrast.mjs';

export function createInteractionAudit({evidenceDir, keyboard, layout, contrast}) {
    const keyboardPass = async (page, label, {count = 28, shadow = false} = {}) => {
        await page.evaluate(() => {
            const host = document.querySelector('#happytohelp > div');
            const root = host?.shadowRoot;
            (root?.activeElement || document.activeElement)?.blur?.();
            document.body.focus?.();
        });
        const sequence = [];
        for (let index = 0; index < count; index++) {
            await page.keyboard.press('Tab');
            const item = await page.evaluate(({shadow}) => {
                const host = document.querySelector('#happytohelp > div');
                const active = shadow ? host?.shadowRoot?.activeElement : document.activeElement;
                if (!active || active === document.body) return null;
                const rect = active.getBoundingClientRect();
                const style = getComputedStyle(active);
                const root = active.getRootNode();
                const hit = typeof root.elementFromPoint === 'function'
                    ? root.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                    : document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                const references = (active.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
                const referencedText = references.map(id => root.getElementById?.(id) || document.getElementById(id)).filter(Boolean).map(element => element.innerText?.trim() || element.textContent?.trim()).filter(Boolean).join(' ');
                const labels = active.labels ? [...active.labels].map(label => label.innerText?.trim() || label.textContent?.trim()).filter(Boolean).join(' ') : '';
                const ownText = active.innerText?.trim() || active.textContent?.trim() || '';
            const nameEntry = referencedText ? {name: referencedText, nameSource: 'aria-labelledby'}
                    : active.getAttribute('aria-label') ? {name: active.getAttribute('aria-label'), nameSource: 'aria-label'}
                        : labels ? {name: labels, nameSource: 'associated label'}
                            : active.getAttribute('alt') ? {name: active.getAttribute('alt'), nameSource: 'alt'}
                                : active.getAttribute('title') ? {name: active.getAttribute('title'), nameSource: 'title'}
                                : ownText ? {name: ownText, nameSource: 'visible text'} : {name: '', nameSource: null};
            return {
                    tag: active.tagName.toLowerCase(), role: active.getAttribute('role'), name: nameEntry.name.replace(/\s+/g, ' ').slice(0, 100), nameSource: nameEntry.nameSource,
                className: typeof active.className === 'string' ? active.className : '',
                rect: {x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height)},
                centerTarget: hit ? {tag: hit.tagName?.toLowerCase(), className: typeof hit.className === 'string' ? hit.className : '', rect: (() => { const targetRect = hit.getBoundingClientRect(); return {x: Math.round(targetRect.x), y: Math.round(targetRect.y), width: Math.round(targetRect.width), height: Math.round(targetRect.height)}; })()} : null,
                windowScroll: {x: window.scrollX, y: window.scrollY},

                    focusedVisible: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1) || style.boxShadow !== 'none',
                    withinViewport: rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight,
                    centerHit: hit === active || active.contains(hit),
                    tabIndex: active.tabIndex,
                };
            }, {shadow});
            if (item) {
                item.focusIndicator = await measureFocusIndicator(page, {shadow});
                sequence.push(item);
                if (!item.centerHit) await page.screenshot({path: join(evidenceDir, `${label}-occluded-${index}.png`)});
            }
        }
        const sample = {label, count, sequence};
        keyboard.push(sample);
        await writeFile(join(evidenceDir, `${label}-keyboard.json`), JSON.stringify(sample, null, 2));
        await page.screenshot({path: join(evidenceDir, `${label}-keyboard-focus.png`)});
        const missingFocus = sequence.filter(item => !item.focusedVisible);
        const unnamed = sequence.filter(item => !item.name);
        assert.deepEqual(unnamed, [], `${label} has keyboard stops without a computed name: ${JSON.stringify(unnamed)}`);
        assert.deepEqual(missingFocus, [], `${label} has keyboard stops without a visible focus indicator`);
        const lowContrastFocus = sequence.filter(item => item.focusIndicator.ringContrastAgainstHalo !== null && item.focusIndicator.ringContrastAgainstHalo < 3);
        assert.deepEqual(lowContrastFocus, [], `${label} has keyboard focus indicators below 3:1 against their computed surrounding surface`);
        const unreachable = sequence.filter(item => !item.withinViewport || !item.centerHit);
        assert.deepEqual(unreachable, [], `${label} has keyboard stops outside the viewport or obscured at their center`);
        return sequence;
    };

    const measureLayout = async (page, label, {shadow = false} = {}) => {
        const measurement = await page.evaluate(({shadow, label}) => {
            const host = document.querySelector('#happytohelp > div');
            const root = shadow ? host?.shadowRoot : document;
            const accessibleName = element => {
                const owner = element.getRootNode();
                const references = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
                const referencedText = references.map(id => owner.getElementById?.(id) || document.getElementById(id)).filter(Boolean).map(target => target.innerText?.trim() || target.textContent?.trim()).filter(Boolean).join(' ');
                if (referencedText) return {name: referencedText, nameSource: 'aria-labelledby'};
                if (element.getAttribute('aria-label')) return {name: element.getAttribute('aria-label'), nameSource: 'aria-label'};
                const labels = element.labels ? [...element.labels].map(label => label.innerText?.trim() || label.textContent?.trim()).filter(Boolean).join(' ') : '';
                if (labels) return {name: labels, nameSource: 'associated label'};
                if (element.getAttribute('alt')) return {name: element.getAttribute('alt'), nameSource: 'alt'};
                if (element.getAttribute('title')) return {name: element.getAttribute('title'), nameSource: 'title'};
                const text = element.innerText?.trim() || element.textContent?.trim() || '';
                return {name: text, nameSource: text ? 'visible text' : null};
            };
        const interactive = [...(root?.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="menuitem"], [tabindex]:not([tabindex="-1"])') || [])]
            .filter(element => {
                // The skip link is intentionally off-canvas until focus; a dedicated keyboard assertion verifies its focused state.
                if (element.matches('.workspace-skip-link')) return false;
                if (element.closest('[aria-hidden="true"], [inert]')) return false;
                const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    const visible = typeof element.checkVisibility !== 'function' || element.checkVisibility({checkOpacity: true, checkVisibilityCSS: true});
                    return element.getAttribute('type') !== 'file' && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && visible;
                }).map(element => {
                    const originalRect = element.getBoundingClientRect();
                    const savedWindowScroll = {x: window.scrollX, y: window.scrollY};
                    const savedElementScroll = [];
                    for (let current = element.parentElement; current; current = current.parentElement) {
                        savedElementScroll.push({element: current, x: current.scrollLeft, y: current.scrollTop});
                    }
                    element.scrollIntoView({block: 'nearest', inline: 'nearest'});
                    const rect = element.getBoundingClientRect();
                    const clippedBy = [];
                    for (let current = element.parentElement; current; current = current.parentElement) {
                        const style = getComputedStyle(current);
                        if (![style.overflow, style.overflowX, style.overflowY].some(value => ['auto', 'scroll', 'hidden', 'clip'].includes(value))) continue;
                        const bounds = current.getBoundingClientRect();
                        const left = bounds.left + current.clientLeft;
                        const top = bounds.top + current.clientTop;
                        const right = left + current.clientWidth;
                        const bottom = top + current.clientHeight;
                    if (rect.left < left - 2 || rect.top < top - 2 || rect.right > right + 2 || rect.bottom > bottom + 2) clippedBy.push(current.tagName.toLowerCase() + (typeof current.className === 'string' && current.className ? `.${current.className.trim().replace(/\s+/g, '.')}` : ''));
                    }
                    const hit = typeof root?.elementFromPoint === 'function'
                        ? root.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                        : document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    const name = accessibleName(element);
                const disabled = element.matches(':disabled');
                const record = {tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : '', role: element.getAttribute('role'), name: name.name.replace(/\s+/g, ' ').slice(0, 80), nameSource: name.nameSource, ariaHidden: Boolean(element.closest('[aria-hidden="true"]')), disabled, x: Math.round(originalRect.x), y: Math.round(originalRect.y), width: Math.round(originalRect.width), height: Math.round(originalRect.height), right: Math.round(originalRect.right), bottom: Math.round(originalRect.bottom), targetBelow24: originalRect.width < 24 || originalRect.height < 24, offscreenBeforeScroll: originalRect.left < -2 || originalRect.top < -2 || originalRect.right > innerWidth + 2 || originalRect.bottom > innerHeight + 2, clipped: rect.left < -2 || rect.top < -2 || rect.right > innerWidth + 2 || rect.bottom > innerHeight + 2 || clippedBy.length > 0, clippedBy, centerReachable: disabled || hit === element || element.contains(hit), hit: hit ? `${hit.tagName.toLowerCase()}${typeof hit.className === 'string' && hit.className ? `.${hit.className.trim().replace(/\s+/g, '.')}` : ''}` : null};
                    for (const state of savedElementScroll) {
                        state.element.scrollLeft = state.x;
                        state.element.scrollTop = state.y;
                    }
                    window.scrollTo(savedWindowScroll.x, savedWindowScroll.y);
                    return record;
                });
            const rectDetails = element => {
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return {x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom), display: style.display, visibility: style.visibility, transform: style.transform, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth};
            };
            const panel = shadow ? root?.querySelector('.happytohelp-interact-container') : null;
            const surface = shadow ? root?.querySelector('.happytohelp-interact') : null;
            const surfaceMeasurement = rectDetails(surface);
            return {
                label, viewport: {width: innerWidth, height: innerHeight}, document: {width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight},
                widget: shadow ? rectDetails(root?.querySelector('#happytohelp-root')) : null,
                panel: rectDetails(panel),
                surface: surfaceMeasurement,
                surfaceHorizontalOverflow: Boolean(surfaceMeasurement && surfaceMeasurement.scrollWidth > surfaceMeasurement.clientWidth + 1),
                horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                interactive,
                targetsBelow24: interactive.filter(item => item.targetBelow24),
                targetsClipped: interactive.filter(item => item.clipped),
            };
        }, {shadow, label});
        layout.push(measurement);
        await writeFile(join(evidenceDir, `${label}-layout.json`), JSON.stringify(measurement, null, 2));
        await page.screenshot({path: join(evidenceDir, `${label}-layout.png`), fullPage: !shadow});
        const unnamed = measurement.interactive.filter(item => !item.name);
        assert.deepEqual(unnamed, [], `${label} has visible interactive controls without an accessible name: ${JSON.stringify(unnamed)}`);
        return measurement;
    };

    const measureContrast = async (page, label, selectors, {shadow = false} = {}) => {
        const result = await page.evaluate(({label, selectors, shadow}) => {
            const host = document.querySelector('#happytohelp > div');
            const root = shadow ? host?.shadowRoot : document;
            const parse = color => {
                const value = color.trim();
                const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
                if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
                const hex = value.match(/^#([\da-f]{3,8})$/i)?.[1];
                if (hex) {
                    const expanded = hex.length <= 4 ? [...hex].map(channel => channel + channel).join('') : hex;
                    const values = expanded.match(/[\da-f]{2}/gi)?.map(channel => Number.parseInt(channel, 16)) || [];
                    return values.length >= 3 ? [values[0], values[1], values[2], values.length > 3 ? values[3] / 255 : 1] : null;
                }
                const values = value.match(/[\d.]+/g)?.map(Number) || [];
                return values.length >= 3 ? [values[0], values[1], values[2], values.length > 3 ? values[3] : 1] : null;
            };
            const composite = (front, back) => front.map((channel, index) => index === 3 ? 1 : channel * front[3] + back[index] * (1 - front[3])).slice(0, 3);
            const luminance = color => color.map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
            const hex = color => `#${color.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
            const imageColors = image => [...image.matchAll(/rgba?\([^)]*\)|#[\da-f]{3,8}/gi)].map(match => parse(match[0])).filter(Boolean);
            const gradientSamples = colors => colors.slice(0, -1).flatMap((color, index) => Array.from({length: 11}, (_, step) => {
                const next = colors[index + 1];
                const progress = step / 10;
                return color.slice(0, 3).map((channel, channelIndex) => channel + (next[channelIndex] - channel) * progress).concat(1);
            }));
            const output = [];
            for (const item of selectors) {
                const matches = [...(root?.querySelectorAll(item.selector) || [])];
                matches.forEach((element, index) => {
                    const style = getComputedStyle(element, item.pseudo || null);
                    const foreground = parse(style.color);
                    const layers = [];
                    const backgrounds = [];
                    for (let current = element; current && current.nodeType === 1; current = current.parentElement) {
                        const currentStyle = getComputedStyle(current);
                        const background = parse(currentStyle.backgroundColor);
                        if ((background && background[3] > 0) || currentStyle.backgroundImage !== 'none') backgrounds.unshift({selector: current.tagName.toLowerCase() + (typeof current.className === 'string' && current.className ? `.${current.className.trim().replace(/\s+/g, '.')}` : ''), backgroundColor: currentStyle.backgroundColor, backgroundImage: currentStyle.backgroundImage});
                        for (const pseudo of ['::before', '::after']) {
                            const pseudoStyle = getComputedStyle(current, pseudo);
                            const pseudoBackground = parse(pseudoStyle.backgroundColor);
                            if (pseudoStyle.content !== 'none' && pseudoStyle.opacity !== '0' && (pseudoStyle.backgroundImage !== 'none' || (pseudoBackground && pseudoBackground[3] > 0))) {
                                layers.push({element: current.tagName.toLowerCase() + (typeof current.className === 'string' && current.className ? `.${current.className.trim().replace(/\s+/g, '.')}` : ''), pseudo, content: pseudoStyle.content, opacity: pseudoStyle.opacity, backgroundColor: pseudoStyle.backgroundColor, backgroundImage: pseudoStyle.backgroundImage});
                            }
                        }
                    }
                    let candidateBackgrounds = [[255, 255, 255]];
                    const unresolvedBackgroundImages = [];
                    for (const layer of backgrounds) {
                        const color = parse(layer.backgroundColor);
                        if (color && color[3] > 0) {
                            candidateBackgrounds = color[3] >= 1
                                ? [color.slice(0, 3)]
                                : candidateBackgrounds.map(candidate => composite(color, candidate));
                            if (color[3] >= 1) unresolvedBackgroundImages.length = 0;
                        }
                        if (layer.backgroundImage !== 'none') {
                            const stops = imageColors(layer.backgroundImage);
                            if (stops.length >= 2) {
                                const samples = gradientSamples(stops);
                                candidateBackgrounds = candidateBackgrounds.flatMap(candidate => samples.map(sample => composite(sample, candidate)));
                            } else if (stops.length === 1) {
                                candidateBackgrounds = candidateBackgrounds.map(candidate => composite(stops[0], candidate));
                            } else {
                                unresolvedBackgroundImages.push({selector: layer.selector, backgroundImage: layer.backgroundImage});
                            }
                        }
                    }
                    const opacity = Number.parseFloat(style.opacity || '1');
                    const effectiveForeground = foreground ? foreground.map((channel, channelIndex) => channelIndex === 3 ? channel * opacity : channel) : null;
                    const ratios = effectiveForeground ? candidateBackgrounds.map(background => {
                        const foregroundLuminance = luminance(composite(effectiveForeground, background));
                        const backgroundLuminance = luminance(background);
                        return {background: hex(background), ratio: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)};
                    }) : [];
                    const minimumRatio = ratios.length ? Math.min(...ratios.map(item => item.ratio)) : null;
                    output.push({label: item.label, selector: item.selector, pseudo: item.pseudo || null, minimum: item.minimum || 4.5, optional: Boolean(item.optional), index, found: true, foreground: style.color, backgroundImage: getComputedStyle(element).backgroundImage, resolvedBackground: ratios[0]?.background || null, resolvedBackgrounds: [...new Set(ratios.map(item => item.background))], contrastRatio: minimumRatio === null ? null : Number(minimumRatio.toFixed(2)), measuredFontSize: style.fontSize, opacity: style.opacity, backgroundLayers: backgrounds, unresolvedBackgroundImages, visiblePseudoLayers: layers});
                });
                if (!matches.length) output.push({label: item.label, selector: item.selector, pseudo: item.pseudo || null, minimum: item.minimum || 4.5, optional: Boolean(item.optional), found: false});
            }
            return {label, timestamp: new Date().toISOString(), viewport: {width: innerWidth, height: innerHeight}, measurements: output};
        }, {label, selectors, shadow});
        contrast.push(result);
        await writeFile(join(evidenceDir, `${label}-contrast.json`), JSON.stringify(result, null, 2));
        const failures = result.measurements.filter(item => (!item.found && !item.optional) || (item.found && (item.contrastRatio === null || item.contrastRatio < (item.minimum || 4.5))));
        assert.deepEqual(failures, [], `${label} manual text/icon contrast below 4.5:1: ${JSON.stringify(failures)}`);
        return result;
    };

    return {keyboardPass, measureLayout, measureContrast};
}
