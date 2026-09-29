import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
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
                        fragments.push({text: placeholder, foreground: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, opacity: Number.parseFloat(baseStyle.opacity || '1'), rects: [{x: paddingLeft, y: (elementRect.height - fontSize) / 2, width: Math.max(1, textWidth), height: fontSize}]});
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
                    // A screenshot of a fully covered label contains menu pixels, not
                    // that label's text/background pair. Require geometric evidence at
                    // every text rectangle's corners and center; never mark it passing.
                    const coveringMenus = fragments.flatMap(fragment => fragment.rects.flatMap(rect =>
                        [[1, 1], [rect.width - 1, 1], [1, rect.height - 1], [rect.width - 1, rect.height - 1], [rect.width / 2, rect.height / 2]].map(([x, y]) => {
                            const hit = root.elementFromPoint(elementRect.x + rect.x + x, elementRect.y + rect.y + y);
                            const menu = hit?.closest('.native-account-dropdown, .navbar-workspace-menu, [role="menu"]');
                            return menu && !menu.contains(element) ? {className: menu.className, role: menu.getAttribute('role')} : null;
                        })));
                    if (coveringMenus.length && coveringMenus.every(Boolean)) {
                        targets.push({...descriptor, id, status: 'limited', reason: 'Every text rectangle is covered by an open menu at all four corners and its center; menu pixels cannot establish the hidden label contrast. This remains a review limitation, with any unoccluded measurements recorded separately.', coveringMenus});
                        continue;
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
            const imageBuffer = await page.locator(`[data-a11y-contrast-sample="${target.id}"]`).screenshot({animations: 'disabled', caret: 'hide'});
            const measured = measureContrastInRegions(decodePng(imageBuffer), target.fragments, target.elementSize);
            let status = target.unsupportedTextEffects.length ? 'limited' : measured.minimumContrastRatio === null ? 'limited' : measured.minimumContrastRatio < target.expectedContrastRatio ? 'failed' : 'measured';
            let reason = status === 'limited' ? target.unsupportedTextEffects.length ? `Rendered text uses unsupported effects: ${target.unsupportedTextEffects.join(', ')}.` : 'No text pixels were captured from the rendered target.' : undefined;
            if (target.obscuredByModal && status === 'failed') {
                const unobscuredMeasurement = incompleteContrast.flatMap(scan => scan.entries.map(entry => ({scan: scan.label, ...entry})))
                    .find(entry => entry.status === 'measured' && entry.targets.some(targets => targets.includes(target.targets[0])));
                if (unobscuredMeasurement) {
                    status = 'limited';
                    reason = `The active modal makes this background control unavailable; the same text was measured at ${unobscuredMeasurement.minimumContrastRatio}:1 while unobscured in ${unobscuredMeasurement.scan}.`;
                }
            }
                review.push({...target, screenshot: 'element screenshot with text hidden to sample actual composited background pixels', ...measured, status, reason});
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
        const contrastReview = await reviewIncompleteContrast(page, label, result.incomplete, {shadow});
        const entry = {
            label,
            url: page.url(),
            root: shadow ? 'widget ShadowRoot' : 'dashboard document',
            timestamp: new Date().toISOString(),
            violations: result.violations,
            passes: result.passes.map(({id, impact, nodes}) => ({id, impact, nodeCount: nodes.length})),
            incomplete: result.incomplete,
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
