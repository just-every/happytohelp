import { useEffect, type ReactNode } from 'react';
import { createWorkspaceTheme } from './workspaceModes';

/** The original public account page frame, shared without dashboard navigation. */
export default function AuthFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const previous = document.body.className;
        const palette = createWorkspaceTheme('#713ee0', 'balanced');
        const previousStyles = Object.fromEntries(Object.keys(palette).map(key => [key, document.body.style.getPropertyValue(key)]));
        document.body.className = 'workspace-page workspace-entry workspace-themed theme-happytohelp';
        Object.entries(palette).forEach(([key, value]) => document.body.style.setProperty(key, String(value)));
        return () => {
            document.body.className = previous;
            Object.entries(previousStyles).forEach(([key, value]) => value ? document.body.style.setProperty(key, value) : document.body.style.removeProperty(key));
        };
    }, []);
    return <main className="d-flex align-items-center py-5" style={{ minHeight: '100dvh' }}>
        <div className="container"><div className="row justify-content-center">
            <div className={wide ? 'col-12 col-md-7' : 'col-12 col-md-5 col-xl-4'}>{children}</div>
        </div></div>
    </main>;
}
