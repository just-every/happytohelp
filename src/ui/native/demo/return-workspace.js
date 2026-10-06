// A return destination is navigation context, never proof of project access.
const key = userId => `h2h.demo-return.v1:${userId}`;
export function realWorkspaces(settings) {
    return Object.values(settings.projects || {}).filter(project => !project.is_demo)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function readDemoReturn(storage, userId, demoId) {
    if (!userId || !demoId) return null;
    try {
        const value = JSON.parse(storage.getItem(key(userId)) || 'null');
        return value?.userId === userId && value.demoId === demoId && typeof value.projectId === 'string'
            ? value : null;
    } catch { return null; }
}
export function rememberDemoReturn(storage, userId, demoId, projectId) {
    if (!userId || !demoId || !projectId || demoId === projectId) throw new Error('Choose your return workspace before opening the demo.');
    const value = { userId, demoId, projectId };
    storage.setItem(key(userId), JSON.stringify(value));
    if (readDemoReturn(storage, userId, demoId)?.projectId !== projectId) throw new Error('Your browser could not save the return workspace. Allow site storage and try again.');
    return value;
}
export function clearDemoReturn(storage, userId) {
    try { storage.removeItem(key(userId)); } catch { /* The completed return does not depend on cleanup. */ }
}
export function returnWorkspace(settings, context) {
    if (context?.userId !== settings.currentAgent?.id) return null;
    return realWorkspaces(settings).find(project => project.id === context.projectId) || null;
}
