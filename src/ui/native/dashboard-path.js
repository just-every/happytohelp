export const dashboardPath = /^\/(?:conversations(?:\/[^/]+)?|projects(?:\/create|\/[^/]+(?:\/(?:conversations(?:\/[^/]+)?|edit|settings|billing|email-settings|widget-settings|github-settings|local-agent|training-runs(?:\/[^/]+)?|insights(?:\/[^/]+)?|(?:ais|macros|contacts|plugins|agents|datasets|articles|categories)(?:\/[^/]+)?))?)?|local-agent\/authorize|users\/[^/]+|admin(?:\/[^/]+(?:\/[^/]+)?)?)\/?$/;

/** Login resumes only a dashboard URL within this application. */
export function loginDestination(returnTo, origin, accountOnly = false) {
    const fallback = accountOnly ? '/projects/create' : '/conversations';
    if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || returnTo.startsWith('//')) return fallback;
    try {
        // URL parsing otherwise silently normalizes backslashes and strips controls.
        if (/[\\\u0000-\u0020\u007f]/.test(returnTo) || /[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(returnTo))) return fallback;
        const target = new URL(returnTo, origin);
        if (target.origin !== origin || !dashboardPath.test(target.pathname)) return fallback;
        return target.pathname + target.search + target.hash;
    } catch {
        return fallback;
    }
}
