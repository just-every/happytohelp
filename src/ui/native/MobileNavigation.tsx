import { createContext, useContext, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';

const MobileNavigationContext = createContext<{
    open: boolean; setOpen: Dispatch<SetStateAction<boolean>>;
} | null>(null);

/** The shell and portalled inbox links share one React-owned collapse state. */
export function MobileNavigationProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    return <MobileNavigationContext.Provider value={{open, setOpen}}>{children}</MobileNavigationContext.Provider>;
}

export function useMobileNavigation() {
    const state = useContext(MobileNavigationContext);
    if (!state) throw new Error('Mobile navigation requires the native shell');
    return state;
}
