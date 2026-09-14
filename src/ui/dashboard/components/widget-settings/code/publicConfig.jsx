const PUBLIC_CONFIG_KEYS = [ 'widgetKey', 'scriptUrl', 'apiOrigin' ];

function normaliseUrl(value, name, required = false) {
    if (value === null || value === undefined || value === '') {
        if (required) throw new TypeError(`${name} is required`);
        return null;
    }
    if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
    return value;
}

function normalisePublicConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new TypeError('Widget code requires a public config object');
    }

    const unsupportedKeys = Object.keys(config).filter(key => !PUBLIC_CONFIG_KEYS.includes(key));
    if (unsupportedKeys.length) {
        throw new TypeError(`Widget code accepts only public config keys: ${PUBLIC_CONFIG_KEYS.join(', ')}`);
    }

    if (typeof config.widgetKey !== 'string' || !config.widgetKey) throw new TypeError('widgetKey is required');
    return {
        widgetKey: config.widgetKey,
        scriptUrl: normaliseUrl(config.scriptUrl, 'scriptUrl', true),
        apiOrigin: normaliseUrl(config.apiOrigin, 'apiOrigin', true),
    };
}

function serializeForScript(value, space = 2) {
    return JSON.stringify(value, null, space).replace(/[<>&\u2028\u2029]/g, character => ({
        '<': '\\u003c',
        '>': '\\u003e',
        '&': '\\u0026',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029',
    }[character]));
}

function escapeHtmlAttribute(value) {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#039;',
        '"': '&quot;',
    }[character]));
}

export {
    PUBLIC_CONFIG_KEYS,
    normalisePublicConfig,
    serializeForScript,
    escapeHtmlAttribute,
};
