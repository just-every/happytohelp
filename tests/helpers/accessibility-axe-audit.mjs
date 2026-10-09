import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {measureOccludedContrast} from './accessibility-occlusion.mjs';
import {decodePng, measureContrastInRegions} from './accessibility-contrast.mjs';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const axeOptions = {runOnly: {type: 'tag', values: wcagTags}};

export function createAxeAudit({axePath, evidenceDir, scans, axeIncomplete, incompleteContrast}) {
    const reviewIncompleteContrast = async (page, label, incompleteRules, {shadow = false} = {}) => {
        const descriptors = incompleteRules.filter(rule => rule.id === 'color-contrast').flatMap(rule => rule.nodes.map(node => ({
            rule: rule.id,
            targets: node.target,
            message: node.any?.map(item => item.message).join('; '),
            expectedContrastRatio: [...(node.any || []), ...(node.all || [])].map(item => Number.parseFloat(item.data?.expectedContrastRatio)).find(Number.isFinite) || 4.5,
        })));
        if (!descriptors.length) return [];
        const instrumented = await page.evaluate(({descriptors, shadow, label}) => {
            const host = document.querySelector('#happytohelp > div');
            const root = shadow ? host?.shadowRoot : document;
            if (!root) throw new Error(`Accessibility contrast review root unavailable: ${shadow ? 'widget ShadowRoot' : 'document'}`);
            const targets = [];
            const savedScroll = new Map();
            let index = 0;
            for (const descriptor of descriptors) {
                const selectors = descriptor.targets.flatMap(target => Array.isArray(target) ? [target.at(-1)] : [target]).filter(Boolean);
                let matches = [];
                try {
                    matches = [...new Set(selectors.flatMap(selector => [...root.querySelectorAll(selector)]))];
                } catch (error) {
                    targets.push({...descriptor, id: null, status: 'limited', reason: `Axe target could not be selected for rendered measurement: ${error.message}`});
                    continue;
                }
                if (!matches.length) {
                    targets.push({...descriptor, id: null, status: 'limited', reason: 'Axe reported a contrast review item but its selector did not resolve in this rendered tree.'});
                    continue;
                }
            for (const element of matches) {
                const id = `${label}-${index++}`;
                const modal = root.querySelector('[role="dialog"][aria-modal="true"]');
                const obscuredByModal = Boolean(modal && !modal.contains(element));
                element.setAttribute('data-a11y-contrast-sample', id);
                    const elementRect = element.getBoundingClientRect();
                    const fragments = [];
                    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                    let textNode;
                    while ((textNode = walker.nextNode())) {
                        if (!textNode.textContent?.trim() || !textNode.parentElement) continue;
                        const style = getComputedStyle(textNode.parentElement);
                        const range = document.createRange();
                        range.selectNodeContents(textNode);
                        const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => ({x: rect.x - elementRect.x, y: rect.y - elementRect.y, width: rect.width, height: rect.height}));
                        if (!rects.length) continue;
                        let opacity = 1;
                        const visitOpacityAncestors = first => {
                            for (let current = first; current?.nodeType === 1; current = current.parentElement) opacity *= Number.parseFloat(getComputedStyle(current).opacity || '1');
                        };
                        visitOpacityAncestors(textNode.parentElement);
                        const treeRoot = element.getRootNode();
                        if (treeRoot.host) visitOpacityAncestors(treeRoot.host);
                        fragments.push({text: textNode.textContent.trim(), foreground: style.webkitTextFillColor && style.webkitTextFillColor !== 'currentcolor' ? style.webkitTextFillColor : style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, opacity, rects});
                    }
                    const placeholder = ['INPUT', 'TEXTAREA'].includes(element.tagName) ? element.getAttribute('placeholder') : null;
                    if (!fragments.length && placeholder) {
                        const style = getComputedStyle(element, '::placeholder');
                        const baseStyle = getComputedStyle(element);
                        const fontSize = Number.parseFloat(style.fontSize) || Number.parseFloat(baseStyle.fontSize) || 14;
                        const paddingLeft = Number.parseFloat(baseStyle.paddingLeft) || 0;
                        const paddingRight = Number.parseFloat(baseStyle.paddingRight) || 0;
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        context.font = style.font;
                        const textWidth = Math.min(elementRect.width - paddingLeft - paddingRight, context.measureText(placeholder).width);
                        fragments.push({text: placeholder, glyphRects: [{x: 0, y: 0, width: elementRect.width, height: elementRect.height}], foreground: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, opacity: Number.parseFloat(baseStyle.opacity || '1'), rects: [{x: paddingLeft, y: (elementRect.height - fontSize) / 2, width: Math.max(1, textWidth), height: fontSize}]});
                    }
                    for (let current = element; current?.nodeType === 1; current = current.parentElement) {
                        if (!savedScroll.has(current)) savedScroll.set(current, {x: current.scrollLeft, y: current.scrollTop});
                    }
                    const unsupportedTextEffects = [];
                    for (let current = element; current?.nodeType === 1; current = current.parentElement) {
                        const style = getComputedStyle(current);
                        if (style.mixBlendMode !== 'normal') unsupportedTextEffects.push(`mix-blend-mode ${style.mixBlendMode}`);
                        if (style.filter !== 'none') unsupportedTextEffects.push(`filter ${style.filter}`);
                        if (style.textShadow !== 'none') unsupportedTextEffects.push(`text-shadow ${style.textShadow}`);
                    }
                targets.push({...descriptor, id, elementSize: {width: elementRect.width, height: elementRect.height}, fragments, unsupportedTextEffects: [...new Set(unsupportedTextEffects)], obscuredByModal, status: fragments.length && elementRect.width > 0 && elementRect.height > 0 ? 'pending' : 'limited', reason: fragments.length ? undefined : 'The axe target has no visible text or placeholder in this rendered state.'});
                }
            }
            const styleId = `a11y-contrast-${label}`;
            if (targets.some(target => target.id)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = '[data-a11y-contrast-sample], [data-a11y-contrast-sample] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } [data-a11y-contrast-sample]::before, [data-a11y-contrast-sample]::after, [data-a11y-contrast-sample] *::before, [data-a11y-contrast-sample] *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } [data-a11y-contrast-sample]::placeholder, [data-a11y-contrast-sample] *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }';
                (shadow ? root : document.head).appendChild(style);
                style.disabled = true;
            }
            return {targets, styleId, savedScroll: [...savedScroll].map(([element, position], itemIndex) => {
                const scrollId = `${label}-scroll-${itemIndex}`;
                element.setAttribute('data-a11y-scroll-id', scrollId);
                return {id: scrollId, ...position};
            }), windowScroll: {x: window.scrollX, y: window.scrollY}};
        }, {descriptors, shadow, label});
        const review = [];
        try {
            for (const target of instrumented.targets) {
                if (target.status !== 'pending') {
                    review.push(target);
                    continue;
                }
            const locator = page.locator(`[data-a11y-contrast-sample="${target.id}"]`);
            const glyphBuffer = await locator.screenshot({animations: 'disabled', caret: 'hide'});
            const visibility = await locator.evaluate((element, fragments) => {
                const rect = element.getBoundingClientRect(), root = element.getRootNode();
                const points = [];
                for (const fragment of fragments) for (const region of fragment.glyphRects || fragment.rects) {
                    for (let y = Math.max(0, Math.floor(region.y)); y < Math.min(rect.height, Math.ceil(region.y + region.height)); y++) {
                        for (let x = Math.max(0, Math.floor(region.x)); x < Math.min(rect.width, Math.ceil(region.x + region.width)); x++) {
                            const hit = root.elementFromPoint(rect.x + x + .5, rect.y + y + .5);
                            points.push({x, y, visible: hit === element || element.contains(hit)});
                        }
                    }
                }
                return points;
            }, target.fragments);
            await page.evaluate(({shadow, styleId}) => {
                const root = shadow ? document.querySelector('#happytohelp > div')?.shadowRoot : document;
                root.getElementById(styleId).disabled = false;
            }, {shadow, styleId: instrumented.styleId});
            let measured;
            try {
                const imageBuffer = await locator.screenshot({animations: 'disabled', caret: 'hide'});
                if (visibility.some(point => !point.visible)) {
                    const originalStyle = await locator.getAttribute('style');
                    let blackBuffer, whiteBuffer;
                    try {
                        await locator.evaluate(element => element.style.setProperty('background-color', 'black', 'important'));
                        blackBuffer = await locator.screenshot({animations: 'disabled', caret: 'hide'});
                        await locator.evaluate(element => element.style.setProperty('background-color', 'white', 'important'));
                        whiteBuffer = await locator.screenshot({animations: 'disabled', caret: 'hide'});
                    } finally {
                        await locator.evaluate((element, value) => value === null ? element.removeAttribute('style') : element.setAttribute('style', value), originalStyle);
                    }
                    await writeFile(join(evidenceDir, `${target.id}-visibility.json`), JSON.stringify(visibility));
                    measured = measureOccludedContrast({glyph: decodePng(glyphBuffer), background: decodePng(imageBuffer), black: decodePng(blackBuffer), white: decodePng(whiteBuffer), fragments: target.fragments, elementSize: target.elementSize, visibility});
                    for (const [name, bytes] of [['glyph', glyphBuffer], ['background', imageBuffer], ['black', blackBuffer], ['white', whiteBuffer]]) await writeFile(join(evidenceDir, `${target.id}-${name}.png`), bytes);
                } else measured = measureContrastInRegions(decodePng(imageBuffer), target.fragments, target.elementSize);
            } finally {
                await page.evaluate(({shadow, styleId}) => {
                    const root = shadow ? document.querySelector('#happytohelp > div')?.shadowRoot : document;
                    root.getElementById(styleId).disabled = true;
                }, {shadow, styleId: instrumented.styleId});
            }
            let status = measured.minimumContrastRatio !== null && measured.minimumContrastRatio < target.expectedContrastRatio ? 'failed' : target.unsupportedTextEffects.length || measured.occlusion?.unsupportedPixels || measured.minimumContrastRatio === null ? 'limited' : 'measured';
            let reason = status === 'limited' ? target.unsupportedTextEffects.length ? `Rendered text uses unsupported effects: ${target.unsupportedTextEffects.join(', ')}.` : measured.occlusion?.unsupportedPixels ? `${measured.occlusion.unsupportedPixels} visible glyph pixels have unsupported surface transmission and remain LIMITED.` : 'No visible glyph pixels were captured from the rendered target; occluded pixels remain LIMITED.' : undefined;
            if (target.obscuredByModal && status === 'failed') {
                const unobscuredMeasurement = incompleteContrast.flatMap(scan => scan.entries.map(entry => ({scan: scan.label, ...entry})))
                    .find(entry => entry.status === 'measured' && entry.targets.some(targets => targets.includes(target.targets[0])));
                if (unobscuredMeasurement) {
                    status = 'limited';
                    reason = `The active modal makes this background control unavailable; the same text was measured at ${unobscuredMeasurement.minimumContrastRatio}:1 while unobscured in ${unobscuredMeasurement.scan}.`;
                }
            }
                review.push({...target, screenshot: 'actual glyph and transparent-text background screenshots; partially occluded targets use per-pixel hit tests and black/white surface transfer', ...measured, status, reason});
            }
        } finally {
            await page.evaluate(({shadow, styleId, targets, savedScroll, windowScroll}) => {
                const host = document.querySelector('#happytohelp > div');
                const root = shadow ? host?.shadowRoot : document;
                root?.getElementById?.(styleId)?.remove();
                for (const target of targets) {
                    if (target.id) root?.querySelector(`[data-a11y-contrast-sample="${target.id}"]`)?.removeAttribute('data-a11y-contrast-sample');
                }
                for (const position of savedScroll) {
                    const element = root?.querySelector(`[data-a11y-scroll-id="${position.id}"]`);
                    if (element) {
                        element.scrollLeft = position.x;
                        element.scrollTop = position.y;
                        element.removeAttribute('data-a11y-scroll-id');
                    }
                }
                window.scrollTo(windowScroll.x, windowScroll.y);
            }, {shadow, styleId: instrumented.styleId, targets: instrumented.targets, savedScroll: instrumented.savedScroll, windowScroll: instrumented.windowScroll});
        }
        return review;
    };

    const scan = async (page, label, {shadow = false} = {}) => {
        if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({path: axePath});
        const result = await page.evaluate(async ({shadow, options}) => {
            const host = document.querySelector('#happytohelp > div');
            const root = shadow ? host?.shadowRoot : document;
            if (!root) throw new Error(`Accessibility scan root unavailable: ${shadow ? 'widget shadow root' : 'document'}`);
            return window.axe.run(root, options);
        }, {shadow, options: axeOptions});
        // Axe can omit a placeholder under a menu depending on hit-test timing.
        // Explicitly retain overlapping empty placeholders in the rendered review.
        const overlapTargets = await page.evaluate(({shadow}) => {
            const root = shadow ? document.querySelector('#happytohelp > div')?.shadowRoot : document;
            const menus = [...root.querySelectorAll('[role="menu"]')].map(menu => menu.getBoundingClientRect()).filter(rect => rect.width && rect.height);
            return [...root.querySelectorAll('input[placeholder], textarea[placeholder]')].filter(element => {
                if (element.value) return false;
                const rect = element.getBoundingClientRect();
                return menus.some(menu => rect.x < menu.right && rect.right > menu.x && rect.y < menu.bottom && rect.bottom > menu.y);
            }).map(element => ({target: [`${element.tagName.toLowerCase()}[placeholder=${JSON.stringify(element.getAttribute('placeholder'))}]`], any: [{message: 'Rendered placeholder overlaps an open menu; visible glyph contrast requires per-pixel review.', data: {expectedContrastRatio: 4.5}}]}));
        }, {shadow});
        const existingTargets = new Set(result.incomplete.filter(rule => rule.id === 'color-contrast').flatMap(rule => rule.nodes.flatMap(node => node.target.flat())));
        const supplemental = overlapTargets.filter(node => !node.target.some(target => existingTargets.has(target)));
        const reviewRules = supplemental.length ? [...result.incomplete, {id: 'color-contrast', nodes: supplemental}] : result.incomplete;
        const contrastReview = await reviewIncompleteContrast(page, label, reviewRules, {shadow});
        const entry = {
            label,
            url: page.url(),
            root: shadow ? 'widget ShadowRoot' : 'dashboard document',
            timestamp: new Date().toISOString(),
            violations: result.violations,
            passes: result.passes.map(({id, impact, nodes}) => ({id, impact, nodeCount: nodes.length})),
            incomplete: result.incomplete,
            supplementalContrastTargets: supplemental,
            incompleteContrastReview: contrastReview,
            inapplicable: result.inapplicable.map(({id}) => id),
        };
        scans.push({label, violationCount: result.violations.length, violations: result.violations.map(violation => ({id: violation.id, impact: violation.impact, targets: violation.nodes.map(node => node.target)}))});
        axeIncomplete.push({label, items: result.incomplete.map(rule => ({id: rule.id, impact: rule.impact, nodes: rule.nodes.map(node => ({target: node.target, messages: [...(node.any || []), ...(node.all || []), ...(node.none || [])].map(item => ({message: item.message, data: item.data}))}))}))});
        await writeFile(join(evidenceDir, `${label}.axe.json`), JSON.stringify(entry, null, 2));
        await page.screenshot({path: join(evidenceDir, `${label}.png`), fullPage: !shadow});
        incompleteContrast.push({label, entries: contrastReview});
        const unreviewedContrast = contrastReview.filter(item => item.status !== 'measured' && item.status !== 'limited');
        assert.deepEqual(unreviewedContrast, [], `${label} has axe contrast incompletes without an actual composite measurement or explicit limitation: ${JSON.stringify(unreviewedContrast)}`);
        const contrastFailures = contrastReview.filter(item => item.status === 'failed');
        assert.deepEqual(contrastFailures, [], `${label} has axe contrast incompletes below their WCAG text threshold: ${JSON.stringify(contrastFailures)}`);
        return result;
    };

    const assertAxeClean = (result, label) => {
        if (result.violations.length) {
            const details = result.violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(', ')).join('; ')}`).join('\n');
            assert.fail(`${label} has ${result.violations.length} axe violation(s):\n${details}`);
        }
    };

    return {scan, assertAxeClean};
}
