import type { ReactNode } from 'react';
import { BrandLockup } from '../homepage/BrandLockup';
import '../homepage/outfit.css';
import './identity.css';

/** The public frame for sign-in, sign-up, recovery and invitation pages: the HappyToHelp lockup home, one panel, a way back. */
export default function IdentityFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
    return <div className="h2h-identity">
        <header className="id-header"><BrandLockup home="/" /></header>
        <main className="id-main"><div className={wide ? 'id-panel id-panel--wide' : 'id-panel'}>{children}</div></main>
        <footer className="id-footer"><a href="/">Back to home</a></footer>
    </div>;
}
