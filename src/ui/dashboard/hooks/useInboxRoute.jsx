import { useDashboardLocation } from '../../native/dashboard-state';

// The native dashboard uses a catch-all route, so its inbox segments are read
// from router state rather than a second router's parameter context.
export default function useInboxRoute() {
    const pathname = useDashboardLocation().pathname;
    const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const projectScoped = segments[0] === 'projects';
    return {
        urlProjectId: projectScoped ? segments[1] : undefined,
        urlConversationId: projectScoped
            ? (segments[2] === 'conversations' ? segments[3] : undefined)
            : (segments[0] === 'conversations' ? segments[1] : undefined),
    };
}
