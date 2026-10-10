import { widgetAppearance } from '../../../../modules/widget/appearance.js';
import { defaultSettings, defaultText, defaultTheme } from '../../../../modules/widget/js/context/defaults';

// The editor shows what the widget actually renders: the saved overrides laid over the widget defaults.
// Only the fields a person edits are written back, so opening the editor and saving changes nothing,
// and values that were never set stay "unset" instead of being frozen at whatever the form displayed.
export const widgetDefaults = { theme: defaultTheme, settings: defaultSettings, text: defaultText };

/** `theme[chat][agent][color]` -> ['theme', 'chat', 'agent', 'color'] */
export const fieldPath = name => name.split(/[[\]]+/).filter(Boolean);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const getIn = (object, path) => path.reduce((value, key) => (isObject(value) ? value[key] : undefined), object);

function setIn(object, path, value) {
    let node = object;
    for (const key of path.slice(0, -1)) {
        if (!isObject(node[key])) node[key] = {};
        node = node[key];
    }
    node[path.at(-1)] = value;
}

function unsetIn(object, path) {
    const trail = [object];
    for (const key of path.slice(0, -1)) {
        const next = trail.at(-1)?.[key];
        if (!isObject(next)) return;
        trail.push(next);
    }
    delete trail.at(-1)[path.at(-1)];
    for (let index = path.length - 1; index > 0; index--) {
        if (Object.keys(trail[index]).length) break;
        delete trail[index - 1][path[index - 1]];
    }
}

export function mergeSettings(base, overrides) {
    const merged = structuredClone(base);
    for (const [key, value] of Object.entries(overrides || {})) {
        merged[key] = isObject(value) && isObject(merged[key]) ? mergeSettings(merged[key], value) : structuredClone(value);
    }
    return merged;
}

// Settings saved before the editor stored real booleans hold "1" for an enabled switch.
const asSwitch = value => value === true || value === '1' || value === 'true';
// A color input can only show #rrggbb. Expand #rgb so shorthand colors do not display as black.
const asColor = value => (typeof value === 'string' && /^#[0-9a-f]{3}$/i.test(value) ? `#${[...value.slice(1)].map(c => c + c).join('')}`.toLowerCase() : value);

/** The effective value of every field the editor offers, ready to seed the form. */
export function effectiveSettings(saved, fieldNames, brand = {}) {
    const effective = mergeSettings(widgetDefaults, widgetAppearance(brand, saved));
    for (const name of fieldNames) {
        const path = fieldPath(name), value = getIn(effective, path);
        if (typeof getIn(widgetDefaults, path) === 'boolean') setIn(effective, path, asSwitch(value));
        else if (path[0] === 'theme') setIn(effective, path, asColor(value));
    }
    return effective;
}

export const defaultFor = name => getIn(widgetDefaults, fieldPath(name));

// An emptied text field means "use the default text", not "show nothing".
export const fieldValue = (name, value) => (value === '' ? defaultFor(name) : value);

/** What to store after the person edited `changes` ({ fieldName: value }): saved overrides plus those edits. */
export function settingsToSave(saved, changes, brand = {}) {
    const result = structuredClone(saved || {});
    const inherited = mergeSettings(widgetDefaults, widgetAppearance(brand));
    for (const [name, raw] of Object.entries(changes)) {
        const path = fieldPath(name), value = fieldValue(name, raw);
        if (value === getIn(inherited, path)) unsetIn(result, path);
        else setIn(result, path, value);
    }
    return result;
}

/** Settings pushed to the live preview: defaults, inherited appearance, then saved overrides and edits. */
export function previewSettings(saved, changes, brand = {}) {
    return mergeSettings(widgetDefaults, widgetAppearance(brand, settingsToSave(saved, changes, brand)));
}
