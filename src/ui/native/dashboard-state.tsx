import { createContext, useContext, useSyncExternalStore } from 'react';
import { redirect, type AnyRouter, type ParsedLocation } from '@tanstack/react-router';
import { nativeRequest } from './transport';
import { actsOnSessionProject, projectIdFromPath } from './workspace-scope';
import { announceSessionProject } from './session-project-sync';
import { delegationAccount, loadConsent } from './delegation-loader';

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

/** Make `projectId` the session's active project, so project-scoped APIs agree with the URL. */
async function activateProject(projectId: string, signal: AbortSignal) {
    await nativeRequest('/api/identity/switch-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }), signal,
    });
}

export async function loadDashboard({ location, abortController }: {
    location: ParsedLocation; abortController: AbortController;
}) {
    const version = sessionVersion;
    const { signal } = abortController;
    // Connected applications and the consent screen name their workspace in `account_id` instead of the path.
    const urlProjectId = projectIdFromPath(location.pathname) ?? delegationAccount(location);
    const bootstrap = async (projectId?: string) => {
        try { return await nativeRequest('/api/management/bootstrap' + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''), { signal });
        } catch (error: any) {
            if (error.status === 401 && version === sessionVersion && !signal.aborted) {
                delete (window as any).chatSettings;
                throw redirect({ to: '/login', search: { returnTo: location.href }, replace: true, ignoreBlocker: true });
            }
            throw error;
        }
    };
    let settings: any;
    let projectUnavailable: string | undefined;
    try {
        settings = await bootstrap(urlProjectId);
        if (urlProjectId && settings.accountOnly) throw Object.assign(new Error('No access'), { status: 403 });
        // The URL names the workspace: bind the session to it before any page reads its data.
        if (urlProjectId && settings.sessionProjectId !== urlProjectId) {
            await activateProject(urlProjectId, signal);
            settings = { ...settings, sessionProjectId: urlProjectId };
        }
    } catch (error: any) {
        // A project the account does not belong to (or that does not exist) is a page state, not a failed load.
        if (!urlProjectId || error.status !== 403) throw error;
        projectUnavailable = urlProjectId;
        settings = await bootstrap();
    }
    const delegationConsent = await loadConsent(location, signal);
    if (version !== sessionVersion) throw new Error('Your session changed. Reload the workspace.');
    announceSessionProject(settings.sessionProjectId);
    const search = location.search as Record<string, unknown>;
    // Pages such as /local-agent/authorize have no project in the URL but act on the session's.
    const projectId = projectUnavailable ? undefined : urlProjectId ?? (actsOnSessionProject(location.pathname) ? settings.project?.id : undefined);
    return {
        ...settings, apiUrl: '/api/dashboard', projectId, projectUnavailable, isGlobalInbox: !projectId, sessionVersion: version, delegationConsent,
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
