/**
 * Keeps tabs that share one session cookie on the project their URL names.
 *
 * The session cookie holds one active project, so a second tab opening another
 * project re-binds it for every tab. Each dashboard load announces the session's
 * project to the other tabs; a tab whose URL names a different project marks
 * itself displaced and, when the user returns to it (window focus), re-runs the
 * dashboard loader, which re-activates its project or shows the unavailable state.
 */
import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';

const channelName = 'h2h-session-project';
let channel: BroadcastChannel | undefined;
const sessionChannel = () => (channel ??= new BroadcastChannel(channelName));

/** Tell the other tabs which project the session is now bound to. */
export function announceSessionProject(projectId: string | null | undefined) {
    if (typeof window === 'undefined') return;
    sessionChannel().postMessage({ projectId: projectId ?? null });
}

/** Re-activate `projectId` when this tab regains focus after another tab moved the session elsewhere. */
export function useSessionProjectGuard(projectId: string | undefined) {
    const router = useRouter();
    useEffect(() => {
        if (!projectId) return;
        let displaced = false;
        const onMessage = (event: MessageEvent) => { displaced = event.data?.projectId !== projectId; };
        const onFocus = () => {
            if (!displaced) return;
            displaced = false;
            void router.invalidate();
        };
        const source = sessionChannel();
        source.addEventListener('message', onMessage);
        window.addEventListener('focus', onFocus);
        return () => { source.removeEventListener('message', onMessage); window.removeEventListener('focus', onFocus); };
    }, [projectId, router]);
}
