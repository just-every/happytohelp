import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useBlocker } from '@tanstack/react-router';

type Guard = { confirmNavigation: () => boolean; setDirty: (id: string, dirty: boolean) => void };
const GuardContext = createContext<Guard | null>(null);

/** One guard covers route changes and session-changing navigation commands. */
export function NavigationGuard({ children }: { children: ReactNode }) {
    const drafts = useRef(new Set<string>());
    const setDirty = useCallback((id: string, dirty: boolean) => {
        if (dirty) drafts.current.add(id);
        else drafts.current.delete(id);
    }, []);
    const confirmNavigation = useCallback(() => {
        if (!drafts.current.size) return true;
        if (!window.confirm('Discard unsaved changes and leave this page?')) return false;
        // The editor clears its registration on save/unmount. A failed navigation
        // or session request must leave the existing draft protected.
        return true;
    }, []);
    useBlocker({
        // Inbox filters do not replace the editor or its draft.
        shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && !confirmNavigation(),
        enableBeforeUnload: () => drafts.current.size > 0,
    });
    const guard = useMemo(() => ({ confirmNavigation, setDirty }), [confirmNavigation, setDirty]);
    return <GuardContext.Provider value={guard}>{children}</GuardContext.Provider>;
}

export function useNavigationGuard() {
    const guard = useContext(GuardContext);
    if (!guard) throw new Error('Dashboard forms must be inside NavigationGuard');
    return guard;
}

export function useUnsavedChanges() {
    const { setDirty } = useNavigationGuard();
    const id = useId();
    useEffect(() => () => setDirty(id, false), [id, setDirty]);
    return useMemo(() => ({
        markDirty: () => setDirty(id, true),
        markSaved: () => setDirty(id, false),
        setDirty: (dirty: boolean) => setDirty(id, dirty),
    }), [id, setDirty]);
}
