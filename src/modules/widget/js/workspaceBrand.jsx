export function launcherWorkspaceBrand({ currentAgent, preview, contextBrand, conversationSettings } = {}) {
    // The API represents the unassigned Team option with a null agent ID.
    // An individual responder must retain their own avatar, even when a brand is saved.
    if (!currentAgent || currentAgent.is_ai || currentAgent.id !== null) return null;

    const brand = preview?.workspace_brand || conversationSettings?.workspace_brand || contextBrand;
    const avatarUrl = typeof brand?.avatar_url === 'string' ? brand.avatar_url.trim() : '';

    if (!avatarUrl) return null;

    return {
        name: typeof brand.name === 'string' && brand.name.trim() ? brand.name.trim() : 'Workspace',
        avatar_url: avatarUrl,
    };
}
