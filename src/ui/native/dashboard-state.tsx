import { createContext, useContext, useSyncExternalStore } from 'react';
import { redirect, type AnyRouter, type ParsedLocation } from '@tanstack/react-router';
import { nativeRequest } from './transport';

export const DashboardSettingsContext = createContext<any>(null);
export function useDashboardSettings() {
    const settings = useContext(DashboardSettingsContext);
    if (!settings) throw new Error('Dashboard settings require the workspace route');
    return settings;
}

export function useDashboardLocation(): ParsedLocation {
    return useDashboardSettings().dashboardLocation;
}

let sessionVersion = 0;
const listeners = new Set<() => void>();
export function useDashboardSessionVersion() {
    return useSyncExternalStore(listener => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, () => sessionVersion, () => 0);
}

/** Retire authenticated state before loading the new session's workspace. */
export function invalidateDashboardSession(router: AnyRouter) {
    sessionVersion++;
    delete (window as any).chatSettings;
    listeners.forEach(listener => listener());
    router.clearCache();
}

export async function loadDashboard({ location, abortController }: {
    location: ParsedLocation; abortController: AbortController;
}) {
    const version = sessionVersion;
    const segment = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
    const projectId = segment && segment !== 'create' ? decodeURIComponent(segment) : undefined;
    let settings;
    try { settings = await nativeRequest('/api/management/bootstrap' + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''), { signal: abortController.signal });
    } catch (error: any) {
        if (error.status === 401 && version === sessionVersion && !abortController.signal.aborted) {
            delete (window as any).chatSettings;
            throw redirect({ to: '/login', search: { returnTo: location.href }, replace: true, ignoreBlocker: true });
        }
        throw error;
    }
    if (version !== sessionVersion) throw new Error('Your session changed. Reload the workspace.');
    const search = location.search as Record<string, unknown>;
    return {
        ...settings, apiUrl: '/api/dashboard', projectId, isGlobalInbox: !projectId, sessionVersion: version,
        dashboardLocation: { ...location, search: { ...search, ...(search.q == null ? {} : { q: String(search.q) }) } },
    };
}

// The splat leaf supplies pathname identity; explicit search deps distinguish
// concurrent query navigations. Blocking reloads retain the completed workspace.
export const dashboardLoaderOptions = {
    loader: { handler: loadDashboard, staleReloadMode: 'blocking' as const },
    loaderDeps: ({ search }: { search: Record<string, unknown> }) => search,
    shouldReload: true,
    staleTime: 0,
    gcTime: 0,
    pendingMs: Infinity,
};
