import { loginDestination } from '../../platform/dashboard-path.js';
import { nativeRequest } from '../native/transport.js';

/** Resume explicit links, otherwise open the authenticated workspace and its remaining owner setup. */
export async function signInDestination(returnTo: unknown, origin: string, accountOnly = false): Promise<string> {
    const destination = loginDestination(returnTo, origin, accountOnly);
    if (destination !== '/conversations') return destination;
    const actor = await nativeRequest('/api/identity/session');
    if (!actor.projectId) return '/projects/create';
    const workspace = `/projects/${encodeURIComponent(actor.projectId)}`;
    if (['owner', 'admin'].includes(actor.role)) {
        // Read the same current observations and skips the Setup page displays. GET makes no provider call.
        const { data } = await nativeRequest(`/api/management/projects/${encodeURIComponent(actor.projectId)}/activation`);
        if (data.steps.some((step: { placement: string }) => step.placement === 'needs_you')) return workspace + '/activation';
    }
    return workspace + '/conversations';
}
