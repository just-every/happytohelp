export function isPreviewMode(config) {
    return config?.preview?.enabled === true;
}

export function normalizePreviewUpdate(config, update) {
    if (!update || typeof update !== 'object') {
        return { allowed: true, update };
    }

    const preview = isPreviewMode(config);
    const requestedPreview = update.preview;
    const changesPreviewMode = requestedPreview
        && Object.prototype.hasOwnProperty.call(requestedPreview, 'enabled')
        && Boolean(requestedPreview.enabled) !== preview;

    if (changesPreviewMode) {
        return { allowed: false, update };
    }

    if (preview) {
        return {
            allowed: true,
            update: {
                ...update,
                preview: {
                    ...requestedPreview,
                    enabled: true,
                },
            },
        };
    }

    return { allowed: true, update };
}

